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
import SchedulePlanPage from './features/schedules/SchedulePlanPage'
import MorePage from './features/more/MorePage'
import ProfileEditPage from './features/more/ProfileEditPage'
import PasswordChangePage from './features/more/PasswordChangePage'
import AccountDeletePage from './features/more/AccountDeletePage'
import ThemePage from './features/more/ThemePage'
import RecordsPage from './features/records/RecordsPage'
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
      {/* 하루 만들기는 하단 탭 밖에 둔다. 작성 중에는 탭을 숨긴다는 요구사항
          (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.2절)에 따른 것이다. 탭이 보이면
          작성 도중 다른 화면으로 새어 나가 입력이 사라진다. */}
      <Route path="/schedules/new" element={<PrivateRoute><ScheduleNewPage /></PrivateRoute>} />
      <Route path="/schedules/:id/plan" element={<PrivateRoute><SchedulePlanPage /></PrivateRoute>} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        {/* 로그인 후 첫 화면은 홈이다. 프로토타입(/prototype)은 디자인 검증용으로만 남긴다. */}
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="schedules" element={<ScheduleListPage />} />
        <Route path="schedules/:id" element={<ScheduleDetailPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="more" element={<MorePage />} />
        {/* 더보기 하위 화면은 탭 안에 둔다. 짧은 설정 폼이라 작성 도중 빠져나갈 위험이
            적고, 탭이 남아 있어야 돌아나가는 길이 하나 더 생긴다. 탭을 숨기는 것은
            하루 만들기처럼 긴 작성 흐름에만 적용한다
            (docs/BOTTOM_NAVIGATION_SPEC.md 7절 — 화면별로 정하도록 열려 있다). */}
        <Route path="more/profile" element={<ProfileEditPage />} />
        <Route path="more/password" element={<PasswordChangePage />} />
        <Route path="more/theme" element={<ThemePage />} />
        <Route path="more/delete" element={<AccountDeletePage />} />
        {/* 설정은 더보기로 흡수됐다. 예전 주소나 북마크로 들어와도 끊기지 않도록
            당분간 리다이렉트로 남겨둔다 (docs/BOTTOM_NAVIGATION_SPEC.md 5.1절). */}
        <Route path="settings" element={<Navigate to="/more" replace />} />
      </Route>
    </Routes>
  )
}
