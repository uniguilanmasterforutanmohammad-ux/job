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
import type { PlatformLoginResult, PlatformOperator } from './admin-types';

const ADMIN_TOKEN_KEY = 'bp_admin_token';

type AdminAuthState = {
  operator: PlatformOperator | null;
  loading: boolean;
  /** Resolves to `{ twoFactorRequired: true }` when a TOTP step is pending. */
  loginWithOtp: (phone: string, code: string) => Promise<LoginOutcome>;
  loginWithPassword: (phone: string, password: string) => Promise<LoginOutcome>;
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<PlatformOperator | null>;
};

export type LoginOutcome = { twoFactorRequired: boolean; challengeToken?: string };

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function getAdminToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(ADMIN_TOKEN_KEY) : null;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [operator, setOperator] = useState<PlatformOperator | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<PlatformOperator | null> => {
    const token = getAdminToken();
    if (!token) {
      setOperator(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api.get<PlatformOperator>('/admin/auth/me', token);
      setOperator(data);
      return data;
    } catch {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setOperator(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completeLogin = useCallback(
    (result: PlatformLoginResult): LoginOutcome => {
      if (result.twoFactorRequired) {
        return { twoFactorRequired: true, challengeToken: result.challengeToken };
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, result.tokens.accessToken);
      setOperator(result.operator ?? null);
      return { twoFactorRequired: false };
    },
    [],
  );

  const loginWithOtp = useCallback(
    async (phone: string, code: string) => {
      const result = await api.post<PlatformLoginResult>('/admin/auth/otp/verify', { phone, code });
      return completeLogin(result);
    },
    [completeLogin],
  );

  const loginWithPassword = useCallback(
    async (phone: string, password: string) => {
      const result = await api.post<PlatformLoginResult>('/admin/auth/login', { phone, password });
      return completeLogin(result);
    },
    [completeLogin],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      const result = await api.post<PlatformLoginResult>('/admin/auth/2fa/verify', {
        challengeToken,
        code,
      });
      completeLogin(result);
    },
    [completeLogin],
  );

  const logout = useCallback(async () => {
    const token = getAdminToken();
    try {
      await api.post('/admin/auth/logout', {}, token);
    } finally {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setOperator(null);
      router.push('/admin/login');
    }
  }, [router]);

  const value = useMemo(
    () => ({ operator, loading, loginWithOtp, loginWithPassword, verifyTwoFactor, logout, refresh }),
    [operator, loading, loginWithOtp, loginWithPassword, verifyTwoFactor, logout, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}

/** Client-side helper matching the API role hierarchy (SUPER_ADMIN > ADMIN > SUPPORT). */
export const PLATFORM_ROLE_RANK: Record<PlatformRoleName, number> = {
  SUPER_ADMIN: 3,
  ADMIN: 2,
  SUPPORT: 1,
};

type PlatformRoleName = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT';

export function isAtLeast(role: string | undefined, required: PlatformRoleName): boolean {
  if (!role) return false;
  return (PLATFORM_ROLE_RANK[role as PlatformRoleName] ?? 0) >= PLATFORM_ROLE_RANK[required];
}
