'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Phone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';
import { api, ApiClientError } from '@/lib/api-client';
import { useAdminAuth } from '@/lib/admin-auth';

type Mode = 'password' | 'otp';
type Step = 'credentials' | 'code' | 'twofactor';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithOtp, loginWithPassword, verifyTwoFactor, operator } = useAdminAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [step, setStep] = useState<Step>('credentials');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (operator) router.replace('/admin');
  }, [operator, router]);

  async function submitPassword() {
    setLoading(true);
    try {
      const outcome = await loginWithPassword(phone, password);
      if (outcome.twoFactorRequired) {
        setChallengeToken(outcome.challengeToken ?? '');
        setStep('twofactor');
        return;
      }
      toast.success('خوش آمدید');
      router.push('/admin');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'ورود ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp() {
    if (!/^09\d{9}$/.test(phone)) {
      toast.error('شماره موبایل معتبر نیست');
      return;
    }
    setLoading(true);
    try {
      await api.post('/admin/auth/otp/request', { phone });
      toast.success('در صورت وجود حساب، کد ارسال شد');
      setStep('code');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'خطا در ارسال کد');
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp() {
    setLoading(true);
    try {
      const outcome = await loginWithOtp(phone, code);
      if (outcome.twoFactorRequired) {
        setChallengeToken(outcome.challengeToken ?? '');
        setStep('twofactor');
        return;
      }
      toast.success('خوش آمدید');
      router.push('/admin');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'کد نامعتبر است');
    } finally {
      setLoading(false);
    }
  }

  async function submitTwoFactor() {
    setLoading(true);
    try {
      await verifyTwoFactor(challengeToken, totpCode);
      toast.success('خوش آمدید');
      router.push('/admin');
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'کد ورود دو مرحله‌ای نامعتبر است');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-bl from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-slate-700 p-3 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">بنل مدیریت پلتفرم</h1>
            <p className="mt-1 text-sm text-slate-400">دسترسی ویژه مدیران پلتفرم</p>
          </div>
        </div>

        <Card className="border-slate-700 bg-slate-800">
          <CardBody className="space-y-5">
            <div className="flex rounded-xl bg-slate-700/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setStep('credentials');
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === 'password' ? 'bg-slate-600 text-white' : 'text-slate-300'
                }`}
              >
                رمز عبور
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('otp');
                  setStep('credentials');
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  mode === 'otp' ? 'bg-slate-600 text-white' : 'text-slate-300'
                }`}
              >
                کد یکبار مصرف
              </button>
            </div>

            {step === 'credentials' ? (
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
                />
                {mode === 'password' && (
                  <Input
                    label="رمز عبور"
                    name="password"
                    type="password"
                    dir="ltr"
                    className="text-left"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && void submitPassword()}
                  />
                )}
                <Button
                  className="w-full"
                  size="lg"
                  loading={loading}
                  onClick={() => void (mode === 'password' ? submitPassword() : requestOtp())}
                >
                  {mode === 'password' ? <KeyRound className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {mode === 'password' ? 'ورود' : 'دریافت کد'}
                </Button>
              </>
            ) : step === 'code' ? (
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
                  onKeyDown={(event) => event.key === 'Enter' && void submitOtp()}
                  hint={`کد به شماره ${phone} ارسال شد`}
                  autoFocus
                />
                <Button className="w-full" size="lg" loading={loading} onClick={() => void submitOtp()}>
                  <ShieldCheck className="h-4 w-4" />
                  ورود
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-slate-300 hover:underline"
                  onClick={() => setStep('credentials')}
                >
                  بازگشت
                </button>
              </>
            ) : (
              <>
                <p className="rounded-xl bg-slate-700/40 p-3 text-center text-sm text-slate-200">
                  برای این حساب ورود دو مرحله‌ای فعال است. کد ۶ رقمی برنامه Authenticator را وارد کنید.
                </p>
                <Input
                  label="کد ورود دو مرحله‌ای"
                  name="totp"
                  inputMode="numeric"
                  placeholder="۱۲۳۴۵۶"
                  dir="ltr"
                  className="text-center text-lg tracking-[0.5em] nums"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(event) => event.key === 'Enter' && void submitTwoFactor()}
                  autoFocus
                />
                <Button
                  className="w-full"
                  size="lg"
                  loading={loading}
                  onClick={() => void submitTwoFactor()}
                >
                  <ShieldCheck className="h-4 w-4" />
                  تأیید و ورود
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-slate-300 hover:underline"
                  onClick={() => {
                    setStep('credentials');
                    setTotpCode('');
                    setCode('');
                  }}
                >
                  بازگشت
                </button>
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-xs text-slate-500">
          حساب پیش‌فرض توسعه: <span className="font-mono nums">09120000001 / Admin@12345</span>
        </p>
      </div>
    </main>
  );
}
