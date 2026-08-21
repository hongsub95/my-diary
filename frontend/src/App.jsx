import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './shared/contexts/AuthContext'
import SplashScreen from './shared/components/SplashScreen'
import AppLayout from './shared/layouts/AppLayout'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import HomePage from './features/home/HomePage'
import CalendarPage from './features/calendar/CalendarPage'
import ScheduleListPage from './features/schedules/ScheduleListPage'
import ScheduleDetailPage from './features/schedules/ScheduleDetailPage'
import ScheduleNewPage from './features/schedules/ScheduleNewPage'
import MorePage from './features/more/MorePage'
import PrototypeLab from './features/prototype/PrototypeLab'

/** 로그인해야 볼 수 있는 화면을 감싼다. 확인이 끝나기 전에는 판단을 미룬다. */
function PrivateRoute({ children }) {
  const { status } = useAuth()
  // loading을 비로그인으로 취급하면 새로고침할 때마다 로그인 화면이 번쩍이고
  // 보던 주소를 잃는다. 확인이 끝날 때까지 기다린다.
  if (status === 'loading') return <SplashScreen />
  return status === 'authenticated' ? children : <Navigate to="/login" replace />
}

/** 로그인·회원가입 화면. 이미 로그인한 사용자는 서비스 화면으로 보낸다. */
function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  if (status === 'loading') return <SplashScreen />
  return status === 'authenticated' ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/prototype" element={<PrototypeLab />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="schedules" element={<ScheduleListPage />} />
        <Route path="schedules/new" element={<ScheduleNewPage />} />
        <Route path="schedules/:id" element={<ScheduleDetailPage />} />
        <Route path="more" element={<MorePage />} />
        {/* 설정은 더보기로 흡수됐다. 예전 주소나 북마크로 들어와도 끊기지 않도록
            당분간 리다이렉트로 남겨둔다 (docs/BOTTOM_NAVIGATION_SPEC.md 5.1절). */}
        <Route path="settings" element={<Navigate to="/more" replace />} />
      </Route>
    </Routes>
  )
}
