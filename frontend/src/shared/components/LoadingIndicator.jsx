import { DotPulse, Ring } from 'ldrs/react'
import 'ldrs/react/DotPulse.css'
import 'ldrs/react/Ring.css'
import './LoadingIndicator.css'

/** Inline labels omit role="status" so their text remains the button's accessible name. */
export default function LoadingIndicator({ children = '불러오고 있어요.', variant = 'dots', inline = false }) {
  return (
    <span className={`loading-indicator loading-indicator--${variant}${inline ? ' loading-indicator--inline' : ''}`} role={inline ? undefined : 'status'} aria-live="polite" aria-atomic="true">
      <span className="loading-indicator__animation" aria-hidden="true">
        {variant === 'ring'
          ? <Ring size={18} stroke={2} speed={1.6} bgOpacity={0.2} color="currentColor" />
          : <DotPulse size={28} speed={1.5} color="currentColor" />}
      </span>
      <span>{children}</span>
    </span>
  )
}
