import { useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import chevronDownRaw from '../../assets/icons/chevron-down.svg?raw'
import { DateSheet } from './date-sheets/DateSheet'
import { RangeSheet } from './date-sheets/RangeSheet'
import './date-picker.css'

/**
 * 날짜 칸. 누르면 아래에서 날짜 시트가 올라온다.
 *
 * @param {object} props
 * @param {string} props.value 'YYYY-MM-DD'. 비어 있으면 "날짜 선택"
 * @param {(value: string) => void} props.onChange 하루 시트에서 고른 값
 * @param {'date'|'month'} [props.mode='date'] month면 달만 고른다(캘린더 월 이동)
 * @param {string} props.label 칸 이름(화면 읽기 도구·시트 제목)
 * @param {boolean} [props.clearable] "날짜 없음"으로 값을 비울 수 있다
 * @param {string} [props.min] / [props.max] 고를 수 있는 범위
 * @param {{start: string, end: string}} [props.range] 주면 기간 시트(B)를 연다. 시작일·종료일
 *   두 칸에 같은 값을 주면 어느 칸을 눌러도 같은 기간 시트가 열린다
 * @param {(range: {start: string, end: string}) => void} [props.onRangeChange] 기간 시트에서 적용한 값
 *
 * 쓰는 쪽은 이전 팝오버와 같은 props를 그대로 쓴다. 바뀐 것은 여는 모양뿐이다:
 * 하루는 누르면 바로 정해지는 시트(A), 기간은 세로로 이어지는 시트(B).
 */
export function DatePicker({ value, onChange, mode = 'date', label, id, name, min, max, disabled, required, clearable = false, className = '', children, range, onRangeChange }) {
  const trigger = useRef(null)
  const [open, setOpen] = useState(false)
  const generatedId = useId()
  const close = () => setOpen(false)
  const text = value
    ? mode === 'month' ? `${Number(value.slice(0, 4))}년 ${Number(value.slice(5, 7))}월` : value.replaceAll('-', '.')
    : '날짜 선택'

  return <>
    <button type="button" ref={trigger} id={id || generatedId} disabled={disabled}
      className={`date-picker-trigger ${className}`} aria-label={label} aria-required={required || undefined}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
      {children || text}
      {/* 글자 "⌄"는 기준선에 붙어 아래로 처져 보여서 아이콘으로 그린다. 버튼이 가운데 정렬한다. */}
      <Icon raw={chevronDownRaw} size={16} className="dp-caret" />
    </button>
    {name && <input type="hidden" name={name} value={value} />}
    {open && !disabled && (range
      ? <RangeSheet start={range.start} end={range.end} onApply={(next) => onRangeChange?.(next)} onClose={close} returnFocus={trigger} />
      : <DateSheet value={value} onChange={onChange} onClose={close} title={label} mode={mode} clearable={clearable} min={min} max={max} returnFocus={trigger} />)}
  </>
}
