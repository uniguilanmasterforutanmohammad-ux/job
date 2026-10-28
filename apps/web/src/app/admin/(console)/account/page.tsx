'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { getAdminToken, useAdminAuth } from '@/lib/admin-auth';
import { formatJalali } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/empty-state';
import type { PlatformAccount, TwoFactorSetup } from '@/lib/admin-types';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'مدیر ارشد',
  ADMIN: 'مدیر پلتفرم',
  SUPPORT: 'پشتیبانی',
};

export default function AdminAccountPage() {
  const token = getAdminToken();
  const queryClient = useQueryClient();
  const { refresh } = useAdminAuth();

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const accountQuery = useQuery({
    queryKey: ['admin-account'],
    queryFn: () => api.get<PlatformAccount>('/admin/auth/account', token),
  });

  const beginSetup = useMutation({
    mutationFn: () => api.post<TwoFactorSetup>('/admin/auth/2fa/setup', {}, token),
    onSuccess: (data) => {
      setSetup(data);
      setTotpCode('');
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در شروع فعال‌سازی'),
  });

  const confirmSetup = useMutation({
    mutationFn: () => api.post('/admin/auth/2fa/confirm', { code: totpCode }, token),
    onSuccess: () => {
      toast.success('ورود دو مرحله‌ای فعال شد');
      setSetup(null);
      setTotpCode('');
      void queryClient.invalidateQueries({ queryKey: ['admin-account'] });
      void refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'کد نامعتبر است'),
  });

  const disable = useMutation({
    mutationFn: () => api.post('/admin/auth/2fa/disable', { code: disableCode }, token),
    onSuccess: () => {
      toast.success('ورود دو مرحله‌ای غیرفعال شد');
      setDisableOpen(false);
      setDisableCode('');
      void queryClient.invalidateQueries({ queryKey: ['admin-account'] });
      void refresh();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : 'کد نامعتبر است'),
  });

  const account = accountQuery.data;

  function copySecret() {
    if (setup?.secret) {
      void navigator.clipboard.writeText(setup.secret);
      toast.success('کد محرمانه کپی شد');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="حساب من" description="اطلاعات حساب مدیریتی و تنظیمات امنیتی" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="اطلاعات حساب" />
          <CardBody className="space-y-3 text-sm">
            {accountQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <Row label="نام" value={account?.fullName ?? '—'} />
                <Row label="موبایل" value={<span className="nums" dir="ltr">{account?.phone}</span>} />
                <Row label="ایمیل" value={account?.email ?? '—'} />
                <Row
                  label="نقش"
                  value={<Badge tone="brand">{ROLE_LABELS[account?.role ?? ''] ?? account?.role}</Badge>}
                />
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="ورود دو مرحله‌ای (2FA)"
            description="با برنامه Google Authenticator یا مشابه آن"
            action={
              account?.twoFactorEnabled ? (
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3" />
                  فعال
                </Badge>
              ) : (
                <Badge tone="warning">
                  <ShieldOff className="h-3 w-3" />
                  غیرفعال
                </Badge>
              )
            }
          />
          <CardBody className="space-y-4">
            {accountQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : account?.twoFactorEnabled ? (
              <>
                <p className="text-sm text-slate-500">
                  فعال‌شده در: {formatJalali(account.twoFactorConfirmedAt)}
                </p>
                {!setup && (
                  <Button variant="outline" onClick={() => setDisableOpen(true)}>
                    <ShieldOff className="h-4 w-4" />
                    غیرفعال‌سازی
                  </Button>
                )}
              </>
            ) : setup ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  ۱) کد QR را با برنامه Authenticator اسکن کنید.
                </p>
                {setup.qrDataUrl && (
                  <div className="flex justify-center rounded-xl bg-white p-3">
                    <Image
                      src={setup.qrDataUrl}
                      alt="QR ورود دو مرحله‌ای"
                      width={220}
                      height={220}
                      unoptimized
                    />
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <p className="text-xs text-slate-500">یا کد محرمانه را دستی وارد کنید:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all text-xs nums" dir="ltr">
                      {setup.secret}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copySecret}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  ۲) کد ۶ رقمی تولیدشده را وارد کنید.
                </p>
                <Input
                  label="کد ۲FA"
                  inputMode="numeric"
                  dir="ltr"
                  className="text-center text-lg tracking-[0.3em] nums"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                <div className="flex gap-2">
                  <Button
                    loading={confirmSetup.isPending}
                    disabled={totpCode.length < 6}
                    onClick={() => confirmSetup.mutate()}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    تأیید و فعال‌سازی
                  </Button>
                  <Button variant="outline" onClick={() => setSetup(null)}>
                    انصراف
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  برای افزایش امنیت بنل مدیریت، ورود دو مرحله‌ای را فعال کنید.
                </p>
                <Button loading={beginSetup.isPending} onClick={() => beginSetup.mutate()}>
                  <ShieldCheck className="h-4 w-4" />
                  فعال‌سازی ۲FA
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="غیرفعال‌سازی ورود دو مرحله‌ای"
        footer={
          <>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              انصراف
            </Button>
            <Button
              variant="danger"
              loading={disable.isPending}
              disabled={disableCode.length < 6}
              onClick={() => disable.mutate()}
            >
              غیرفعال‌سازی
            </Button>
          </>
        }
      >
        <Input
          label="کد فعلی ۲FA"
          inputMode="numeric"
          dir="ltr"
          className="text-center text-lg tracking-[0.3em] nums"
          hint="برای تأیید، کد فعلی برنامه Authenticator را وارد کنید"
          value={disableCode}
          onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
        />
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}
