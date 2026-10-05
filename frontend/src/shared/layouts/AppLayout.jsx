import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import './AppLayout.css'
import SpaceSwitcher from '../../features/spaces/SpaceSwitcher'

export default function AppLayout() {
  const { pathname } = useLocation()
  const isWideLayout = pathname === '/home' || pathname === '/more/collection'

  return (
    <div className={`app-layout${isWideLayout ? ' app-layout--wide' : ''}`}>
      <main className="app-layout__content">
        {['/calendar', '/schedules', '/records', '/more/collection'].includes(pathname) && <div style={{ padding: '16px 20px 0' }}><SpaceSwitcher /></div>}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
