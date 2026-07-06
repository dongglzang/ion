import { useState, useRef, useCallback, type ComponentType } from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthProvider';
import { useClient } from '@/hooks/ClientProvider';
import { Home, Globe, User, Sun, Moon } from 'lucide-react';
import { useI18n } from '@/i18n';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useSystemBySlug } from '@/hooks/queries/useSystems';
import { cn } from '@/lib/utils';

type DevLoginModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string, password: string) => Promise<void>;
};

// DevLoginModal은 DEV 빌드에서만 동적 import.
// 프로덕션에서는 빈 컴포넌트로 대체되어 번들에서 완전히 제거됨.
// Vite는 import.meta.env.DEV가 false인 분기의 import()를 dead-code elimination으로 제거.
const DevLoginModal: ComponentType<DevLoginModalProps> = import.meta.env.DEV
  ? (await import('@/components/DevLoginModal')).DevLoginModal
  : () => null;

/** Long-press threshold in ms — DEV only. 프로덕션에서는 사용되지 않음. */
const LONG_PRESS_MS = 1200;

function NavPill({
  to,
  icon: Icon,
  label,
  isActive,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  isActive: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 select-none touch-target min-h-[44px] min-w-[44px] justify-center text-nowrap',
        isActive
          ? 'text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isActive && (
        <span className="absolute inset-0 rounded-full bg-accent shadow-sm" />
      )}
      <Icon
        className={cn(
          'relative w-[18px] h-[18px] transition-transform duration-300',
          isActive && 'scale-110'
        )}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      <span className="relative hidden sm:inline max-w-[100px] truncate">{label}</span>
    </NavLink>
  );
}

export function Header() {
  const { user, devLogin } = useAuth();
  const { theme, toggleTheme } = useClient();
  const { t } = useI18n();
  const location = useLocation();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data: activeSystem } = useSystemBySlug(slug);
  const activeSystemName = activeSystem?.name;
  const isLoggedIn = !!user;
  const [devModalOpen, setDevModalOpen] = useState(false);

  const pathname = location.pathname;
  const activeNav =
    pathname === '/my' || pathname.startsWith('/my/') ? '/my'
    : pathname === '/world' ? '/world'
    : '/';

  // Long-press state for theme toggle button
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const handleThemePointerDown = useCallback(() => {
    // P0 보안: 프로덕션 빌드에서 dev-login 게이트.
    // import.meta.env.DEV는 Vite가 false로 교체 → bundler가 제거.
    if (!import.meta.env.DEV) return;
    longPressFired.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setDevModalOpen(true);
    }, LONG_PRESS_MS);
  }, []);

  const handleThemePointerUp = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressFired.current) {
      toggleTheme();
    }
  }, [toggleTheme]);

  const handleThemePointerLeave = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 h-14 sm:h-[64px] bg-background/75 backdrop-blur-2xl border-b border-border/40 z-sticky pt-[var(--safe-area-top)]"
      style={{ boxShadow: '0 1px 0 0 oklch(var(--accent) / 0.06), 0 2px 8px 0 oklch(var(--foreground) / 0.04)' }}
    >
      <div className="max-w-[1100px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 gap-2">
        {/* Left: Logo */}
        <NavLink
          to="/"
          className="group flex items-center gap-2 select-none shrink-0"
        >
          <span className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/10 ring-1 ring-accent/20 transition-all duration-300 group-hover:bg-accent/15 group-hover:ring-accent/30 group-hover:shadow-[0_0_12px_oklch(var(--accent)/0.15)]">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-accent transition-transform duration-300 group-hover:scale-125" />
          </span>
          <span className="text-[17px] sm:text-[19px] font-bold text-foreground tracking-[-0.035em] transition-colors duration-300 font-display">
            ION
          </span>
        </NavLink>

        {/* Center: Nav */}
        <nav className="flex items-center gap-1">
          <NavPill
            to="/"
            icon={Home}
            label={activeSystemName ?? t('nav.feed')}
            isActive={activeNav === '/'}
          />
          <NavPill
            to="/world"
            icon={Globe}
            label={t('nav.world')}
            isActive={activeNav === '/world'}
          />
          <NavPill
            to="/my"
            icon={User}
            label={isLoggedIn ? t('nav.my') : t('nav.login')}
            isActive={activeNav === '/my'}
          />
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-0.5 shrink-0">
          {user && <NotificationCenter userId={user.id} />}
          <button
            type="button"
            title={t('header.toggleTheme')}
            onPointerDown={handleThemePointerDown}
            onPointerUp={handleThemePointerUp}
            onPointerLeave={handleThemePointerLeave}
            className="relative flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 active:scale-95"
          >
            <span
              className={cn(
                'transition-transform duration-500',
                theme === 'white' ? 'rotate-0' : 'rotate-180'
              )}
            >
              {theme === 'white' ? (
                <Moon className="w-[18px] h-[18px]" />
              ) : (
                <Sun className="w-[18px] h-[18px]" />
              )}
            </span>
          </button>
        </div>
      </div>
      <DevLoginModal open={devModalOpen} onOpenChange={setDevModalOpen} onLogin={devLogin} />
    </header>
  );
}
