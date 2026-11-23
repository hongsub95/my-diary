import { useState } from 'react'
import { Icon } from '../Icon'
import chevronDownRaw from '../../../assets/icons/chevron-down.svg?raw'
import { BottomSheet } from './BottomSheet'
import { parseKey, shiftMonth, toKey, todayKey } from './dateKeys'
import { MonthGrid } from './MonthGrid'
import { useHolidays } from './useHolidays'

/**
 * 하루 고르기 시트 (시안 A, 유아이볼 "에이닷" 참고). 모바일 DateSheet와 같은 동작이다.
 *
 * @param {object} props
 * @param {string} props.value 지금 값('YYYY-MM-DD'). 비어 있으면 오늘 달을 연다
 * @param {(value: string) => void} props.onChange
 * @param {() => void} props.onClose
 * @param {string} [props.title='날짜']
 * @param {'date'|'month'} [props.mode='date'] month면 달만 고른다(1일로 돌려준다)
 * @param {boolean} [props.clearable] "날짜 없음"으로 값을 비울 수 있다
 * @param {string} [props.min] 이보다 앞 날짜는 고를 수 없다
 * @param {string} [props.max] 이보다 뒤 날짜는 고를 수 없다
 * @param {React.RefObject<HTMLElement>} [props.returnFocus] 닫으면 초점을 돌려줄 버튼
 *
 * 날짜를 누르는 순간 정해지고 닫힌다. 하루를 고르는 화면은 대부분 고른 뒤 바로 다음 칸으로
 * 넘어가서, 확인 단계가 있으면 매번 한 번씩 더 누르게 된다. 가운데 "년 ⌄ 월 ⌄"를 누르면
 * 연도·달 고르기로 바뀐다. 달 칸에는 그 달 공휴일 수를 함께 쓴다.
 */
export function DateSheet({ value, onChange, onClose, title = '날짜', mode = 'date', clearable, min, max, returnFocus }) {
  const today = todayKey()
  const start = parseKey(value || today)
  const [cursor, setCursor] = useState({ year: start.year, month: start.month })
  const [view, setView] = useState(mode)
  const holidays = useHolidays([cursor.year])
  const valid = (key) => (!min || key >= min) && (!max || key <= max)
  const pick = (key) => { onChange(key); onClose() }
  const yearStart = Math.floor(cursor.year / 12) * 12
  const thisMonth = toKey(parseKey(today).year, parseKey(today).month, 1)

  const move = (step) => {
    if (view === 'date') { setCursor(shiftMonth(cursor.year, cursor.month, step)); return }
    const year = cursor.year + step * (view === 'year' ? 12 : 1)
    if (year >= 1900 && year <= 2100) setCursor({ ...cursor, year })
  }
  const unit = view === 'date' ? '달' : view === 'month' ? '연도' : '연도 구간'

  return (
    <BottomSheet label={`${title} 고르기`} onClose={onClose} returnFocus={returnFocus}>
      <div className="ds-head">
        <h2 className="ds-title">{title}</h2>
        <div className="ds-chips">
          {clearable && <button type="button" className="ds-chip ds-chip--quiet" onClick={() => pick('')}>날짜 없음</button>}
          <button type="button" className="ds-chip" disabled={!valid(mode === 'month' ? thisMonth : today)} onClick={() => pick(mode === 'month' ? thisMonth : today)}>
            {mode === 'month' ? '이번 달' : '오늘'}
          </button>
        </div>
      </div>

      <div className="ds-nav">
        <button type="button" className="ds-arrow" aria-label={`이전 ${unit}`} onClick={() => move(-1)}>‹</button>
        <div className="ds-nav-titles">
          <button type="button" className="ds-nav-title" aria-label={`${cursor.year}년, 연도 고르기`} onClick={() => setView('year')}>
            {view === 'year' ? `${Math.max(1900, yearStart)}–${Math.min(2100, yearStart + 11)}` : `${cursor.year}년`}<Icon raw={chevronDownRaw} size={13} className="ds-caret" />
          </button>
          {view === 'date' && (
            <button type="button" className="ds-nav-title" aria-label={`${cursor.month}월, 달 고르기`} onClick={() => setView('month')}>
              {cursor.month}월<Icon raw={chevronDownRaw} size={13} className="ds-caret" />
            </button>
          )}
        </div>
        <button type="button" className="ds-arrow" aria-label={`다음 ${unit}`} onClick={() => move(1)}>›</button>
      </div>

      {view === 'date' ? (
        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          holidays={holidays.byDate}
          today={today}
          selected={value}
          isDisabled={(key) => !valid(key)}
          onPick={pick}
          onEdge={(next) => { const { year, month } = parseKey(next); setCursor({ year, month }) }}
        />
      ) : (
        <div className="ds-grid">
          {Array.from({ length: 12 }, (_, i) => (view === 'year' ? yearStart + i : i + 1)).map((number) => {
            const first = view === 'year' ? `${number}-01-01` : toKey(cursor.year, number, 1)
            const last = view === 'year' ? `${number}-12-31` : toKey(cursor.year, number, new Date(cursor.year, number, 0).getDate())
            const disabled = (view === 'year' && (number < 1900 || number > 2100)) || (min && last < min) || (max && first > max)
            const selected = view === 'year' ? number === cursor.year : number === cursor.month
            const count = view === 'month' ? holidays.monthCount(cursor.year, number) : null
            return (
              <button
                key={number}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={view === 'year' ? `${number}년` : `${cursor.year}년 ${number}월${count ? `, 공휴일 ${count}일` : ''}`}
                className={`ds-grid-cell${selected ? ' ds-grid-cell--picked' : ''}`}
                onClick={() => {
                  if (view === 'year') { setCursor({ ...cursor, year: number }); setView('month'); return }
                  if (mode === 'month') { pick(toKey(cursor.year, number, 1)); return }
                  setCursor({ ...cursor, month: number })
                  setView('date')
                }}
              >
                <strong>{number}{view === 'year' ? '년' : '월'}</strong>
                {view === 'month' && count > 0 && <small>공휴일 {count}일</small>}
              </button>
            )
          })}
        </div>
      )}

      {holidays.unavailable && <p className="ds-note" role="status">이 연도의 공휴일 정보를 확인할 수 없어요. 날짜는 고를 수 있어요.</p>}
      <button type="button" className="ds-close" onClick={onClose}>닫기</button>
      {view === 'date' && <p className="ds-hint">날짜를 누르면 바로 정해져요</p>}
    </BottomSheet>
  )
}
