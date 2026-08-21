import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import './AppLayout.css'

export default function AppLayout() {
  const { pathname } = useLocation()
  const isWideLayout = pathname === '/home'

  return (
    <div className={`app-layout${isWideLayout ? ' app-layout--wide' : ''}`}>
      <main className="app-layout__content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
