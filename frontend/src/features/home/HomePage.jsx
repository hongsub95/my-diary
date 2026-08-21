import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import { useSchedules } from '../../shared/api/queries'
import calendarRaw from '../../assets/icons/calendar.svg?raw'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import './home.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MARKER_POSITIONS = [
  { left: '20%', top: '62%' },
  { left: '48%', top: '31%' },
  { left: '73%', top: '53%' },
  { left: '60%', top: '72%' },
  { left: '31%', top: '25%' },
]

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function fromDateKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`)
}

function startOfWeek(date) {
  const result = new Date(date)
  result.setDate(date.getDate() - date.getDay())
  return result
}

function weekDates(selectedDate) {
  const start = startOfWeek(selectedDate)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function formatTime(dateStr) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateStr))
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: schedules = [] } = useSchedules()
  const todayKey = useMemo(() => formatDateKey(new Date()), [])
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [activePlaceId, setActivePlaceId] = useState(null)
  const selectedDateObject = useMemo(() => fromDateKey(selectedDate), [selectedDate])
  const dates = useMemo(() => weekDates(selectedDateObject), [selectedDateObject])
  const daySchedules = useMemo(
    () => schedules
      .filter((schedule) => schedule.start_at.slice(0, 10) === selectedDate)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
    [schedules, selectedDate],
  )
  const places = daySchedules.flatMap((schedule) =>
    schedule.places.map((place) => ({ ...place, scheduleId: schedule.id })),
  )
  const nextSchedule = daySchedules.find((schedule) => schedule.status === 'planned')
  const selectedLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(selectedDateObject)

  const chooseDate = (dateKey) => {
    setSelectedDate(dateKey)
    setActivePlaceId(null)
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-header__eyebrow">나의 일기, 내일</p>
          <h1 className="home-header__title">{selectedDate === todayKey ? '오늘의 하루' : selectedLabel}</h1>
          {selectedDate === todayKey && <p className="home-header__date">{selectedLabel}</p>}
        </div>
        <label className="home-date-picker" aria-label="날짜 선택">
          <Icon raw={calendarRaw} size={20} />
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => chooseDate(event.target.value)}
          />
        </label>
      </header>

      <section className="week-strip" aria-label="주간 날짜 선택">
        {dates.map((date) => {
          const dateKey = formatDateKey(date)
          const hasSchedule = schedules.some((schedule) => schedule.start_at.slice(0, 10) === dateKey)
          return (
            <button
              type="button"
              key={dateKey}
              className={`week-day${selectedDate === dateKey ? ' week-day--selected' : ''}`}
              onClick={() => chooseDate(dateKey)}
              aria-pressed={selectedDate === dateKey}
            >
              <span className="week-day__name">{WEEKDAYS[date.getDay()]}</span>
              <span className="week-day__number">{date.getDate()}</span>
              <span className={`week-day__dot${hasSchedule ? ' week-day__dot--visible' : ''}`} />
            </button>
          )
        })}
      </section>

      <section className="home-summary" aria-label="선택한 날짜 요약">
        <div><strong>{daySchedules.length}</strong><span>일정</span></div>
        <div><strong>{places.length}</strong><span>장소</span></div>
        <p>{nextSchedule ? `다음 일정 ${formatTime(nextSchedule.start_at)} · ${nextSchedule.title}` : '예정된 일정이 없습니다'}</p>
      </section>

      <div className="home-dashboard">
        <section className="home-panel home-map-panel">
          <div className="home-panel__header">
            <div>
              <p className="home-panel__eyebrow">DAY MAP</p>
              <h2>오늘의 장소</h2>
            </div>
            <span>{places.length}곳</span>
          </div>
          {places.length === 0 ? (
            <div className="home-map-empty">
              <Icon raw={mapPinRaw} size={28} />
              <p>장소가 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <div className="home-map" aria-label="선택한 날짜의 장소 지도 미리보기">
              <span className="home-map__road home-map__road--one" />
              <span className="home-map__road home-map__road--two" />
              {places.map((place, index) => (
                <button
                  type="button"
                  key={place.id}
                  className={`home-marker${activePlaceId === place.id ? ' home-marker--active' : ''}`}
                  style={MARKER_POSITIONS[index % MARKER_POSITIONS.length]}
                  onClick={() => setActivePlaceId(place.id)}
                  aria-label={`${index + 1}번째 장소 ${place.name}`}
                >
                  <span>{index + 1}</span>
                </button>
              ))}
              <div className="home-map__legend">
                {places.map((place, index) => (
                  <button key={place.id} type="button" onClick={() => setActivePlaceId(place.id)}>
                    <b>{index + 1}</b>{place.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="home-map-panel__notice">실제 지도와 경로 연결은 지도 공급자 연동 단계에서 적용됩니다.</p>
        </section>

        <section className="home-panel home-agenda-panel">
          <div className="home-panel__header">
            <div>
              <p className="home-panel__eyebrow">DAILY AGENDA</p>
              <h2>하루 일정</h2>
            </div>
            <button type="button" className="home-add-button" onClick={() => navigate('/schedules/new')}>
              <Icon raw={plusRaw} size={16} /> 일정
            </button>
          </div>
          {daySchedules.length === 0 ? (
            <div className="home-agenda-empty">
              <p>이 날은 아직 일정이 없어요.</p>
              <button type="button" onClick={() => navigate('/schedules/new')}>새 일정 만들기</button>
            </div>
          ) : (
            <div className="home-agenda-list">
              {daySchedules.map((schedule) => (
                <button
                  type="button"
                  key={schedule.id}
                  className="home-agenda-item"
                  onClick={() => navigate(`/schedules/${schedule.id}`)}
                >
                  <time>{formatTime(schedule.start_at)}</time>
                  <span className="home-agenda-item__line" />
                  <span className="home-agenda-item__content">
                    <span className="home-agenda-item__top">
                      <strong>{schedule.title}</strong>
                      <em>{schedule.status === 'completed' ? '완료' : '예정'}</em>
                    </span>
                    <span className="home-agenda-item__places">
                      {schedule.places.length > 0
                        ? schedule.places.map((place) => place.name).join(' · ')
                        : '장소 미지정'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
