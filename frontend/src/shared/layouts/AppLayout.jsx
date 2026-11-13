import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { Snackbar, useSnackbar } from '../components/Snackbar'
import ChristmasBackdrop from '../seasonal/ChristmasBackdrop'
import SeasonalGreeting from '../seasonal/SeasonalGreeting'
import { useSeasonal } from '../seasonal/SeasonalContext'
import { wearsSeason } from '../seasonal/seasonRules'
import './AppLayout.css'
import '../seasonal/seasonal.css'

export default function AppLayout() {
  const { pathname } = useLocation()
  const isWideLayout = pathname === '/home' || pathname === '/more/collection'
  // 계절 배경은 탭 첫 화면에서만 깐다. 장면·인사는 여기 한 곳에서 그리고, 화면별 바탕과
  // 밤 글씨 색은 seasonal.css가 레이아웃 클래스를 보고 바꾼다.
  const { visible, night } = useSeasonal()
  const season = visible && wearsSeason(pathname)
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()

  const classes = ['app-layout']
  if (isWideLayout) classes.push('app-layout--wide')
  if (season) classes.push('app-layout--season')
  if (season && night) classes.push('app-layout--season-night')

  return (
    <div className={classes.join(' ')}>
      <div className="app-layout__stage">
        {season && <ChristmasBackdrop night={night} />}
        {season && <SeasonalGreeting onNotice={showSnackbar} />}
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </div>
  )
}
