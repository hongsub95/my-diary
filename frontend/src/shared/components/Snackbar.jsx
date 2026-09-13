import { useCallback, useEffect, useState } from 'react'
import './snackbar.css'

export function useSnackbar() {
  const [notice, setNotice] = useState(null)
  const showSnackbar = useCallback(message => setNotice({ message }), [])
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
      <button type="button" aria-label="안내 닫기" onClick={() => { setPaused(false); onDismiss() }}>닫기</button>
    </div>}
  </div>
}
