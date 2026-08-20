import { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../shared/components/Icon'
import chevronLeftRaw from '../../assets/icons/chevron-left.svg?raw'
import chevronRightRaw from '../../assets/icons/chevron-right.svg?raw'
import plusRaw from '../../assets/icons/plus.svg?raw'
import { useSchedules } from '../../shared/api/queries'
import './calendar.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function scheduleDateKey(schedule) {
  return schedule.start_at.slice(0, 10)
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  const hour = date.getHours()
  const minute = date.getMinutes()
  const period = hour < 12 ? '오전' : '오후'
  return `${period} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const calendarRef = useRef(null)
  const navigate = useNavigate()
  const { data: schedules = [] } = useSchedules()
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today))
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  const scheduleDateKeys = useMemo(
    () => new Set(schedules.map(scheduleDateKey)),
    [schedules],
  )
  const selectedSchedules = useMemo(
    () => schedules.filter((schedule) => scheduleDateKey(schedule) === selectedDate),
    [schedules, selectedDate],
  )

  const moveMonth = (direction) => {
    const calendarApi = calendarRef.current?.getApi()
    if (!calendarApi) return

    if (direction === 'prev') calendarApi.prev()
    else calendarApi.next()
  }

  const handleDatesSet = ({ view }) => {
    const monthStart = view.currentStart
    setViewDate(monthStart)

    const selected = new Date(`${selectedDate}T00:00:00`)
    if (
      selected.getFullYear() !== monthStart.getFullYear()
      || selected.getMonth() !== monthStart.getMonth()
    ) {
      setSelectedDate(formatDateKey(monthStart))
    }
  }

  const renderDayCell = ({ date, dayNumberText, isOther }) => {
    if (isOther) return null

    const dateKey = formatDateKey(date)
    return (
      <span className="product-calendar__day-content">
        <span className="product-calendar__day-number">
          {dayNumberText.replace('일', '')}
        </span>
        <span
          aria-hidden="true"
          className={`product-calendar__schedule-dot${
            scheduleDateKeys.has(dateKey) ? ' product-calendar__schedule-dot--visible' : ''
          }`}
        />
      </span>
    )
  }

  const [, selectedMonth, selectedDay] = selectedDate.split('-').map(Number)

  return (
    <div className="calendar-page">
      <section className="calendar-header" aria-label="일정 달력">
        <div className="calendar-header__top">
          <h2 className="calendar-header__title">
            {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
          </h2>
          <div className="calendar-header__nav">
            <button
              type="button"
              onClick={() => moveMonth('prev')}
              className="calendar-nav-btn"
              aria-label="이전 달"
            >
              <Icon raw={chevronLeftRaw} size={20} />
            </button>
            <button
              type="button"
              onClick={() => moveMonth('next')}
              className="calendar-nav-btn"
              aria-label="다음 달"
            >
              <Icon raw={chevronRightRaw} size={20} />
            </button>
          </div>
        </div>

        <div className="product-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[classicThemePlugin, dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={today}
            locale="ko"
            firstDay={0}
            headerToolbar={false}
            fixedWeekCount={false}
            showNonCurrentDates={false}
            height="auto"
            datesSet={handleDatesSet}
            dateClick={({ dateStr }) => setSelectedDate(dateStr)}
            dayHeaderContent={({ date }) => WEEKDAYS[date.getDay()]}
            dayHeaderClassNames={({ date }) => [
              'product-calendar__weekday',
              date.getDay() === 0 ? 'product-calendar__weekday--sun' : '',
              date.getDay() === 6 ? 'product-calendar__weekday--sat' : '',
            ].filter(Boolean)}
            dayCellClassNames={({ date, isOther, isToday }) => {
              if (isOther) return ['product-calendar__cell--other']
              const dateKey = formatDateKey(date)
              return [
                'product-calendar__cell',
                dateKey === selectedDate ? 'product-calendar__cell--selected' : '',
                isToday ? 'product-calendar__cell--today' : '',
                date.getDay() === 0 ? 'product-calendar__cell--sun' : '',
                date.getDay() === 6 ? 'product-calendar__cell--sat' : '',
              ].filter(Boolean)
            }}
            dayCellContent={renderDayCell}
          />
        </div>
      </section>

      <div className="calendar-body">
        <div className="calendar-body__header">
          <span className="calendar-body__date-label">
            {selectedMonth}월 {selectedDay}일
          </span>
          <button
            type="button"
            onClick={() => navigate('/schedules/new')}
            className="calendar-body__add-btn"
          >
            <Icon raw={plusRaw} size={16} />
            새 일정
          </button>
        </div>

        {selectedSchedules.length === 0 ? (
          <div className="calendar-empty">
            <span className="calendar-empty__icon">📅</span>
            <p>이 날은 일정이 없어요</p>
          </div>
        ) : (
          <div className="schedule-list">
            {selectedSchedules.map((schedule) => (
              <button
                type="button"
                key={schedule.id}
                onClick={() => navigate(`/schedules/${schedule.id}`)}
                className="schedule-card"
              >
                <div className="schedule-card__content">
                  <span className={`schedule-card__badge schedule-card__badge--${schedule.status}`}>
                    {schedule.status === 'completed' ? '완료' : '예정'}
                  </span>
                  <p className="schedule-card__title">{schedule.title}</p>
                  <p className="schedule-card__meta">
                    {formatTime(schedule.start_at)} · {schedule.places.length}개 장소
                  </p>
                </div>
                <Icon raw={chevronRightRaw} size={16} className="schedule-card__arrow" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
