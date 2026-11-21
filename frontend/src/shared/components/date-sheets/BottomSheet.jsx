import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './date-sheets.css'

/**
 * 아래에서 올라오는 날짜 시트의 틀.
 *
 * @param {{label: string, onClose: () => void, tall?: boolean, returnFocus?: React.RefObject<HTMLElement>, children: React.ReactNode}} props
 *
 * 누른 칸 옆에 뜨던 팝오버를 대신한다. 늘 같은 자리(화면 아래)에서 올라와 손가락으로
 * 닿기 쉽고, 화면 아래쪽 칸에서 열어도 위로 뒤집히지 않는다. 데스크톱에서는 앱 기둥 폭
 * (480px)으로 가운데에 둔다.
 *
 * 키보드: Esc로 닫고, Tab은 시트 안에서만 돈다. 닫으면 연 버튼으로 초점을 돌려준다.
 */
export function BottomSheet({ label, onClose, tall = false, returnFocus, children }) {
  const panel = useRef(null)

  useEffect(() => {
    const opener = returnFocus?.current
    // 처음 초점은 고른 날짜(없으면 첫 버튼)에 둔다. 화면 읽기 도구가 바로 달력부터 읽는다.
    const target = panel.current?.querySelector('[aria-pressed="true"][data-date]') || panel.current?.querySelector('button:not(:disabled)')
    target?.focus()
    return () => opener?.focus()
  }, [returnFocus])

  function handleKeys(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (event.key !== 'Tab') return
    const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
  }

  return createPortal(
    <div className="ds-layer">
      <div className="ds-dim" aria-hidden="true" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} className={`ds-sheet${tall ? ' ds-sheet--tall' : ''}`} onKeyDown={handleKeys}>
        <div className="ds-grab" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
