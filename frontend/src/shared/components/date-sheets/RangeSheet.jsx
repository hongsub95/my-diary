import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { dayLabel, parseKey, periodLabel, shiftMonth, todayKey } from './dateKeys'
import { MonthGrid } from './MonthGrid'
import { useHolidays } from './useHolidays'

/** 목록에 담을 달: 시작일 앞 12달부터 뒤 24달까지. 지난 하루를 기록용으로 만들 때도 닿게 앞쪽도 둔다. */
const MONTHS_BEFORE = 12
const MONTHS_AFTER = 24

/**
 * 하루의 기간 고르기 시트 (시안 B, 유아이볼 "트립스토어"·"수현이랑" 참고). 모바일 RangeSheet와 같은 동작이다.
 *
 * @param {object} props
 * @param {string} props.start
 * @param {string} props.end
 * @param {(range: {start: string, end: string}) => void} props.onApply
 * @param {() => void} props.onClose
 * @param {React.RefObject<HTMLElement>} [props.returnFocus]
 *
 * 첫 탭이 시작, 두 번째 탭이 끝이다. 시작만 고른 채 적용하면 당일이 된다 — 대부분의
 * 하루는 하루짜리라서 같은 날을 두 번 누르게 하지 않는다. 끝을 시작보다 앞으로 누르면
 * 그 날을 새 시작으로 본다. 달은 세로로 이어지고, 열면 지금 기간이 있는 달이 맨 위에 온다.
 * 박수(당일·1박 2일)는 위쪽 요약에서 고르는 동안 보여준다.
 */
export function RangeSheet({ start, end, onApply, onClose, returnFocus }) {
  const today = todayKey()
  const initialStart = start || today
  const [period, setPeriod] = useState({ start: initialStart, end: end && end >= initialStart ? end : initialStart })
  const [awaitingEnd, setAwaitingEnd] = useState(false)
  const anchor = parseKey(initialStart)
  const months = useMemo(
    () => Array.from({ length: MONTHS_BEFORE + MONTHS_AFTER + 1 }, (_, i) => shiftMonth(anchor.year, anchor.month, i - MONTHS_BEFORE)),
    [anchor.year, anchor.month],
  )
  const holidays = useHolidays(months.map((m) => m.year))
  const anchorMonth = useRef(null)

  // 열면 시작일이 있는 달로 바로 내려간다.
  useEffect(() => { anchorMonth.current?.scrollIntoView({ block: 'start' }) }, [])

  const press = (key) => {
    if (!awaitingEnd || key < period.start) { setPeriod({ start: key, end: key }); setAwaitingEnd(true); return }
    setPeriod({ start: period.start, end: key })
    setAwaitingEnd(false)
  }
  const range = period.start === period.end ? dayLabel(period.start) : `${dayLabel(period.start)} – ${dayLabel(period.end)}`
  const summary = `${range} · ${periodLabel(period.start, period.end)}`

  return (
    <BottomSheet label="기간 고르기" onClose={onClose} tall returnFocus={returnFocus}>
      <h2 className="ds-title">기간</h2>
      <div className="ds-summary" aria-live="polite">
        <strong>{summary}</strong>
        {awaitingEnd && <span>끝나는 날을 누르거나, 하루만이면 바로 적용하세요</span>}
      </div>
      <div className="ds-scroll">
        {months.map(({ year, month }, i) => (
          <section key={`${year}-${month}`} ref={i === MONTHS_BEFORE ? anchorMonth : undefined} aria-label={`${year}년 ${month}월`}>
            <h3 className="ds-month-title">{year}년 {month}월</h3>
            <MonthGrid year={year} month={month} holidays={holidays.byDate} today={today} range={period} onPick={press} />
          </section>
        ))}
      </div>
      <div className="ds-actions">
        <button type="button" className="ds-secondary" onClick={() => { setPeriod({ start: today, end: today }); setAwaitingEnd(true) }}>초기화</button>
        <button type="button" className="ds-primary" aria-label={`${summary} 적용하기`} onClick={() => { onApply(period); onClose() }}>적용하기</button>
      </div>
    </BottomSheet>
  )
}
