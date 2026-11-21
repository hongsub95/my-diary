import { monthShape, shiftDay, toKey, WEEKDAYS } from './dateKeys'

/**
 * 한 달 칸. 하루 시트(A)와 기간 시트(B)가 같은 모양을 쓴다. 모바일 MonthGrid와 같은 규칙이다.
 *
 * @param {object} props
 * @param {number} props.year
 * @param {number} props.month
 * @param {Map<string, string[]>} props.holidays 날짜 → 공휴일 이름
 * @param {string} props.today
 * @param {(key: string) => void} props.onPick
 * @param {string} [props.selected] 하나만 고르는 시트의 고른 날
 * @param {{start: string, end: string}} [props.range] 기간 시트의 시작·끝. 사이는 옅은 띠
 * @param {(key: string) => boolean} [props.isDisabled] 고를 수 없는 날(min·max 밖)
 * @param {boolean} [props.showWeekdays=true]
 *
 * 일요일·공휴일은 빨간 글씨, 토요일은 파란 글씨, 오늘은 테마 색 테두리, 고른 날은 테마 색
 * 바탕이다. 칸 이름에 공휴일과 "오늘"을 함께 읽어 준다 — 색만으로는 전달되지 않는다.
 * 방향키로 하루·한 주씩 초점을 옮긴다. 달 끝을 넘으면 onEdge로 부모가 달을 넘긴다.
 */
export function MonthGrid({ year, month, holidays, today, onPick, selected, range, isDisabled = () => false, showWeekdays = true, onEdge }) {
  const { firstWeekday, length, rows } = monthShape(year, month)

  function handleKey(event) {
    const key = event.target.dataset?.date
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (!key || !step) return
    event.preventDefault()
    const next = shiftDay(key, step)
    if (isDisabled(next)) return
    const grid = event.currentTarget
    const cell = grid.querySelector(`[data-date="${next}"]`) || grid.ownerDocument.querySelector(`.ds-sheet [data-date="${next}"]`)
    if (cell) { cell.focus(); return }
    onEdge?.(next)
  }

  return (
    <div className="ds-month">
      {showWeekdays && (
        <div className="ds-weekdays" aria-hidden="true">
          {WEEKDAYS.map((name, i) => <span key={name} className={i === 0 ? 'ds-sun' : i === 6 ? 'ds-sat' : ''}>{name}</span>)}
        </div>
      )}
      <div className="ds-days" onKeyDown={handleKey}>
        {Array.from({ length: rows * 7 }, (_, i) => {
          const day = i - firstWeekday + 1
          if (day < 1 || day > length) return <span key={i} className="ds-day ds-day--empty" />
          const key = toKey(year, month, day)
          const weekday = i % 7
          const holiday = holidays.get(key)
          const edge = range ? key === range.start || key === range.end : key === selected
          const single = range ? range.start === range.end : true
          const inside = range ? key > range.start && key < range.end : false
          const classes = ['ds-day',
            (weekday === 0 || holiday) && 'ds-sun', weekday === 6 && !holiday && 'ds-sat',
            key === today && 'ds-today', edge && 'ds-picked',
            range && (inside || (edge && !single)) && 'ds-band',
            range && !single && key === range.start && 'ds-band--start', range && !single && key === range.end && 'ds-band--end',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              type="button"
              data-date={key}
              className={classes}
              disabled={isDisabled(key)}
              aria-pressed={edge}
              aria-label={`${year}년 ${month}월 ${day}일 ${WEEKDAYS[weekday]}요일${holiday ? `, ${holiday.join(', ')}` : ''}${key === today ? ', 오늘' : ''}`}
              onClick={() => onPick(key)}
            >
              <span className="ds-num">{day}</span>
              {holiday && <small className="ds-holiday-name">{holiday[0]}</small>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
