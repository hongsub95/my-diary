import { Icon } from './Icon'
import './EmptyState.css'

/** 주요 목록과 콘텐츠 영역에서 함께 쓰는 빈 상태. */
export function EmptyState({ icon, title, description, actionLabel, onAction, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      <span className="empty-state__visual" aria-hidden="true">
        <Icon raw={icon} size={compact ? 24 : 30} />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="empty-state__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
