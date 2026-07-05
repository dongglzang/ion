import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/hooks/AuthProvider';
import { ClientProvider } from '@/hooks/ClientProvider';
import { I18nProvider } from '@/i18n';
import { Layout } from '@/routes/Layout';

// 라우트별 lazy — 초기 다운로드를 피드 + 레이아웃으로 한정.
// d3-force(월드), framer-motion-heavy(Calendar), 이미지 크롭 등은
// 해당 라우트 진입 시점에 fetch.
const FeedRoute = lazy(() => import('@/routes/FeedRoute').then((m) => ({ default: m.FeedRoute })));
const WorldRoute = lazy(() => import('@/routes/WorldRoute').then((m) => ({ default: m.WorldRoute })));
const SystemRoute = lazy(() => import('@/routes/SystemRoute').then((m) => ({ default: m.SystemRoute })));
const MyPageRoute = lazy(() => import('@/routes/MyPageRoute').then((m) => ({ default: m.MyPageRoute })));
const PrivacyRoute = lazy(() => import('@/routes/PrivacyRoute').then((m) => ({ default: m.PrivacyRoute })));
const TermsRoute = lazy(() => import('@/routes/TermsRoute').then((m) => ({ default: m.TermsRoute })));
const DevModalHarnessRoute = lazy(() =>
  import('@/routes/DevModalHarnessRoute').then((m) => ({ default: m.DevModalHarnessRoute }))
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ClientProvider>
            <I18nProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<FeedRoute />} />
                  <Route path="s/:slug" element={<SystemRoute />} />
                  <Route path="world" element={<WorldRoute />} />
                  <Route path="privacy" element={<PrivacyRoute />} />
                  <Route path="terms" element={<TermsRoute />} />
                  <Route path="my" element={<MyPageRoute />} />
                  <Route path="_dev/modal" element={<DevModalHarnessRoute />} />
                </Route>
              </Routes>
            </I18nProvider>
          </ClientProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
