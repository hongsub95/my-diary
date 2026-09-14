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
import { EmptyState } from '../../shared/components/EmptyState'
import calendarRaw from '../../assets/icons/calendar.svg?raw'
import chevronLeftRaw from '../../assets/icons/chevron-left.svg?raw'
import chevronRightRaw from '../../assets/icons/chevron-right.svg?raw'
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

function lastDayOfMonth(monthStart) {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
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
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today))
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  // 보고 있는 달만 받아온다. 달을 넘기면 그 달을 다시 조회한다.
  const { data: schedules = [] } = useSchedules({
    from: formatDateKey(viewDate),
    to: formatDateKey(lastDayOfMonth(viewDate)),
  })

  // 날짜마다 어떤 점을 찍을지 정한다. 예정과 기록을 같은 점으로 표시하면 캘린더가
  // "무엇이 있었는지"를 알려주지 못한다(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 6절).
  //
  // 한 날짜에 여러 하루가 있으면 더 손이 가는 쪽을 남긴다. 기록 대기는 사용자가
  // 아직 할 일이 있다는 뜻이라 가장 앞에 둔다.
  const calendarEvents = useMemo(() => schedules.map((schedule) => ({
    id: String(schedule.id),
    title: schedule.title,
    start: schedule.date_key,
    allDay: true,
    extendedProps: {
      kind: schedule.experience_phase === 'record_pending'
        ? 'pending'
        : schedule.experience_phase === 'recorded' ? 'recorded' : 'planned',
    },
  })), [schedules])
  const selectedSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.date_key === selectedDate),
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

  const renderDayCell = ({ dayNumberText, isOther }) => {
    if (isOther) return null
    return (
      <span className="product-calendar__day-content">
        <span className="product-calendar__day-number">
          {dayNumberText.replace('일', '')}
        </span>
      </span>
    )
  }

  const openDateDrawer = (dateKey) => {
    setSelectedDate(dateKey)
    setIsDrawerOpen(true)
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
            height="100%"
            expandRows
            dayMaxEvents={2}
            moreLinkContent={() => '…'}
            moreLinkClick={({ date }) => openDateDrawer(formatDateKey(date))}
            datesSet={handleDatesSet}
            dateClick={({ dateStr }) => openDateDrawer(dateStr)}
            events={calendarEvents}
            eventClick={({ event }) => openDateDrawer(event.startStr.slice(0, 10))}
            eventClassNames={({ event }) => [`product-calendar__event--${event.extendedProps.kind}`]}
            eventContent={({ event }) => <span title={event.title}>{event.title}</span>}
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
      {isDrawerOpen && (
        <div className="calendar-drawer-layer">
          <button type="button" className="calendar-drawer-backdrop" aria-label="일정 목록 닫기" onClick={() => setIsDrawerOpen(false)} />
          <aside className="calendar-drawer" role="dialog" aria-modal="true" aria-label={`${selectedMonth}월 ${selectedDay}일 일정`}>
            <div className="calendar-drawer__header">
              <div><strong>{selectedMonth}월 {selectedDay}일</strong><span>{selectedSchedules.length}개의 일정</span></div>
              <button type="button" onClick={() => setIsDrawerOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="calendar-drawer__body">
              {selectedSchedules.length === 0 ? <EmptyState compact icon={calendarRaw} title="이날은 일정이 없어요" description="다른 날짜를 선택해 보세요." /> : (
                <div className="schedule-list">{selectedSchedules.map((schedule) => (
                  <button type="button" key={schedule.id} onClick={() => navigate(`/schedules/${schedule.id}`)} className="schedule-card">
                    <div className="schedule-card__content"><span className={`schedule-card__badge schedule-card__badge--${schedule.status}`}>{schedule.status === 'completed' ? '완료' : '예정'}</span><p className="schedule-card__title">{schedule.title}</p><p className="schedule-card__meta">{formatTime(schedule.start_at)} · {schedule.place_count}개 장소</p></div>
                    <Icon raw={chevronRightRaw} size={16} className="schedule-card__arrow" />
                  </button>
                ))}</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
