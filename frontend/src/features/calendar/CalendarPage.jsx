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
import { PhaseTag } from '../schedules/PhaseTag'
import { phaseKind, phaseKindLabels } from '../schedules/phase'
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

/** 참인 클래스 이름만 공백으로 잇는다. FullCalendar 7의 *Class 옵션은 배열이 아니라 문자열을 받는다. */
function classNames(...names) {
  return names.filter(Boolean).join(' ')
}

/**
 * 'YYYY-MM-DD'의 다음 날 키.
 *
 * FullCalendar 종일 이벤트의 end는 그날을 포함하지 않는다. 끝나는 날 칸까지 그리려면
 * 하루 뒤를 넘겨야 한다.
 *
 * @param {string} dateKey 'YYYY-MM-DD'
 */
function nextDateKey(dateKey) {
  // 정오로 만들어 서머타임이 있는 기기 시간대에서도 날짜가 밀리지 않게 한다.
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + 1)
  return formatDateKey(date)
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
  // 앞달에 시작해 이번 달로 넘어오는 하루도 서버가 날짜가 겹치면 함께 준다(API_SPEC 5절).
  const { data: schedules = [], isLoading, isError, refetch } = useSchedules({
    from: formatDateKey(viewDate),
    to: formatDateKey(lastDayOfMonth(viewDate)),
  })

  // 칩마다 상태 모양을 정한다. 예정과 기록을 같은 모양으로 그리면 캘린더가 "무엇이
  // 있었는지"를 알려주지 못한다(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 6절).
  const calendarEvents = useMemo(() => schedules.map((schedule) => ({
    id: String(schedule.id),
    title: schedule.title,
    // 여러 날에 걸친 하루는 시작일부터 끝나는 날까지 모든 칸에 나와야 한다
    // (CALENDAR_SCREEN_SPEC). 시작일만 넘기면 둘째 날부터 비어 보인다.
    start: schedule.date_key,
    end: nextDateKey(schedule.end_date_key),
    allDay: true,
    extendedProps: { kind: phaseKind(schedule.experience_phase) },
  })), [schedules])
  const selectedSchedules = useMemo(
    () => schedules.filter(
      (schedule) => schedule.date_key <= selectedDate && selectedDate <= schedule.end_date_key,
    ),
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

        {/* 로딩과 실패를 빈 달로 보이지 않게 한다. 실제로 하루가 있는데 비어 보이면 안 된다. */}
        {isLoading && <p className="calendar-status" role="status">일정을 불러오는 중…</p>}
        {isError && (
          <p className="calendar-status" role="alert">
            일정을 불러오지 못했어요.{' '}
            <button type="button" className="calendar-status__retry" onClick={() => refetch()}>다시 시도</button>
          </p>
        )}

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
            // 넘친 개수를 보여준다(CALENDAR_SCREEN_SPEC: 칩 최대 2개와 +N). 앱과 같은 표기다.
            moreLinkContent={({ num }) => `+${num}`}
            moreLinkClick={({ date }) => openDateDrawer(formatDateKey(date))}
            datesSet={handleDatesSet}
            dateClick={({ dateStr }) => openDateDrawer(dateStr)}
            events={calendarEvents}
            eventClick={({ event }) => openDateDrawer(event.startStr.slice(0, 10))}
            // FullCalendar 7은 옵션 이름이 *Class·*TopContent로 바뀌었고 문자열 하나를 받는다.
            // 6의 이름(eventClassNames, dayCellContent…)을 쓰면 경고 없이 무시된다. 내부 클래스도
            // 해시(fc-classic-xxx)라 CSS는 여기서 붙인 product-calendar__* 클래스만 기준으로 삼는다.
            eventClass="product-calendar__event"
            eventContent={({ event }) => {
              const { kind } = event.extendedProps
              return <PhaseTag size="chip" kind={kind} label={event.title} srLabel={`, ${phaseKindLabels[kind]}`} title={`${event.title} · ${phaseKindLabels[kind]}`} />
            }}
            moreLinkClass="product-calendar__more"
            dayHeaderContent={({ date }) => WEEKDAYS[date.getDay()]}
            dayHeaderClass={({ date }) => classNames(
              'product-calendar__weekday',
              date.getDay() === 0 && 'product-calendar__weekday--sun',
              date.getDay() === 6 && 'product-calendar__weekday--sat',
            )}
            dayCellClass={({ date, isOther, isToday }) => {
              if (isOther) return 'product-calendar__cell--other'
              return classNames(
                'product-calendar__cell',
                formatDateKey(date) === selectedDate && 'product-calendar__cell--selected',
                isToday && 'product-calendar__cell--today',
                date.getDay() === 0 && 'product-calendar__cell--sun',
                date.getDay() === 6 && 'product-calendar__cell--sat',
              )
            }}
            dayCellTopClass="product-calendar__cell-top"
            dayCellTopContent={renderDayCell}
          />
        </div>
        <div className="calendar-legend" aria-label="상태 범례">
          {['plan', 'pending', 'done'].map((kind) => <PhaseTag key={kind} size="chip" kind={kind} label={phaseKindLabels[kind]} />)}
        </div>

      </section>
      {isDrawerOpen && (
        <div className="calendar-drawer-layer">
          <button type="button" className="calendar-drawer-backdrop" aria-label="일정 목록 닫기" onClick={() => setIsDrawerOpen(false)} />
          <aside className="calendar-drawer" role="dialog" aria-modal="true" aria-label={`${selectedMonth}월 ${selectedDay}일 일정`}>
            <div className="calendar-drawer__header">
              <div><strong>{selectedMonth}월 {selectedDay}일</strong>{!isLoading && !isError && <span>{selectedSchedules.length}개의 일정</span>}</div>
              <button type="button" onClick={() => setIsDrawerOpen(false)} aria-label="닫기">×</button>
            </div>
            <div className="calendar-drawer__body">
              {isLoading ? <p className="calendar-status" role="status">일정을 불러오는 중…</p>
                : isError ? <p className="calendar-status" role="alert">일정을 불러오지 못했어요. <button type="button" className="calendar-status__retry" onClick={() => refetch()}>다시 시도</button></p>
                : selectedSchedules.length === 0 ? <EmptyState compact icon={calendarRaw} title="이날은 일정이 없어요" description="다른 날짜를 선택해 보세요." /> : (
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
