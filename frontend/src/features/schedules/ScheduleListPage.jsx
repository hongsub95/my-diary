import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import plusRaw from '../../assets/icons/plus.svg?raw'
import chevronRightRaw from '../../assets/icons/chevron-right.svg?raw'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import { useSchedules } from '../../shared/api/queries'
import './schedules.css'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}

function ScheduleCard({ schedule: s }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate(`/schedules/${s.id}`)} className="slist-card">
      <div className="slist-card__main">
        <div className="slist-card__top">
          <span className={`slist-card__badge slist-card__badge--${s.status}`}>
            {s.status === 'completed' ? '완료' : '예정'}
          </span>
          <span className="slist-card__date">{formatDate(s.start_at)}</span>
        </div>
        <p className="slist-card__title">{s.title}</p>
        {s.places.length > 0 && (
          <div className="slist-card__places">
            <Icon raw={mapPinRaw} size={14} className="slist-card__pin" />
            <span>{s.places.map((p) => p.name).join(' → ')}</span>
          </div>
        )}
        {s.diary && (
          <p className="slist-card__diary">
            {s.diary.mood} {s.diary.content}
          </p>
        )}
      </div>
      <Icon raw={chevronRightRaw} size={16} className="slist-card__arrow" />
    </button>
  )
}

// 일정 탭이 내다보는 기간. 이 안에 잡힌 하루를 모두 보여준다.
const UPCOMING_DAYS = 180

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
 * 일정 탭. "앞으로 어떤 하루가 있지?"에 답하는 화면이다.
 *
 * 완료한 하루는 여기 두지 않는다. 계획은 일정 탭, 기억은 기록 탭으로 역할을 나눈다
 * (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 2절). 예전에는 "지난 일정" 영역이 함께
 * 있었는데, 그러면 같은 하루가 두 탭에 나와 어느 쪽이 주 경로인지 흐려진다.
 */
export default function ScheduleListPage() {
  const navigate = useNavigate()
  // 오늘부터 앞으로만 받는다. 지난 하루는 애초에 목록에 오지 않는다.
  const { data: schedules = [] } = useSchedules({
    from: dateKeyAfter(0),
    to: dateKeyAfter(UPCOMING_DAYS),
    includePlaces: true,
  })

  // 오늘 진행 중인 하루와 앞으로 올 하루만 남긴다. 오늘 날짜라도 완료 처리했으면
  // 기록으로 넘어간 것이라 여기서 뺀다.
  const upcoming = schedules
    .filter((s) => s.experience_phase === 'today' || s.experience_phase === 'upcoming')
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))

  return (
    <div className="slist-page">
      <div className="slist-page__header">
        <h1 className="slist-page__heading">일정</h1>
        <button onClick={() => navigate('/schedules/new')} className="slist-page__add-btn">
          <Icon raw={plusRaw} size={16} />
          새 일정
        </button>
      </div>

      <div className="slist-page__body">
        <section className="slist-section">
          {upcoming.length === 0 ? (
            <p className="slist-section__empty">앞으로 잡힌 하루가 없어요</p>
          ) : (
            <div className="slist-section__list">
              {upcoming.map((s) => <ScheduleCard key={s.id} schedule={s} />)}
            </div>
          )}
        </section>

        {/* 지난 하루를 찾으러 온 사용자가 막다른 길에 서지 않도록 기록 탭을 가리킨다. */}
        <button type="button" className="slist-page__records" onClick={() => navigate('/records')}>
          지난 하루는 기록에서 다시 볼 수 있어요 →
        </button>
      </div>
    </div>
  )
}
