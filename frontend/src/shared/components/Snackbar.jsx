import { useCallback, useEffect, useState } from 'react'
import './snackbar.css'

/**
 * @returns {{notice: object|null, showSnackbar: (message: string, action?: {label: string, onClick: () => void}) => void, dismissSnackbar: () => void}}
 *
 * action은 안내 옆에 붙는 동작 하나다. 예: 크리스마스 배경을 끈 뒤 "되돌리기".
 */
export function useSnackbar() {
  const [notice, setNotice] = useState(null)
  const showSnackbar = useCallback((message, action) => setNotice({ message, action }), [])
  const dismissSnackbar = useCallback(() => setNotice(null), [])
  return { notice, showSnackbar, dismissSnackbar }
}

export function Snackbar({ notice, onDismiss }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (!notice || paused) return undefined
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [notice, paused, onDismiss])
  return <div className="snackbar-host" aria-live="polite" aria-atomic="true">
    {notice && <div className="snackbar" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <span>{notice.message}</span>
      {notice.action && (
        <button type="button" className="snackbar__action" onClick={() => { setPaused(false); notice.action.onClick(); onDismiss() }}>{notice.action.label}</button>
      )}
      <button type="button" aria-label="안내 닫기" onClick={() => { setPaused(false); onDismiss() }}>닫기</button>
    </div>}
  </div>
}
