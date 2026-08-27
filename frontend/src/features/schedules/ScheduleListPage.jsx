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

export default function ScheduleListPage() {
  const navigate = useNavigate()
  const { data: schedules = [] } = useSchedules({ includePlaces: true })

  const upcoming = schedules
    .filter((s) => s.status === 'planned')
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))

  const past = schedules
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.start_at) - new Date(a.start_at))

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
          <h2 className="slist-section__title">예정된 일정</h2>
          {upcoming.length === 0 ? (
            <p className="slist-section__empty">예정된 일정이 없어요</p>
          ) : (
            <div className="slist-section__list">
              {upcoming.map((s) => <ScheduleCard key={s.id} schedule={s} />)}
            </div>
          )}
        </section>

        <section className="slist-section">
          <h2 className="slist-section__title">지난 일정</h2>
          {past.length === 0 ? (
            <p className="slist-section__empty">지난 일정이 없어요</p>
          ) : (
            <div className="slist-section__list">
              {past.map((s) => <ScheduleCard key={s.id} schedule={s} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
