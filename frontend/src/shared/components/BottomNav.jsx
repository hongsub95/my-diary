import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useMenus } from '../api/queries'
import { useAuth } from '../contexts/AuthContext'
import homeRaw from '../../assets/icons/home.svg?raw'
import calendarRaw from '../../assets/icons/calendar.svg?raw'
import listRaw from '../../assets/icons/list.svg?raw'
import bookOpenRaw from '../../assets/icons/book-open.svg?raw'
import ellipsisHorizontalRaw from '../../assets/icons/ellipsis-horizontal.svg?raw'
import settingsRaw from '../../assets/icons/settings.svg?raw'
import mapPinRaw from '../../assets/icons/map-pin.svg?raw'
import userRaw from '../../assets/icons/user.svg?raw'
import './BottomNav.css'

const ICONS = {
  home: homeRaw,
  calendar: calendarRaw,
  list: listRaw,
  book: bookOpenRaw,
  'book-open': bookOpenRaw,
  records: bookOpenRaw,
  more: ellipsisHorizontalRaw,
  'more-horizontal': ellipsisHorizontalRaw,
  settings: settingsRaw,
  'map-pin': mapPinRaw,
  user: userRaw,
}

const SKELETON_ITEMS = Array.from({ length: 5 }, (_, index) => index)

export default function BottomNav() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { data: menus = [], isPending, isError, error, refetch } = useMenus()

  useEffect(() => {
    if (error?.response?.status === 401) {
      logout()
      navigate('/login', { replace: true })
    }
  }, [error, logout, navigate])

  if (isPending) {
    return (
      <nav className="bottom-nav" aria-label="주요 메뉴" aria-busy="true">
        {SKELETON_ITEMS.map((item) => (
          <span key={item} className="bottom-nav__item bottom-nav__item--skeleton" />
        ))}
      </nav>
    )
  }

  if (isError) {
    if (error?.response?.status === 401) return null

    return (
      <nav className="bottom-nav bottom-nav--error" aria-label="주요 메뉴">
        <span>메뉴를 불러오지 못했습니다.</span>
        <button type="button" onClick={() => refetch()}>다시 시도</button>
      </nav>
    )
  }

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {menus.map((menu) => (
        <NavLink
          key={menu.code}
          to={menu.path}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          <Icon raw={ICONS[menu.icon] ?? ellipsisHorizontalRaw} size={24} className="bottom-nav__icon" />
          <span className="bottom-nav__label">{menu.name}</span>
        </NavLink>
      ))}
    </nav>
  )
}
