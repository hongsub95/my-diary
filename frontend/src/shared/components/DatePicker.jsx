import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { Snackbar, useSnackbar } from './Snackbar'
import './date-picker.css'

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const key = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = () => key(new Date())
function inMonth(value, year, month) {
  return key(new Date(year, month - 1, Math.min(Number(value.slice(8)), new Date(year, month, 0).getDate()), 12))
}
const clamp = (value, min, max) => min && value < min ? min : max && value > max ? max : value

export function DatePicker({ value, onChange, mode = 'date', label, id, name, min, max, disabled, required, clearable = false, className = '', children }) {
  const anchor = useRef(null)
  const [open, setOpen] = useState(false)
  const generatedId = useId()
  const triggerId = id || generatedId
  const close = () => { setOpen(false); anchor.current?.focus() }
  return <>
    <button type="button" ref={anchor} id={triggerId} disabled={disabled}
      className={`date-picker-trigger ${className}`} aria-label={label} aria-required={required || undefined}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
      {children || (value ? mode === 'month' ? `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월` : mode === 'year' ? `${value.slice(0, 4)}년` : value.replaceAll('-', '.') : '날짜 선택')}
      <span aria-hidden="true" className="dp-caret">⌄</span>
    </button>
    {name && <input type="hidden" name={name} value={value} />}
    {open && !disabled && <PickerPanel anchor={anchor} value={value} onChange={onChange} selectionMode={mode} min={min} max={max} clearable={clearable} onClose={close} />}
  </>
}

