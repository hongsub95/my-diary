import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './shared/contexts/AuthContext'
import ThemeSync from './shared/theme/ThemeSync'
import { SeasonalProvider } from './shared/seasonal/SeasonalContext'
import App from './App.jsx'
import { SpaceProvider } from './features/spaces/SpaceContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: false,
    },
  },
})

// 데이터 라우터의 useBlocker로 수정 중 브라우저 뒤로가기도 보호한다.
const router = createBrowserRouter([{
  path: '*',
  element: (
    <AuthProvider>
      {/* 로그인 상태를 따라 테마를 적용한다. App보다 앞에 둬서 첫 화면이 그려지기
          전에 색이 맞도록 한다. */}
      <ThemeSync />
      {/* 계절 배경 설정도 계정에 저장된다. 테마와 같이 AuthProvider 안이어야 한다. */}
      <SeasonalProvider>
        <SpaceProvider><App /></SpaceProvider>
      </SeasonalProvider>
    </AuthProvider>
  ),
}])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
