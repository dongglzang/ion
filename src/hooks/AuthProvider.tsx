import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { queryClient } from '@/lib/queryClient';
import {
  signInWithGoogle,
  signInWithEmail,
  signOut,
  onAuthStateChange,
} from '@/lib/supabase';
import { clearUserSessionState } from '@/hooks/queries/useFeed';

export interface AuthUser {
  id: string;
  displayName: string;
  /** 결정적 uint32 시드. RerollModal "적용하기" 가 이것을 갱신. */
  planetSeed: number;
  statusMessage: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: () => Promise<void>;
  devLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setPlanetSeed: (planetSeed: number) => void;
  setDisplayName: (name: string) => void;
  setStatusMessage: (message: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((authUser) => {
      if (authUser) {
        prevUserIdRef.current = authUser.id;
        setUser({
          id: authUser.id,
          displayName: authUser.display_name,
          planetSeed: (authUser.planet_seed ?? 0) >>> 0,
          statusMessage: authUser.status_message ?? null,
        });
      } else {
        // 세션별 메모리(dismissedByUser, refillChainByUser) 폐기.
        // 직전 사용자 키를 보존 → anon 키 또는 실 userId 어느 쪽이든
        // 정확히 해당 entry 만 삭제.
        clearUserSessionState(prevUserIdRef.current);
        prevUserIdRef.current = null;
        setUser(null);
        queryClient.clear();
      }
      setIsLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const devLogin = useCallback(async (email: string, password: string) => {
    const { error } = await signInWithEmail(email, password);
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    // signOut() → Supabase SIGNED_OUT 이벤트 → onAuthStateChange(null) →
    //   setUser(null) + queryClient.clear() 가 여기서 처리된다.
    // passive 경로(토큰 만료·다른 탭 sign-out)도 동일 핸들러가 커버.
    // 명시적으로 여기서 또 처리하면 중복 + signOut 실패 시 부분 정리 위험.
    await signOut();
  }, []);
  const setPlanetSeed = useCallback((planetSeed: number) => {
    setUser((prev) => (prev ? { ...prev, planetSeed: planetSeed >>> 0 } : prev));
  }, []);

  const setDisplayName = useCallback((displayName: string) => {
    setUser((prev) => (prev ? { ...prev, displayName } : prev));
  }, []);

  const setStatusMessage = useCallback((statusMessage: string | null) => {
    setUser((prev) => (prev ? { ...prev, statusMessage } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, devLogin, logout, setPlanetSeed, setDisplayName, setStatusMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