function PickerPanel({ anchor, value, onChange, selectionMode, min, max, clearable, onClose }) {
  const [draft, setDraft] = useState(value || clamp(today(), min, max))
  const [view, setView] = useState(draft)
  const [mode, setMode] = useState(selectionMode)
  const [position, setPosition] = useState({ top: 0, left: 12 })
  const panel = useRef(null)
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()
  const year = Number(view.slice(0, 4)), month = Number(view.slice(5, 7))
  const yearStart = Math.floor(year / 12) * 12
  const holidays = useQuery({
    queryKey: ['calendar-holidays', 'KR', year],
    queryFn: async ({ signal }) => (await apiClient.get('/calendar/holidays', { params: { year, country: 'KR' }, signal })).data,
    staleTime: 86400000, retry: 1, enabled: mode !== 'year',
  })
  const days = Array.isArray(holidays.data?.days) ? holidays.data.days : []
  const monthDays = days.filter(day => day.date.slice(0, 7) === view.slice(0, 7))
  const byDate = new Map(days.map(day => [day.date, day.names]))
  const unavailable = holidays.isError || (!holidays.isPending && holidays.data?.coverage !== 'complete')
  useEffect(() => {
    if (mode !== 'year' && unavailable) showSnackbar('이 연도의 공휴일 정보를 확인할 수 없어요. 날짜는 선택할 수 있어요.')
  }, [unavailable, mode, year, showSnackbar])
  useLayoutEffect(() => {
    function place() {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect || !panel.current) return
      const box = panel.current.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom - 12
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12)),
        top: below >= box.height || below >= rect.top - 12 ? Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - box.height - 12)) : Math.max(12, rect.top - box.height - 8) })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor])
  useEffect(() => { panel.current?.querySelector('button:not(:disabled)')?.focus() }, [mode])
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])
  const valid = date => (!min || date >= min) && (!max || date <= max)
  const changeView = (next, nextMode) => { setView(next); if (nextMode) setMode(nextMode) }
  const choosePeriod = number => {
    const next = inMonth(view, mode === 'year' ? number : year, mode === 'month' ? number : month)
    if (mode === selectionMode) setDraft(clamp(next, min, max))
    changeView(next, mode === 'year' && selectionMode !== 'year' ? 'month' : mode === 'month' && selectionMode === 'date' ? 'date' : mode)
  }
  const navigate = step => {
    const next = mode === 'date' ? inMonth(view, year, month + step) : inMonth(view, year + step * (mode === 'year' ? 12 : 1), month)
    if (Number(next.slice(0, 4)) >= 1900 && Number(next.slice(0, 4)) <= 2100) setView(next)
  }
  const first = new Date(year, month - 1, 1, 12).getDay()
  const length = new Date(year, month, 0).getDate()
  const selectedText = selectionMode === 'date' ? draft.replaceAll('-', '.') : selectionMode === 'month' ? `${draft.slice(0, 4)}년 ${Number(draft.slice(5, 7))}월` : `${draft.slice(0, 4)}년`
  function handleKeys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    if (event.key === 'Tab') {
      const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
    if (event.target.dataset.date && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      const date = new Date(`${event.target.dataset.date}T12:00:00`)
      date.setDate(date.getDate() + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 })[event.key])
      const next = key(date)
      if (!valid(next) || date.getFullYear() < 1900 || date.getFullYear() > 2100) return
      setView(next)
      requestAnimationFrame(() => panel.current?.querySelector(`[data-date="${next}"]`)?.focus())
    }
  }
  return createPortal(<div className="dp-layer">
    <div className="dp-dismiss" onClick={onClose} />
    <div ref={panel} role="dialog" aria-modal="true" aria-label={selectionMode === 'date' ? '날짜 선택' : selectionMode === 'month' ? '월 선택' : '연도 선택'}
      className={`dp-panel ${mode === 'date' ? 'dp-panel--wide' : ''}`} style={position} onKeyDown={handleKeys}>
      <div className="dp-content">
        <section className="dp-calendar" aria-label="날짜별 달력">
          <div className="dp-heading">
            <button type="button" className="dp-arrow" aria-label={mode === 'date' ? '이전 달' : mode === 'month' ? '이전 연도' : '이전 연도 구간'} onClick={() => navigate(-1)}>‹</button>
            <div className="dp-period"><button type="button" onClick={() => setMode('year')} aria-label={`${year}년, 연도 선택`}>{mode === 'year' ? `${Math.max(1900, yearStart)}–${Math.min(2100, yearStart + 11)}` : `${year}년`} <span>⌄</span></button>
              {mode === 'date' && <button type="button" onClick={() => setMode('month')} aria-label={`${month}월, 월 선택`}>{month}월 <span>⌄</span></button>}</div>
            <button type="button" className="dp-arrow" aria-label={mode === 'date' ? '다음 달' : mode === 'month' ? '다음 연도' : '다음 연도 구간'} onClick={() => navigate(1)}>›</button>
          </div>
          {mode === 'date' ? <>
            <div className="dp-weekdays">{weekdays.map((day, i) => <span key={day} className={i === 0 ? 'dp-holiday' : i === 6 ? 'dp-saturday' : ''}>{day}</span>)}</div>
            <div className="dp-dates">{Array.from({ length: Math.ceil((first + length) / 7) * 7 }, (_, i) => {
              const day = i - first + 1
              if (day < 1 || day > length) return <span key={i} />
              const date = `${view.slice(0, 7)}-${String(day).padStart(2, '0')}`
              return <button key={i} type="button" data-date={date} disabled={!valid(date)} aria-pressed={draft === date}
                aria-label={`${year}년 ${month}월 ${day}일${byDate.has(date) ? `, ${byDate.get(date).join(', ')}` : ''}`}
                className={[draft === date && 'dp-selected', (i % 7 === 0 || byDate.has(date)) && 'dp-holiday', i % 7 === 6 && !byDate.has(date) && 'dp-saturday', date === today() && 'dp-today'].filter(Boolean).join(' ')} onClick={() => setDraft(date)}>{day}</button>
            })}</div>
          </> : <div className={`dp-grid ${mode === 'month' ? 'dp-months' : ''}`}>{Array.from({ length: 12 }, (_, i) => mode === 'year' ? yearStart + i : i + 1).map(number => {
            const start = mode === 'year' ? `${number}-01-01` : `${year}-${String(number).padStart(2, '0')}-01`
            const end = mode === 'year' ? `${number}-12-31` : key(new Date(year, number, 0, 12))
            const disabled = number < (mode === 'year' ? 1900 : 1) || number > (mode === 'year' ? 2100 : 12) || (min && end < min) || (max && start > max)
            const count = holidays.data?.months?.find(item => item.month === number)
            const selected = number === Number(draft.slice(mode === 'year' ? 0 : 5, mode === 'year' ? 4 : 7)) && (mode === 'year' || year === Number(draft.slice(0, 4)))
            return <button key={number} type="button" disabled={disabled} aria-pressed={selected} className={selected ? 'dp-selected' : ''} onClick={() => choosePeriod(number)}><strong>{number}{mode === 'year' ? '년' : '월'}</strong>{mode === 'month' && <small>{holidays.isPending ? '확인 중…' : count?.status === 'ready' && count.count !== null ? `공휴일 ${count.count}일` : '정보 없음'}</small>}</button>
          })}</div>}
        </section>
        {mode === 'date' && <section className="dp-holidays" aria-label={`${year}년 ${month}월 공휴일 목록`}>
          <div className="dp-holiday-heading"><span>PUBLIC HOLIDAYS</span><h3>{year}년 {month}월 공휴일</h3><p>일반 토·일요일은 제외해요.</p></div>
          <div className="dp-holiday-list" aria-live="polite">{holidays.isPending ? <p>공휴일을 확인하고 있어요.</p> : unavailable ? <><p>이 연도의 공휴일 정보가 없어요.</p><button type="button" onClick={() => holidays.refetch()}>다시 확인</button></> : !monthDays.length ? <p>이번 달에는 공휴일이 없어요.</p> : monthDays.map(day => <button type="button" key={day.date} disabled={!valid(day.date)} aria-pressed={draft === day.date} className={draft === day.date ? 'dp-holiday-active' : ''} onClick={() => setDraft(day.date)}><time dateTime={day.date}>{Number(day.date.slice(8))}<small>{weekdays[new Date(`${day.date}T12:00:00`).getDay()]}</small></time><span>{day.names.join(' · ')}{day.kind !== 'public' && <small>{({ substitute: '대체공휴일', temporary: '임시공휴일', election: '선거일' })[day.kind]}</small>}</span><span aria-hidden="true">↗</span></button>)}</div>
          {holidays.data?.is_stale && <p className="dp-source">마지막 확인 자료를 표시하고 있어요.</p>}
        </section>}
      </div>
      <div className="dp-footer"><span aria-live="polite">{selectedText}</span><div>{clearable && <button type="button" onClick={() => { onChange(''); onClose() }}>해제</button>}<button type="button" onClick={onClose}>취소</button><button type="button" className="dp-apply" disabled={!valid(draft)} onClick={() => { onChange(draft); onClose() }}>적용</button></div></div>
    </div>
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </div>, document.body)
}
