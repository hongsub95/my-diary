import { Link } from 'react-router-dom'
import { useSpaces } from './SpaceContext'
import './spaces.css'

export default function SpaceSwitcher() {
  const { currentSpace } = useSpaces()
  return <Link to="/spaces" state={{ from: '/home' }} className="space-switcher" aria-label={`스페이스 전환, 현재 ${currentSpace?.name ?? '스페이스'}`}>
    <span>{currentSpace?.type === 'shared' ? '♡' : '✎'}</span>
    <strong>{currentSpace?.name ?? '스페이스 선택'}</strong><span>전환 ›</span>
  </Link>
}
