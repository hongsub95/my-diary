import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { Snackbar, useSnackbar } from '../components/Snackbar'
import ChristmasBackdrop from '../seasonal/ChristmasBackdrop'
import SeasonalGreeting from '../seasonal/SeasonalGreeting'
import { useSeasonal } from '../seasonal/SeasonalContext'
import { wearsSeason } from '../seasonal/seasonRules'
import './AppLayout.css'
import '../seasonal/seasonal.css'

/** 앱을 켠 뒤 배경 장면을 미리 그려 두기까지 기다리는 시간. 첫 화면을 먼저 그리게 한다. */
const BACKDROP_WARMUP_MS = 600

export default function AppLayout() {
  const { pathname } = useLocation()
  const isWideLayout = pathname === '/home' || pathname === '/more/collection'
  // 계절 배경은 탭 첫 화면에서만 깐다. 장면·인사는 여기 한 곳에서 그리고, 화면별 바탕과
  // 밤 글씨 색은 seasonal.css가 레이아웃 클래스를 보고 바꾼다.
  //
  // 장면은 배경이 켜져 있는 동안 계속 살려 둔다. 일정 상세처럼 배경을 입지 않는 화면에서는
  // 숨기고 눈만 멈춘다. 그 화면에 갈 때마다 없앴다가 돌아올 때 큰 그림을 처음부터 다시 만들면
  // 배경이 한 박자 늦게 떴다. 앱을 켠 직후에는 첫 화면을 먼저 그리고 조금 뒤에 미리 그려 둔다.
  const { visible, night } = useSeasonal()
  const season = visible && wearsSeason(pathname)
  const [warm, setWarm] = useState(false)
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar()

  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), BACKDROP_WARMUP_MS)
    return () => clearTimeout(timer)
  }, [])

  const classes = ['app-layout']
  if (isWideLayout) classes.push('app-layout--wide')
  if (season) classes.push('app-layout--season')
  if (season && night) classes.push('app-layout--season-night')

  return (
    <div className={classes.join(' ')}>
      <div className="app-layout__stage">
        {visible && (season || warm) && <ChristmasBackdrop night={night} active={season} />}
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
