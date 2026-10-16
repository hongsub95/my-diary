import { Link } from 'react-router-dom'
import { EmptyState } from '../../shared/components/EmptyState'
import calendarRaw from '../../assets/icons/calendar.svg?raw'
import { useSchedules } from '../../shared/api/queries'
import { toServiceDateKey } from '../../shared/api/scheduleAdapter'
import { PhaseTag } from '../schedules/PhaseTag'
import { phaseKind, phaseLabel } from '../schedules/phase'
import './day-agenda.css'

// 캘린더에서 하루 하나를 펼쳐 보는 상태별 요약 카드 (docs/CALENDAR_SCREEN_SPEC.md 2026-10-15).
// 앱의 mobile/src/features/calendar/day-agenda.tsx와 같은 정보 순서·문구다.

const DAY_MS = 24 * 60 * 60 * 1000
// 카드에 다 늘어놓으면 하루 하나가 패널을 넘는다. 나머지는 개수로만 알리고 상세에서 본다.
const MAX_PLACES = 5

const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

/** 'YYYY-MM-DD'가 오늘(서비스 시간대)에서 며칠 떨어졌는지. 미래는 양수, 과거는 음수다. */
function daysFromToday(dateKey) {
  const toUtc = (value) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
  return Math.round((toUtc(dateKey) - toUtc(toServiceDateKey(new Date().toISOString()))) / DAY_MS)
}

/**
 * 카드 둘째 줄의 시간 문구. 당일이면 시각 범위, 여러 날짜면 날짜 범위를 보여준다.
 *
 * @param {object} schedule 화면용 일정 (scheduleAdapter)
 * @returns {string} 예: `12:00 – 15:00`, `10월 10일 ~ 11일`, `10월 31일 ~ 11월 1일`
 */
function timeRange(schedule) {
  const start = schedule.date_key
  const end = schedule.end_date_key
  if (start === end) return `${timeFormatter.format(new Date(schedule.start_at))} – ${timeFormatter.format(new Date(schedule.end_at))}`
  const [startMonth, startDay] = [Number(start.slice(5, 7)), Number(start.slice(8))]
  const [endMonth, endDay] = [Number(end.slice(5, 7)), Number(end.slice(8))]
  return `${startMonth}월 ${startDay}일 ~ ${startMonth === endMonth ? '' : `${endMonth}월 `}${endDay}일`
}

/**
 * 배지 문구. 상태 이름에 "언제인지"를 붙여 카드만 보고도 시점을 알게 한다.
 * 예정은 시작일을, 남기기 전은 끝난 날을 기준으로 센다.
 *
 * @param {object} schedule 화면용 일정
 * @returns {string} 예: `예정 · 2일 뒤`, `어제 · 남기기 전`, `남긴 하루`
 */
