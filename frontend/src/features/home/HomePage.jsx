import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import bookOpenRaw from '../../assets/icons/book-open.svg?raw'
import { useAuth } from '../../shared/contexts/AuthContext'
import { useDiaryFeed, useSchedules } from '../../shared/api/queries'
import './home.css'

// 홈이 내다보는 기간. 오늘부터 이만큼 안에 다음 약속이 있으면 보여준다.
const UPCOMING_DAYS = 60

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

function dateKeyAfter(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * 지금 무엇을 보여줄지 하나만 고른다.
 *
 * @param {Array} schedules 오늘부터 앞으로의 일정 (장소 포함)
 * @param {object|null} pendingRecord 기록을 기다리는 가장 최근 하루
 * @returns {{kind: string, schedule?: object, record?: object}}
 *
 * 홈은 여러 정보를 나열하는 대시보드가 아니라 "지금 무엇을 하면 되는지"를 하나로
 * 제시하는 화면이다(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.1절). 그래서 후보가
 * 여럿이어도 우선순위대로 하나만 고른다.
 *
 * 우선순위: 오늘 > 기록 대기 > 다음 약속 > 없음. 진행 중인 하루가 미래 일정보다
 * 앞서야 하고, 다녀왔는데 안 남긴 하루는 다음 약속보다 먼저 눈에 띄어야 한다(7절).
 */
function resolveFocus(schedules, pendingRecord) {
  const today = schedules.filter((schedule) => schedule.experience_phase === 'today')
  if (today.length > 0) {
    // 오늘 일정이 여럿이면 시작이 가장 가까운 하나만 주 카드로 쓴다(7절).
    const [nearest] = [...today].sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    return { kind: 'today', schedule: nearest }
  }

  if (pendingRecord) return { kind: 'record', record: pendingRecord }

  const upcoming = schedules
    .filter((schedule) => schedule.experience_phase === 'upcoming')
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  if (upcoming.length > 0) return { kind: 'upcoming', schedule: upcoming[0] }

  return { kind: 'empty' }
}

/** 장소 순서를 이름만 이어 붙여 보여준다. 하루의 흐름을 한 줄로 읽히게 한다. */
function PlaceFlow({ places }) {
  if (places.length === 0) return null

  return (
    <p className="home-card__places">
      <Icon raw={mapPinRaw} size={13} />
      {places.map((place) => place.name).join(' → ')}
    </p>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 오늘부터 앞으로의 일정만 본다. 홈은 지난 계획을 되짚는 화면이 아니다.
  const { data: schedules = [], isPending } = useSchedules({
    from: dateKeyAfter(0),
    to: dateKeyAfter(UPCOMING_DAYS),
    includePlaces: true,
  })

  // 기록 대기는 기록 탭과 같은 목록에서 가져온다. 두 화면이 다른 기준으로 고르면
  // 홈에서 재촉한 하루가 기록 탭에는 없는 상황이 생긴다.
  const { data: feed } = useDiaryFeed({ includePending: true })
  const pendingRecord = useMemo(
    () =>
      feed?.pages
        .flatMap((page) => page.records)
        .find((record) => record.phase === 'record_pending') ?? null,
    [feed],
  )

  const focus = useMemo(() => resolveFocus(schedules, pendingRecord), [schedules, pendingRecord])

  return (
    <div className="home-page">
      <header className="home-page__header">
        <p className="home-page__eyebrow">{dateFormatter.format(new Date())}</p>
        <h1 className="home-page__title">{user?.nickname}님의 하루</h1>
      </header>

      {isPending && <p className="home-page__status">하루를 준비하고 있어요.</p>}

      {!isPending && focus.kind === 'today' && (
        <TodayCard schedule={focus.schedule} onOpen={() => navigate(`/schedules/${focus.schedule.id}`)} />
      )}

      {!isPending && focus.kind === 'record' && (
        <RecordPromptCard
          record={focus.record}
          onOpen={() => navigate(`/schedules/${focus.record.scheduleId}`)}
        />
      )}

      {!isPending && focus.kind === 'upcoming' && (
        <UpcomingCard
          schedule={focus.schedule}
          onOpen={() => navigate(`/schedules/${focus.schedule.id}`)}
        />
      )}

      {!isPending && focus.kind === 'empty' && (
        <div className="home-card home-card--empty">
          <p className="home-card__eyebrow">아직 계획이 없어요</p>
          <h2 className="home-card__title">어떤 하루를 보내고 싶으세요?</h2>
          <button type="button" className="home-card__action" onClick={() => navigate('/schedules/new')}>
            <Icon raw={plusRaw} size={16} />
            새로운 하루 계획하기
          </button>
          <button type="button" className="home-card__secondary" onClick={() => navigate('/records')}>
            <Icon raw={bookOpenRaw} size={15} />
            지난 기록 다시 보기
          </button>
        </div>
      )}
    </div>
  )
}

/** 오늘의 하루. 시작 전이면 시작 시각을, 진행 중이면 다음 장소를 앞세운다. */
function TodayCard({ schedule, onOpen }) {
  const started = new Date(schedule.start_at) <= new Date()
  const visited = schedule.places.filter((place) => place.visited).length
  const nextPlace = schedule.places.find((place) => !place.visited) ?? null

  return (
    <article className="home-card home-card--today">
      <p className="home-card__eyebrow">
        {started ? '지금 진행 중' : `${timeFormatter.format(new Date(schedule.start_at))} 시작`}
        {' · '}
        {schedule.space_name}
      </p>
      <h2 className="home-card__title">{schedule.title}</h2>

      {started && nextPlace ? (
        <p className="home-card__next">
          다음 장소 <strong>{nextPlace.name}</strong>
        </p>
      ) : (
        <PlaceFlow places={schedule.places} />
      )}

      {schedule.place_count > 0 && (
        <p className="home-card__progress">
          {visited} / {schedule.place_count}곳 방문
        </p>
      )}

      <button type="button" className="home-card__action" onClick={onOpen}>
        {started ? '다음 장소 보기' : '오늘의 하루 보기'}
      </button>
    </article>
  )
}

/** 다녀왔는데 아직 남기지 않은 하루. 홈이 기록을 유도하는 자리다. */
function RecordPromptCard({ record, onOpen }) {
  return (
    <article className="home-card home-card--record">
      <p className="home-card__eyebrow">{record.dateLabel} · 아직 남기지 않았어요</p>
      <h2 className="home-card__title">{record.title}</h2>
      {record.placeCount > 0 && (
        <p className="home-card__places">
          <Icon raw={mapPinRaw} size={13} />
          {record.placeCount}곳을 다녀왔어요
        </p>
      )}
      <p className="home-card__hint">사진 한 장만 올려도 이 하루는 기억으로 남습니다.</p>
      <button type="button" className="home-card__action" onClick={onOpen}>
        오늘을 남기기
      </button>
    </article>
  )
}

/** 다음 약속. 오늘은 비었지만 앞으로 잡힌 하루가 있을 때 보여준다. */
function UpcomingCard({ schedule, onOpen }) {
  return (
    <article className="home-card">
      <p className="home-card__eyebrow">
        {dateFormatter.format(new Date(schedule.start_at))} · {schedule.space_name}
      </p>
      <h2 className="home-card__title">{schedule.title}</h2>
      <PlaceFlow places={schedule.places} />
      {schedule.place_count === 0 && (
        <p className="home-card__hint">아직 갈 곳을 정하지 않았어요.</p>
      )}
      <button type="button" className="home-card__action" onClick={onOpen}>
        {schedule.place_count === 0 ? '갈 곳 정하기' : '하루 보기'}
      </button>
    </article>
  )
}
