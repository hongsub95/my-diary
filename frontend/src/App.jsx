import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './shared/contexts/AuthContext'
import AppLayout from './shared/layouts/AppLayout'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import CalendarPage from './features/calendar/CalendarPage'
import ScheduleListPage from './features/schedules/ScheduleListPage'
import ScheduleDetailPage from './features/schedules/ScheduleDetailPage'
import ScheduleNewPage from './features/schedules/ScheduleNewPage'
import MorePage from './features/more/MorePage'
import PrototypeLab from './features/prototype/PrototypeLab'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/prototype" element={<PrototypeLab />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/calendar" replace />} />
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
