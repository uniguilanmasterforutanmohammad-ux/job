'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    if (!/^09\d{9}$/.test(phone)) {
      toast.error('شماره موبایل معتبر نیست');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { phone, purpose: 'LOGIN' });
      toast.success('کد یکبار مصرف ارسال شد');
      setStep('code');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ارسال کد');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      await login(phone, code);
      toast.success('خوش آمدید');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'کد وارد شده نامعتبر است');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-brand-50 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-brand-600 p-3 text-white shadow-lg shadow-brand-600/25">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              پلتفرم مدیریت کسب‌وکار
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              مدیریت مشتری، نوبت، مالی و حضور در یک محیط یکپارچه
            </p>
          </div>
        </div>

        <Card>
          <CardBody className="space-y-5">
            {step === 'phone' ? (
              <>
                <Input
                  label="شماره موبایل"
                  name="phone"
                  inputMode="numeric"
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  dir="ltr"
                  className="text-left nums"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
                  onKeyDown={(event) => event.key === 'Enter' && void requestOtp()}
                />
                <Button className="w-full" size="lg" loading={loading} onClick={() => void requestOtp()}>
                  <Phone className="h-4 w-4" />
                  دریافت کد یکبار مصرف
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="کد یکبار مصرف"
                  name="code"
                  inputMode="numeric"
                  placeholder="− − − − − −"
                  dir="ltr"
                  className="text-center text-lg tracking-[0.5em] nums"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(event) => event.key === 'Enter' && void verifyOtp()}
                  hint={`کد به شماره ${phone} ارسال شد`}
                  autoFocus
                />
                <Button className="w-full" size="lg" loading={loading} onClick={() => void verifyOtp()}>
                  <ShieldCheck className="h-4 w-4" />
                  ورود
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-brand-600 hover:underline"
                  onClick={() => setStep('phone')}
                >
                  تغییر شماره موبایل
                </button>
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-xs text-slate-400">
          در حالت توسعه، کد ثابت <span className="font-mono nums">123456</span> پذیرفته می‌شود.
        </p>

        <p className="mt-3 text-center text-sm text-slate-500">
          مشتری، شاگرد، بیمار یا مراجع یک کسب‌وکار هستید؟{' '}
          <Link href="/me" className="text-brand-600 hover:underline">
            ورود به پنل کاربری من
          </Link>
        </p>

        <p className="mt-2 text-center text-sm text-slate-500">
          کسب‌وکار خود را دارید؟{' '}
          <Link href="/register" className="text-brand-600 hover:underline">
            ثبت‌نام و ساخت کسب‌وکار
          </Link>
        </p>
      </div>
    </main>
  );
}