function badgeLabel(schedule) {
  const phase = schedule.experience_phase
  if (phase === 'upcoming') {
    const days = daysFromToday(schedule.date_key)
    return `예정 · ${days === 1 ? '내일' : `${days}일 뒤`}`
  }
  if (phase === 'record_pending') {
    const days = -daysFromToday(schedule.end_date_key)
    return `${days <= 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`} · 남기기 전`
  }
  return phaseLabel(phase)
}

/**
 * 하루 하나의 상태별 요약 카드.
 *
 * - 예정·오늘: 갈 곳 순서를 먼저 보여준다. 장소가 없으면 갈 곳 정하기로 보낸다.
 * - 남기기 전: 다녀온 곳 체크와 기록 버튼 하나.
 * - 남긴 하루: 대표 사진 → 일기 한 줄 → 장소 요약.
 *
 * 글 작성자 목록은 함께한 사람과 다르므로 보여주지 않는다(UX_INFORMATION_ARCHITECTURE_SPEC 11절).
 *
 * @param {object} props
 * @param {object} props.schedule include=places로 받은 화면용 일정
 */
export function DaySummaryCard({ schedule }) {
  const kind = phaseKind(schedule.experience_phase)
  const summary = schedule.record_summary
  const places = [...schedule.places].sort((a, b) => a.sort_order - b.sort_order)
  const shown = places.slice(0, MAX_PLACES)
  const visited = places.filter((place) => place.visited).length
  const detailPath = `/schedules/${schedule.id}`

  const header = (
    <>
      <PhaseTag kind={kind} label={badgeLabel(schedule)} />
      <h3 className="day-card__title">{schedule.title}</h3>
      <p className="day-card__meta">{timeRange(schedule)} · {schedule.space_name}</p>
    </>
  )
  const moreLink = (label) => (
    <Link to={detailPath} className="day-card__link"><span>{label}</span><span aria-hidden="true">›</span></Link>
  )
  const rest = places.length > shown.length && <p className="day-card__rest">외 {places.length - shown.length}곳</p>

  if (kind === 'done') {
    return (
      <article className="day-card">
        {summary.cover_thumbnail_url && (
          <div className="day-card__cover">
            <img src={summary.cover_thumbnail_url} alt="" />
            {summary.photo_count > 0 && <span className="day-card__photo-count">사진 {summary.photo_count}장</span>}
          </div>
        )}
        {header}
        {summary.diary_excerpt && <p className="day-card__quote">{summary.diary_excerpt}</p>}
        {places.length > 0 && (
          <p className="day-card__place-line"><strong>장소 {places.length}곳</strong> · {places.map((place) => place.name).join(' · ')}</p>
        )}
        {moreLink('기록 보기')}
      </article>
    )
  }

  if (kind === 'pending') {
    return (
      <article className="day-card">
        {header}
        {places.length > 0 && (
          <>
            <p className="day-card__section"><span>다녀온 곳</span><strong>{visited} / {places.length}</strong></p>
            <ol className="day-card__flow">
              {shown.map((place, index) => (
                <li key={place.id} className={`day-card__stop${place.visited ? '' : ' day-card__stop--skipped'}`}>
                  <span className={`day-card__num day-card__num--${place.visited ? 'visited' : 'skipped'}`} aria-hidden="true">{place.visited ? '✓' : index + 1}</span>
                  <span className="day-card__place-name">{place.name}</span>
                  <span className="day-card__sr">{place.visited ? ', 다녀옴' : ', 안 감'}</span>
                </li>
              ))}
            </ol>
            {rest}
          </>
        )}
        {/* 이 카드의 주요 행동은 하나다. 상세의 사진·기록 탭으로 바로 연다. */}
        <Link to={detailPath} state={{ tab: 'record' }} className="day-card__cta">이 하루 남기기</Link>
        <p className="day-card__cta-note">사진 한 장만 올려도 기록이 돼요</p>
        {moreLink('하루 자세히 보기')}
      </article>
    )
  }

  return (
    <article className="day-card">
      {header}
      {places.length > 0 ? (
        <>
          <p className="day-card__section"><span>갈 곳</span><strong>{places.length}곳</strong></p>
          <ol className="day-card__flow">
            {shown.map((place, index) => (
              <li key={place.id} className="day-card__stop">
                <span className="day-card__num" aria-hidden="true">{index + 1}</span>
                <span className="day-card__place-text">
                  <span className="day-card__place-name">{place.name}</span>
                  {place.address && <span className="day-card__place-address">{place.address}</span>}
                </span>
              </li>
            ))}
          </ol>
          {rest}
        </>
      ) : (
        <p className="day-card__section">
          <span>아직 갈 곳이 없어요</span>
          <Link to={`${detailPath}/plan`} className="day-card__inline-link">갈 곳 정하기 ›</Link>
        </p>
      )}
      {moreLink('하루 자세히 보기')}
    </article>
  )
}

/**
 * 하루 하나를 조회해 요약 카드로 늘어놓는다. 로딩·실패·빈 상태를 따로 보여준다.
 *
 * 월간이 쓰는 한 달치 조회에는 장소가 없다. 카드는 장소가 필요해서 그날 하루만
 * include=places로 따로 받는다(홈과 같은 조회라 캐시도 함께 쓴다). 여러 날짜 일정은
 * 날짜가 겹치기만 하면 서버가 넣어준다.
 *
 * @param {object} props
 * @param {string} props.day 'YYYY-MM-DD'
 */
export function DayAgenda({ day }) {
  const { data, isLoading, isError, refetch } = useSchedules({ from: day, to: day, includePlaces: true })

  if (isLoading) return <p className="day-agenda__state" role="status">하루를 불러오는 중…</p>
  // 실패를 빈 하루로 보이지 않게 한다. 실제로 하루가 있는데 "없어요"라고 하면 안 된다.
  if (isError) {
    return (
      <p className="day-agenda__state" role="alert">
        하루를 불러오지 못했어요.{' '}
        <button type="button" className="day-agenda__retry" onClick={() => refetch()}>다시 시도</button>
      </p>
    )
  }
  const items = [...(data ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id)
  if (!items.length) return <EmptyState compact icon={calendarRaw} title="이날은 예정된 하루가 없어요" description="다른 날짜를 골라 보세요." />
  return <div className="day-agenda">{items.map((item) => <DaySummaryCard key={item.id} schedule={item} />)}</div>
}
