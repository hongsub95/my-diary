import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/auth-context';
import { SeasonalProvider } from '@/features/seasonal/seasonal-context';
import { ThemeProvider } from '@/shared/theme-context';
import { SpaceProvider } from '@/features/spaces/space-context';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* 테마는 계정에 저장되므로 사용자 정보를 읽어야 한다. AuthProvider 안이어야 한다. */}
          <ThemeProvider>
            {/* 계절 배경 설정도 계정에 저장된다. 테마와 같이 AuthProvider 안이어야 한다. */}
            <SeasonalProvider>
              <StatusBar style="dark" />
              <SpaceProvider><Stack screenOptions={{ headerShown: false }} /></SpaceProvider>
            </SeasonalProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
