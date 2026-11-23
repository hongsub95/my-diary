import { DatePicker } from '../../shared/components/DatePicker'
import { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import classicThemePlugin from '@fullcalendar/react/themes/classic'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/classic/theme.css'
import '@fullcalendar/react/themes/classic/palette.css'
import { Icon } from '../../shared/components/Icon'
import chevronLeftRaw from '../../assets/icons/chevron-left.svg?raw'
import chevronRightRaw from '../../assets/icons/chevron-right.svg?raw'
import { useSchedules } from '../../shared/api/queries'
import { phaseKind, phaseKindLabels } from '../schedules/phase'
import { DayAgenda } from './DayAgenda'
import './calendar.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_NAMES = WEEKDAYS.map((day) => `${day}요일`)

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

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const calendarRef = useRef(null)
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(today))
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  // 서랍을 오른쪽으로 미는 중인 거리(px). null이면 손대지 않은 상태다.
  const [drawerDrag, setDrawerDrag] = useState(null)
  const dragStart = useRef(null)
  // 밀기가 끝난 직후의 클릭은 무시한다. 카드 위에서 손을 떼면 그 카드로 넘어가 버린다.
  const justDragged = useRef(false)
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
            <DatePicker mode="month" label="월 이동" value={formatDateKey(viewDate)} onChange={date => calendarRef.current?.getApi().gotoDate(date)} />
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
            // 칸 높이에 들어가는 만큼 막대를 쌓고 넘치면 +N(앱 MonthEventGrid와 같은 규칙).
            dayMaxEvents
            moreLinkContent={({ num }) => `+${num}`}
            moreLinkClick={({ date, view }) => {
              openDateDrawer(formatDateKey(date))
              // FC7은 반환값이 없으면 기본 팝오버도 연다. 현재 뷰를 유지하고 날짜 패널만 쓴다.
              return view.type
            }}
            datesSet={handleDatesSet}
            dateClick={({ dateStr }) => openDateDrawer(dateStr)}
            events={calendarEvents}
            eventClick={({ event }) => openDateDrawer(event.startStr.slice(0, 10))}
            // FullCalendar 7은 옵션 이름이 *Class·*TopContent로 바뀌었고 문자열 하나를 받는다.
            // 6의 이름(eventClassNames, dayCellContent…)을 쓰면 경고 없이 무시된다. 내부 클래스도
            // 해시(fc-classic-xxx)라 CSS는 여기서 붙인 product-calendar__* 클래스만 기준으로 삼는다.
            // 하루는 막대로 그린다(2026-11-23 시안). 여러 날 하루는 FullCalendar가 이어진 막대로
            // 그리고, 다른 주로 이어지는 쪽은 모서리를 각지게 둔다.
            eventClass={({ event, isStart, isEnd }) => classNames(
              'product-calendar__event',
              `product-calendar__event--${event.extendedProps.kind}`,
              !isStart && 'product-calendar__event--open-left',
              !isEnd && 'product-calendar__event--open-right',
            )}
            eventContent={({ event }) => {
              const { kind } = event.extendedProps
              return (
                <span className="product-calendar__bar" title={`${event.title} · ${phaseKindLabels[kind]}`}>
                  {event.title}<span className="product-calendar__sr">, {phaseKindLabels[kind]}</span>
                </span>
              )
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
              // 오늘은 숫자 색만 바꾼다. 고른 날 표시는 두지 않는다 — 누르면 바로 서랍이 열린다.
              return classNames(
                'product-calendar__cell',
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
          {['plan', 'pending', 'done'].map((kind) => (
            <span key={kind} className="calendar-legend__item">
              <i aria-hidden="true" className={`calendar-legend__bar product-calendar__event--${kind}`} />{phaseKindLabels[kind]}
            </span>
          ))}
        </div>

      </section>
      {isDrawerOpen && (
        <div className="calendar-drawer-layer">
          <button type="button" className="calendar-drawer-backdrop" aria-label="일정 목록 닫기" onClick={() => setIsDrawerOpen(false)} />
          {/* 서랍은 오른쪽에서 열리고 오른쪽으로 밀면 닫힌다(앱·웹 옆 서랍 공통 규칙). */}
          <aside
            className="calendar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedMonth}월 ${selectedDay}일 일정`}
            style={drawerDrag ? { transform: `translateX(${drawerDrag}px)`, transition: 'none' } : undefined}
            onPointerDown={(event) => { dragStart.current = { x: event.clientX, y: event.clientY, width: event.currentTarget.offsetWidth } }}
            onPointerMove={(event) => {
              const start = dragStart.current
              if (!start) return
              const dx = event.clientX - start.x
              // 세로로 움직이면 목록 스크롤로 보고 잡지 않는다.
              if (drawerDrag === null && (dx < 10 || Math.abs(dx) < Math.abs(event.clientY - start.y) * 1.5)) return
              setDrawerDrag(Math.max(0, dx))
            }}
            onPointerUp={() => {
              const start = dragStart.current
              dragStart.current = null
              if (drawerDrag === null) return
              justDragged.current = true
              if (drawerDrag > start.width * 0.25) setIsDrawerOpen(false)
              setDrawerDrag(null)
            }}
            onClickCapture={(event) => {
              if (!justDragged.current) return
              justDragged.current = false
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerCancel={() => { dragStart.current = null; setDrawerDrag(null) }}
          >
            <div className="calendar-drawer__header">
              <div><strong>{selectedMonth}월 {selectedDay}일 {WEEKDAY_NAMES[new Date(`${selectedDate}T12:00:00`).getDay()]}</strong>{!isLoading && !isError && <span>하루 {selectedSchedules.length}개</span>}</div>
              <button type="button" onClick={() => setIsDrawerOpen(false)} aria-label="닫기">×</button>
            </div>
            {/* 앱과 같은 상태별 요약 카드(CALENDAR_SCREEN_SPEC 2026-10-15). 카드에 장소가 필요해서
                그날 하루를 장소까지 따로 조회한다. 로딩·실패·빈 날도 DayAgenda가 보여준다. */}
            <div className="calendar-drawer__body">
              <DayAgenda day={selectedDate} />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
