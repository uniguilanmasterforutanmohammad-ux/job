'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import { INDUSTRY_CATEGORIES, MODULE_DESCRIPTIONS, MODULE_KEYS, industryLabel } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import type { LoginResult } from '@/lib/types';

/** Registration of a new business (tenant) — PRD §2 onboarding. */
export default function RegisterPage() {
  const router = useRouter();
  const { completeLogin } = useAuth();
  const [form, setForm] = useState({
    businessName: '',
    industry: 'SPORTS_COACHING',
    ownerName: '',
    phone: '',
    password: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function requestOtp() {
    if (!/^09\d{9}$/.test(form.phone)) {
      toast.error('شماره موبایل معتبر نیست');
      return;
    }
    setSending(true);
    try {
      await api.post('/auth/otp/request', { phone: form.phone, purpose: 'LOGIN' });
      setOtpSent(true);
      toast.success('کد تأیید ارسال شد');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ارسال کد');
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (form.businessName.trim().length < 2) {
      toast.error('نام کسب‌وکار را وارد کنید');
      return;
    }
    if (form.ownerName.trim().length < 2) {
      toast.error('نام و نام خانوادگی خود را وارد کنید');
      return;
    }
    if (form.password.length < 8) {
      toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (otpCode.length < 4) {
      toast.error('ابتدا کد تأیید موبایل را دریافت و وارد کنید');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post<LoginResult>('/auth/register', {
        businessName: form.businessName.trim(),
        industry: form.industry,
        ownerName: form.ownerName.trim(),
        phone: form.phone,
        password: form.password,
        otpCode,
      });
      await completeLogin(result);
      toast.success('کسب‌وکار شما ساخته شد');
      router.push('/dashboard');
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'ثبت کسب‌وکار ناموفق بود',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-bl from-brand-50 via-white to-slate-100 p-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-brand-600 p-3 text-white shadow-lg shadow-brand-600/25">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              ساخت کسب‌وکار جدید
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              با انتخاب صنف، ماژول‌های پیشنهادی خودکار فعال می‌شوند
            </p>
          </div>
        </div>

        <Card>
          <CardHeader title="اطلاعات کسب‌وکار" description="بعداً از تنظیمات قابل تغییر است" />
          <CardBody className="space-y-4">
            <Input
              label="نام کسب‌وکار"
              placeholder="مثلاً باشگاه ورزشی آریا"
              value={form.businessName}
              onChange={(e) => set('businessName')(e.target.value)}
            />
            <Select
              label="صنف / حوزهٔ فعالیت"
              value={form.industry}
              onChange={(e) => set('industry')(e.target.value)}
            >
              {INDUSTRY_CATEGORIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industryLabel(industry)}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="حساب مالک" description="با این موبایل وارد پنل می‌شوید" />
          <CardBody className="space-y-4">
            <Input
              label="نام و نام خانوادگی"
              placeholder="مثلاً مریم احمدی"
              value={form.ownerName}
              onChange={(e) => set('ownerName')(e.target.value)}
            />
            <Input
              label="شماره موبایل"
              placeholder="09xxxxxxxxx"
              dir="ltr"
              inputMode="numeric"
              className="text-left nums"
              value={form.phone}
              onChange={(e) => set('phone')(e.target.value.replace(/\D/g, '').slice(0, 11))}
            />
            <Input
              label="رمز عبور"
              type="password"
              dir="ltr"
              className="text-left"
              hint="حداقل ۸ کاراکتر — برای ورود سریع بعدی"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="کد تأیید موبایل"
                  placeholder="− − − − − −"
                  dir="ltr"
                  inputMode="numeric"
                  className="text-center tracking-[0.4em] nums"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                />
              </div>
              <Button variant="outline" loading={sending} onClick={() => void requestOtp()}>
                <Phone className="h-4 w-4" />
                {otpSent ? 'ارسال دوبارهٔ کد' : 'ارسال کد'}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="ماژول‌های این صنف"
            description={`${industryLabel(form.industry)} — قابل تغییر بعد از ساخت`}
          />
          <CardBody className="space-y-2">
            {MODULE_KEYS.slice(0, 6).map((key) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-slate-700 dark:text-slate-200">
                  {MODULE_DESCRIPTIONS[key]}
                </span>
              </div>
            ))}
            <p className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              بقیهٔ ماژول‌ها (کمپین، انبار، کارکنان، فروشگاه، اسناد) بعداً قابل فعال‌سازی است.
            </p>
          </CardBody>
        </Card>

        <Button className="w-full" size="lg" loading={loading} onClick={() => void submit()}>
          <ShieldCheck className="h-4 w-4" />
          ساخت کسب‌وکار و ورود به پنل
        </Button>

        <p className="text-center text-sm text-slate-500">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href="/login" className="text-brand-600 hover:underline">
            ورود به پنل کسب‌وکار
          </Link>
        </p>
        <p className="text-center text-xs text-slate-400">
          مشتری یک کسب‌وکار هستید؟{' '}
          <Link href="/me" className="text-brand-600 hover:underline">
            پنل کاربری من
          </Link>
        </p>
      </div>
    </main>
  );
}
