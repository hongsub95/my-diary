import { Link } from 'react-router-dom'
import { useSpaces } from './SpaceContext'
import './spaces.css'

export default function SpaceSwitcher() {
  const { currentSpace } = useSpaces()
  return <Link to="/spaces" state={{ from: '/home' }} className="space-switcher" aria-label={`공간 바꾸기, 현재 ${currentSpace?.name ?? '공간'}`}>
    <span>{currentSpace?.type === 'shared' ? '♡' : '✎'}</span>
    <strong>{currentSpace?.name ?? '공간 선택'}</strong><span>공간 바꾸기 ›</span>
  </Link>
}
