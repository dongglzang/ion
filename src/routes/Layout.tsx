import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Toaster } from 'sonner';
import { useClient } from '@/hooks/ClientProvider';

export function Layout() {
  const { theme } = useClient();

  useEffect(() => {
    if (theme === 'black') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={`min-h-screen bg-background text-foreground transition-colors duration-500 ${theme === 'black' ? 'dark' : ''}`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent/5 opacity-30" />
      </div>
      <Header />
      {/* React Router v6 는 Route children 으로 non-Route 요소를 무시.
          lazy 라우트가 실제로 렌더되는 Outlet 위치에 Suspense 경계 필수.
          fallback=null — 빈 화면 깜빡임 대신 헤더만 잠깐 보이는 게 자연스러움. */}
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <Toaster position="bottom-center" richColors closeButton toastOptions={{ style: { marginBottom: '5rem' } }} />
    </div>
  );
}
