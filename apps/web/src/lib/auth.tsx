'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api-client';
import type { LoginResult, MeResponse, SessionUser } from './types';

const TOKEN_KEY = 'bp_access_token';

type AuthState = {
  user: SessionUser | null;
  me: MeResponse | null;
  loading: boolean;
  login: (phone: string, code: string) => Promise<void>;
  /** Stores tokens returned by another auth flow (e.g. tenant registration). */
  completeLogin: (result: LoginResult) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const refresh = useCallback(async () => {
    const current = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    try {
      const data = await api.get<MeResponse>('/auth/me', current);
      setMe(data);
      setUser({
        memberId: data.member.id,
        tenantId: data.tenant.id,
        branchId: data.branch?.id ?? null,
        systemRole: data.member.systemRole,
        permissions: data.role?.permissions ?? [],
        fullName: data.member.fullName,
        phone: data.member.phone,
        tenantName: data.tenant.name,
        tenantSlug: data.tenant.slug,
      });
    } catch {
      setUser(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completeLogin = useCallback(
    async (result: LoginResult) => {
      localStorage.setItem(TOKEN_KEY, result.tokens.accessToken);
      setUser(result.user);
      await refresh();
    },
    [refresh],
  );

  const login = useCallback(
    async (phone: string, code: string) => {
      const result = await api.post<LoginResult>('/auth/otp/verify', { phone, code });
      await completeLogin(result);
    },
    [completeLogin],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setMe(null);
      router.push('/login');
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, me, loading, login, completeLogin, logout, refresh }),
    [user, me, loading, login, completeLogin, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}
