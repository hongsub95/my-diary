import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './spaces.css'

export function SpaceFrame({ title, back = '/spaces', children }) {
  return <main className="spaces-page">
    <header className="spaces-header"><Link to={back} aria-label="뒤로 가기">‹</Link><h1>{title}</h1><span /></header>
    <div className="spaces-body">{children}</div>
  </main>
}

export function SpaceBadge({ space }) {
  return <span className="space-symbol" aria-hidden="true">{space.type === 'personal' ? '✎' : space.icon === 'friends' ? '♧' : '♡'}</span>
}

export function SpaceConfirm({ confirmation, busy, onClose }) {
  const panel = useRef(null)
  useEffect(() => {
    if (!confirmation) return
    const previous = document.activeElement
    panel.current?.querySelector('button')?.focus()
    return () => previous?.focus()
  }, [confirmation])
  if (!confirmation) return null
  return <div className="space-confirm-backdrop">
    <section ref={panel} className="space-confirm" role="dialog" aria-modal="true" aria-labelledby="space-confirm-title" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose()
      if (event.key === 'Tab') {
        const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
        if (!buttons.length) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus() }
        if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus() }
      }
    }}>
      <h2 id="space-confirm-title">{confirmation.title}</h2><p>{confirmation.message}</p>
      <div className="space-actions"><button type="button" className="space-button" disabled={busy} onClick={onClose}>{confirmation.cancelLabel ?? '취소'}</button>
        <button type="button" className="space-button space-button--danger" disabled={busy} onClick={confirmation.onConfirm}>{busy ? '처리 중…' : confirmation.label}</button></div>
    </section>
  </div>
}
