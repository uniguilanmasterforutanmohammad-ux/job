'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Gift,
  IdCard,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  Phone,
  QrCode,
  CalendarX2,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiClientError } from '@/lib/api-client';
import { cn, formatJalali, formatNumber, formatToman } from '@/lib/utils';
import { useIndustryRegistry } from '@/lib/use-industry-registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/empty-state';
import { ChangePasswordCard } from '@/components/settings/change-password-card';
import type {
  AbsenceRequest,
  PortalLoyalty,
  CustomerAttendance,
  CustomerCheckInTarget,
  CustomerClub,
  CustomerBusinessOption,
  CustomerLoginResult,
} from '@/lib/types-extra';

const CUSTOMER_TOKEN_KEY = 'bp_customer_token';
const CUSTOMER_USER_KEY = 'bp_customer_user';
/** Pre-rename keys — read once so an open session keeps working. */
const LEGACY_TOKEN_KEY = 'bp_student_token';
const LEGACY_USER_KEY = 'bp_student_user';

/**
 * The portal is a *panel*, not one long scrolling page (same idea as the
 * business panel): each area gets its own section and only the open one talks
 * to the server. That also stops the check-in list from polling while the
 * شاگرد is reading something else.
 */
type PortalTab =
  | 'home'
  | 'clubs'
  | 'attendance'
  | 'appointments'
  | 'finance'
  | 'absence'
  | 'profile';

const PORTAL_TABS: { key: PortalTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'home', label: 'خانه', icon: LayoutDashboard },
  { key: 'clubs', label: 'صنف‌ها و مجموعه‌ها', icon: Building2 },
  { key: 'attendance', label: 'حضور و غیاب', icon: UserCheck },
  { key: 'appointments', label: 'نوبت‌های من', icon: CalendarClock },
  { key: 'finance', label: 'مالی و کیف پول', icon: CreditCard },
  { key: 'absence', label: 'درخواست غیبت', icon: CalendarX2 },
  { key: 'profile', label: 'پروفایل من', icon: IdCard },
];

/** `POST /auth/login` — same session shape the OTP portal login returns. */
type PasswordLoginResult = {
  tokens: { accessToken: string };
  user: {
    fullName: string;
    phone: string | null;
    tenantId: string;
    tenantName: string;
  };
};

type CustomerSession = {
  accessToken: string;
  fullName: string;
  phone: string | null;
  tenantId: string;
  tenantName: string;
};

type Appointment = {
  id: string;
  startsAt: string;
  status: string;
  service: { name: string } | null;
};

type Invoice = {
  id: string;
  number: string;
  total: string;
  paidTotal: string;
  status: string;
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'حاضر',
  ABSENT: 'غایب',
  LATE: 'تأخیر',
  EXCUSED: 'موجه',
  CANCELED: 'لغوشده',
};

const ABSENCE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تأییدشده (موجه)',
  REJECTED: 'ردشده',
  CANCELED: 'لغوشده',
};

const ABSENCE_STATUS_TONES: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELED: 'neutral',
};

const ABSENCE_REASONS = ['بیماری', 'مسافرت', 'شرایط شخصی', 'بدون اطلاع قبلی', 'سایر'];

function useCustomerSession() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Fall back to the pre-rename key so an open session is not dropped.
    const raw = localStorage.getItem(CUSTOMER_USER_KEY) ?? localStorage.getItem(LEGACY_USER_KEY);
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CustomerSession;
        setSession(token ? { ...parsed, accessToken: token } : parsed);
      } catch {
        localStorage.removeItem(CUSTOMER_USER_KEY);
      }
    }
    setReady(true);
  }, []);
  const save = (value: CustomerSession) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, value.accessToken);
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(value));
    setSession(value);
  };
  const clear = () => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
    setSession(null);
  };
  return { session, ready, save, clear };
}

export default function CustomerPortalPage() {
  const { session, ready, save, clear } = useCustomerSession();

  if (!ready) return null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-16">
      <header className="flex items-center justify-between rounded-2xl bg-brand-600 p-5 text-white">
        <div>
          <h1 className="text-lg font-bold">پنل کاربری من</h1>
          <p className="text-sm text-white/80">
            {session
              ? `${session.fullName} • ${session.tenantName}`
              : `مراکزی که در آن‌ها عضو هستید، حضور، نوبت و پرداخت`}
          </p>
        </div>
        {session && (
          <Button variant="ghost" className="text-white" onClick={clear}>
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        )}
      </header>

      {session ? (
        <CustomerDashboard session={session} onLogout={clear} onSwitch={save} />
      ) : (
        <CustomerLoginPanel onSuccess={save} />
      )}
    </div>
  );
}

function CustomerLoginPanel({ onSuccess }: { onSuccess: (s: CustomerSession) => void }) {
  const registry = useIndustryRegistry();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  /** شاگرد/زبان‌آموز می‌تواند با کد یکبار مصرف یا رمز عبور وارد شود. */
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  /** Selected business for the "join a new business" path; null = global login. */
  const [target, setTarget] = useState<CustomerBusinessOption | null>(null);
  const [showDirectory, setShowDirectory] = useState(false);
  const [search, setSearch] = useState('');

  // Public directory: the API only returns ACTIVE businesses, so a business
  // deactivated by the platform admin never shows up here.
  const directory = useQuery({
    queryKey: ['customer-business-directory', search],
    enabled: showDirectory,
    queryFn: () =>
      api.get<CustomerBusinessOption[]>(
        `/app/businesses${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const reset = () => {
    setTarget(null);
    setStep('phone');
    setCode('');
    setPassword('');
  };

  const passwordLogin = useMutation({
    mutationFn: () =>
      api.post<PasswordLoginResult>('/auth/login', {
        phone,
        password,
        ...(target ? { tenantSlug: target.slug } : {}),
      }),
    onSuccess: (result) => {
      onSuccess({
        accessToken: result.tokens.accessToken,
        fullName: result.user.fullName,
        phone: result.user.phone,
        tenantId: result.user.tenantId,
        tenantName: result.user.tenantName,
      });
      toast.success('خوش آمدید');
    },
    onError: (e) =>
      toast.error(e instanceof ApiClientError ? e.message : 'ورود با رمز عبور ناموفق بود'),
  });

  const requestOtp = useMutation({
    mutationFn: () =>
      target
        ? api.post('/app/auth/otp/request', { tenantSlug: target.slug, phone })
        : api.post('/app/auth/otp/request-global', { phone }),
    onSuccess: () => {
      toast.success('کد ورود ارسال شد');
      setStep('code');
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در ارسال کد'),
  });

  const verifyOtp = useMutation({
    mutationFn: () =>
      target
        ? api.post<CustomerLoginResult>('/app/auth/otp/verify', {
            tenantSlug: target.slug,
            phone,
            code,
          })
        : api.post<CustomerLoginResult>('/app/auth/otp/verify-global', { phone, code }),
    onSuccess: (result) => {
      onSuccess({
        accessToken: result.tokens.accessToken,
        fullName: result.user.fullName,
        phone: result.user.phone,
        tenantId: result.user.tenantId,
        tenantName: result.user.tenantName,
      });
      toast.success('خوش آمدید');
    },
    onError: (e) => {
      toast.error(e instanceof ApiClientError ? e.message : 'کد نامعتبر است');
      if (!target) setShowDirectory(true);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="ورود یا ثبت‌نام با موبایل"
          description="اولین بار که وارد می‌شوید حساب کاربری خودتان ساخته می‌شود؛ بعد از آن همهٔ کسب‌وکارهایی که در آن‌ها عضو هستید یک‌جا نمایش داده می‌شوند"
        />
        <CardBody className="space-y-4">
          {target && (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm dark:bg-brand-950/30">
              <span>
                ثبت‌نام/ورود در <span className="font-semibold">{target.name}</span>
              </span>
              <button type="button" className="text-xs text-brand-700 hover:underline" onClick={reset}>
                تغییر کسب‌وکار
              </button>
            </div>
          )}
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {([
            ['otp', 'ورود با کد یکبار مصرف'],
            ['password', 'ورود با رمز عبور'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === value
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-200'
                  : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          label="شماره موبایل"
          placeholder="09xxxxxxxxx"
          dir="ltr"
          className="text-left nums"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
          disabled={step === 'code' || mode === 'password' && passwordLogin.isPending}
        />
        {mode === 'password' && (
          <Input
            label="رمز عبور"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className="text-left"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {step === 'code' && (
          <Input
            label="کد یکبار مصرف"
            inputMode="numeric"
            dir="ltr"
            className="text-center tracking-[0.4em] nums"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
        )}
        {mode === 'password' ? (
          <Button
            className="w-full"
            loading={passwordLogin.isPending}
            disabled={!/^09\d{9}$/.test(phone) || password.length < 8}
            onClick={() => passwordLogin.mutate()}
          >
            <ShieldCheck className="h-4 w-4" />
            ورود با رمز عبور
          </Button>
        ) : step === 'phone' ? (
          <Button
            className="w-full"
            loading={requestOtp.isPending}
            disabled={!/^09\d{9}$/.test(phone)}
            onClick={() => requestOtp.mutate()}
          >
            <Phone className="h-4 w-4" />
            دریافت کد
          </Button>
        ) : (
          <Button
            className="w-full"
            loading={verifyOtp.isPending}
            disabled={!code}
            onClick={() => verifyOtp.mutate()}
          >
            <ShieldCheck className="h-4 w-4" />
            ورود
          </Button>
        )}
        {mode === 'password' ? (
          <p className="text-center text-xs text-slate-400">
            رمز عبور را خودتان در «تنظیم رمز عبور» همین پنل تعیین می‌کنید؛ اگر رمزی ندارید، با کد
            یکبار مصرف وارد شوید و یکی بسازید.
          </p>
        ) : (
          <p className="text-center text-xs text-slate-400">
            در حالت توسعه، کد ثابت <span className="font-mono nums">123456</span> پذیرفته می‌شود.
          </p>
        )}
        <p className="text-xs leading-6 text-slate-500">
          برای عضویت در یک کسب‌وکار جدید، لینک یا QR اختصاصی همان کسب‌وکار را باز کنید؛ پس از
          تأیید موبایل، آن مجموعه به فهرست «صنف‌ها و مجموعه‌ها» در پنل شما اضافه می‌شود. اگر لینک
          را ندارید، از فهرست زیر کسب‌وکار خود را انتخاب کنید.
        </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="عضویت در کسب‌وکار جدید"
          description="فقط کسب‌وکارهای فعال نمایش داده می‌شوند؛ با انتخاب هر کسب‌وکار، همان لحظه حساب شما ساخته می‌شود"
          action={
            <Button variant="outline" size="sm" onClick={() => setShowDirectory((prev) => !prev)}>
              <Building2 className="h-4 w-4" />
              {showDirectory ? 'بستن فهرست' : 'نمایش فهرست کسب‌وکارها'}
            </Button>
          }
        />
        {showDirectory && (
          <CardBody className="space-y-3">
            <Input
              placeholder="جستجوی نام کسب‌وکار"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {directory.isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : directory.data?.length ? (
              <div className="space-y-2">
                {directory.data.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-start text-sm transition hover:border-brand-400 hover:bg-brand-50/60 dark:border-slate-800 dark:hover:bg-brand-950/20"
                    onClick={() => {
                      setTarget(business);
                      setStep('phone');
                      setCode('');
                      setShowDirectory(false);
                      toast.success(`کسب‌وکار «${business.name}» انتخاب شد`);
                    }}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {business.name}
                    </span>
                    <Badge tone="neutral">{registry.label(business.industry)}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-slate-400">
                کسب‌وکار فعالی یافت نشد
              </p>
            )}
          </CardBody>
        )}
      </Card>
    </div>
  );
}

/** One labelled line of the profile card. */
function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span className="text-slate-500">{label}</span>
      <span className="flex flex-wrap items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
        {children}
      </span>
    </div>
  );
}

/** Clubs grouped by industry — «آموزش زبان»، «ورزش و تندرستی»، … */
function groupClubsByIndustry(clubs: CustomerClub[]) {
  const groups: { industry: string; clubs: CustomerClub[] }[] = [];
  for (const club of clubs) {
    const group = groups.find((item) => item.industry === club.industry);
    if (group) group.clubs.push(club);
    else groups.push({ industry: club.industry, clubs: [club] });
  }
  return groups;
}

/** One membership: which club, which industry, and the switch action. */
function ClubRow({
  club,
  active,
  switching,
  onSwitch,
}: {
  club: CustomerClub;
  active: boolean;
  switching: boolean;
  onSwitch: (tenantId: string) => void;
}) {
  const registry = useIndustryRegistry();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/30">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">{club.tenantName}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge tone="neutral">{registry.label(club.industry)}</Badge>
            <span>{registry.noun(club.industry)} این مجموعه</span>
            {club.branch?.name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {club.branch.name}
                {club.branch.city ? ` • ${club.branch.city}` : ''}
              </span>
            )}
            {club.joinedAt && (
              <span className="nums">عضو از {formatJalali(club.joinedAt)}</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={club.isActive ? 'success' : 'neutral'}>
          {club.isActive ? 'فعال' : 'غیرفعال'}
        </Badge>
        {active ? (
          <Badge tone="brand">کسب‌وکار فعال پنل</Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            loading={switching}
            disabled={!club.isActive}
            onClick={() => onSwitch(club.tenantId)}
          >
            <ArrowLeftRight className="h-4 w-4" />
            ورود به این مجموعه
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A mobile number can be a member of a language school *and* a gym *and* a
 * clinic. The strip keeps every club visible in all sections (the user asked
 * for the industries to be obvious, not buried in one card), and acts as the
 * club switcher: a token is scoped to a single tenant, so picking a chip
 * re-issues it for that club.
 */
function MembershipStrip({
  clubs,
  loading,
  activeTenantId,
  busyTenantId,
  onSwitch,
  onOpenAll,
}: {
  clubs: CustomerClub[];
  loading: boolean;
  activeTenantId: string;
  busyTenantId: string | null;
  onSwitch: (tenantId: string) => void;
  onOpenAll: () => void;
}) {
  const registry = useIndustryRegistry();
  const industries = Array.from(new Set(clubs.map((club) => club.industry)));

  return (
    <Card>
      <CardHeader
        title="صنف‌ها و مجموعه‌های من"
        description={
          clubs.length
            ? `شما در ${formatNumber(industries.length)} صنف و ${formatNumber(clubs.length)} مجموعه عضو هستید. با انتخاب هر صنف، پنل به همان مجموعه وصل می‌شود.`
            : 'با همین شمارهٔ موبایل می‌توانید هم‌زمان در چند صنف و مجموعهٔ مختلف عضو باشید.'
        }
        action={
          clubs.length > 1 ? (
            <Button size="sm" variant="outline" onClick={onOpenAll}>
              <Layers className="h-4 w-4" />
              همهٔ صنف‌ها
            </Button>
          ) : undefined
        }
      />
      <CardBody className="flex flex-wrap gap-2">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : clubs.length ? (
          clubs.map((club) => {
            const active = club.tenantId === activeTenantId;
            return (
              <button
                key={club.tenantId}
                type="button"
                disabled={!club.isActive || busyTenantId === club.tenantId}
                aria-current={active ? 'true' : undefined}
                title={active ? 'این مجموعه همین حالا فعال است' : 'ورود به این مجموعه'}
                onClick={() => onSwitch(club.tenantId)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs transition-colors disabled:cursor-default',
                  active
                    ? 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/30'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                )}
              >
                <Building2
                  className={cn('h-4 w-4 shrink-0', active ? 'text-brand-600' : 'text-slate-400')}
                />
                <span>
                  <span
                    className={cn(
                      'block',
                      active
                        ? 'font-semibold text-brand-700 dark:text-brand-200'
                        : 'font-medium text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {registry.label(club.industry)}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-slate-500">
                    <Badge tone={active ? 'brand' : 'neutral'}>
                      {registry.noun(club.industry)}
                    </Badge>
                    {club.tenantName}
                  </span>
                </span>
                {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">
            هنوز در هیچ صنفی عضو نیستید؛ از «خانه» یکی از کسب‌وکارهای فعال را انتخاب کنید تا حساب
            شما همان‌جا ساخته شود.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function CustomerDashboard({
  session,
  onLogout,
  onSwitch,
}: {
  session: CustomerSession;
  onLogout: () => void;
  /** Replaces the stored session after switching the active club. */
  onSwitch: (session: CustomerSession) => void;
}) {
  const registry = useIndustryRegistry();
  const token = session.accessToken;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PortalTab>('home');
  const apiGet = useMemo(
    () =>
      <T,>(p: string) =>
        api.get<T>(p, token),
    [token],
  );
  const apiPost = useMemo(
    () =>
      <T,>(p: string, b?: unknown) =>
        api.post<T>(p, b, token),
    [token],
  );

  const clubsQuery = useQuery({
    queryKey: ['customer-clubs'],
    queryFn: () => apiGet<CustomerClub[]>('/app/clubs'),
  });
  const attendanceQuery = useQuery({
    queryKey: ['customer-attendance'],
    queryFn: () => apiGet<CustomerAttendance>('/app/attendance'),
  });
  const targetsQuery = useQuery({
    queryKey: ['customer-checkin-targets'],
    queryFn: () => apiGet<CustomerCheckInTarget[]>('/app/attendance/targets'),
    // Only poll while the شاگرد is actually looking at the check-in section.
    enabled: tab === 'attendance',
    refetchInterval: tab === 'attendance' ? 15_000 : false,
  });
  const appointmentsQuery = useQuery({
    queryKey: ['customer-appointments'],
    queryFn: () => apiGet<Appointment[]>('/app/appointments'),
    enabled: tab === 'appointments',
  });
  const invoicesQuery = useQuery({
    queryKey: ['customer-invoices'],
    queryFn: () => apiGet<Invoice[]>('/app/invoices'),
    enabled: tab === 'finance',
  });
  const loyaltyQuery = useQuery({
    queryKey: ['customer-loyalty'],
    queryFn: () => apiGet<PortalLoyalty>('/app/loyalty'),
  });
  const absenceQuery = useQuery({
    queryKey: ['customer-absence-requests'],
    queryFn: () => apiGet<AbsenceRequest[]>('/app/absence-requests'),
    enabled: tab === 'absence',
  });
  // Tells the password card whether to ask for the current password.
  const meQuery = useQuery({
    queryKey: ['customer-me'],
    queryFn: () =>
      apiGet<{
        member: {
          fullName: string;
          phone: string | null;
          email: string | null;
          hasPassword?: boolean;
        };
        tenant: { name: string; industry: string };
        branch: { id: string; name: string } | null;
      }>('/auth/me'),
  });

  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const checkIn = useMutation({
    mutationFn: (sessionId: string) =>
      apiPost<{ alreadyCheckedIn: boolean }>('/app/attendance/check-in', {
        sessionId,
        latitude: coords?.lat,
        longitude: coords?.lng,
        accuracyMeters: coords?.acc,
      }),
    onSuccess: (result) => {
      toast.success(result.alreadyCheckedIn ? 'قبلاً حاضری ثبت شده است' : 'حاضری شما ثبت شد');
      void queryClient.invalidateQueries({ queryKey: ['customer-attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-checkin-targets'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'ثبت حاضری ناموفق بود'),
  });

  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      apiPost<{ redirectUrl: string }>('/app/payments', { invoiceId }),
    onSuccess: (result) => {
      if (result.redirectUrl) window.location.href = result.redirectUrl;
      void queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'خطا در پرداخت'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/app/appointments/${id}/cancel`),
    onSuccess: () => {
      toast.success('نوبت لغو شد');
      void queryClient.invalidateQueries({ queryKey: ['customer-appointments'] });
    },
  });

  /**
   * A mobile number can belong to several businesses (a language school *and*
   * a gym); the token is scoped to one at a time, so switching re-issues it.
   */
  const switchClub = useMutation({
    mutationFn: (tenantId: string) =>
      apiPost<{
        tokens: { accessToken: string };
        user: { fullName: string; phone: string | null; tenantId: string; tenantName: string };
      }>('/app/auth/switch-club', { tenantId }),
    onSuccess: (result) => {
      onSwitch({
        accessToken: result.tokens.accessToken,
        fullName: result.user.fullName,
        phone: result.user.phone,
        tenantId: result.user.tenantId,
        tenantName: result.user.tenantName,
      });
      toast.success(`به ${result.user.tenantName} منتقل شدید`);
      void queryClient.invalidateQueries();
    },
    onError: (e) =>
      toast.error(e instanceof ApiClientError ? e.message : 'تغییر کسب‌وکار ناموفق بود'),
  });

  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState(ABSENCE_REASONS[0]);
  const [absenceNote, setAbsenceNote] = useState('');
  const createAbsence = useMutation({
    mutationFn: () =>
      apiPost('/app/absence-requests', {
        absenceDate,
        reason: absenceReason,
        note: absenceNote.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('درخواست غیبت ثبت شد و برای بررسی به مربی ارسال گردید');
      setAbsenceDate('');
      setAbsenceNote('');
      void queryClient.invalidateQueries({ queryKey: ['customer-absence-requests'] });
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : 'ثبت درخواست ناموفق بود'),
  });

  const targets = targetsQuery.data ?? [];
  const attendance = attendanceQuery.data;
  const clubGroups = groupClubsByIndustry(clubsQuery.data ?? []);
  const busyTenantId = switchClub.isPending ? (switchClub.variables ?? null) : null;
  const activeClub = (clubsQuery.data ?? []).find((club) => club.tenantId === session.tenantId);

  return (
    <div className="space-y-5">
      {/* Visible in every section, not only on «خانه»: the industries this
          number belongs to, and one click to switch the active club. */}
      <MembershipStrip
        clubs={clubsQuery.data ?? []}
        loading={clubsQuery.isLoading}
        activeTenantId={session.tenantId}
        busyTenantId={busyTenantId}
        onSwitch={(tenantId) => switchClub.mutate(tenantId)}
        onOpenAll={() => setTab('clubs')}
      />

      <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
      {/* Sections instead of one endless page: the portal now reads like the
          business panel, and each tab only loads what it needs. */}
      <nav
        aria-label="بخش‌های پنل کاربری"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible"
      >
        {PORTAL_TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setTab(item.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-5">
      {tab === 'home' && (
        <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">درصد حضور</p>
              <p className="font-bold nums">{attendance ? `${attendance.ratio}%` : '—'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">کیف پول</p>
              <p className="font-bold nums">{formatToman(loyaltyQuery.data?.walletBalance ?? 0)}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <Star className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">امتیاز</p>
              <p className="font-bold nums">{loyaltyQuery.data?.points ?? 0}</p>
            </div>
          </CardBody>
        </Card>
      </div>
        </>
      )}

      {tab === 'attendance' && (
        <>
      {/* Open attendance sessions the customer can self check in to */}
      <Card>
        <CardHeader
          title="ثبت حاضری"
          description="جلسه‌های بازِ مراکز شما — بدون نیاز به اسکن QR"
        />
        <CardBody className="space-y-2">
          {targetsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : targets.length ? (
            targets.map((target) => (
              <div
                key={target.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{target.label ?? 'جلسه حاضری'}</p>
                    <p className="text-xs text-slate-500 nums">
                      کد <span dir="ltr">{target.code}</span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  loading={checkIn.isPending}
                  onClick={() => checkIn.mutate(target.id)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  حاضرم
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              icon={QrCode}
              title="جلسه حاضری بازی وجود ندارد"
              description="اگر مدیر یا مربی لینک حاضری فرستاده، می‌توانید آن را باز کنید."
            />
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {coords
              ? 'موقعیت مکانی برای بررسی محدوده خوانده شد'
              : 'دسترسی به موقعیت مکانی اختیاری است'}
          </p>
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'clubs' && (
        <>
      {/* Every industry the number belongs to, one group per industry — the
          «زبان‌آموز / ورزشی / …» list the user asked to see in the panel. */}
      <Card>
        <CardHeader
          title="صنف‌ها و مجموعه‌هایی که در آن‌ها عضو هستید"
          description="اگر در چند صنف عضو باشید، همهٔ آن‌ها همین‌جا جدا‌جدا فهرست می‌شوند؛ با «ورود به این مجموعه» پنل به همان کسب‌وکار وصل می‌شود."
        />
        <CardBody className="space-y-4">
          {clubsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : clubGroups.length ? (
            clubGroups.map((group) => (
              <div key={group.industry} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                  <Badge tone="brand">{registry.label(group.industry)}</Badge>
                  <span className="text-xs text-slate-500">
                    {formatNumber(group.clubs.length)} مجموعه • نام کاربران این صنف «
                    {registry.noun(group.industry)}» است
                  </span>
                </div>
                {group.clubs.map((club) => (
                  <ClubRow
                    key={club.tenantId}
                    club={club}
                    active={club.tenantId === session.tenantId}
                    switching={busyTenantId === club.tenantId}
                    onSwitch={(tenantId) => switchClub.mutate(tenantId)}
                  />
                ))}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Building2}
              title="هنوز در هیچ کسب‌وکاری عضو نیستید"
              description="حساب شما با همین شمارهٔ موبایل ساخته می‌شود و می‌تواند هم‌زمان در چند کسب‌وکار باشد. برای شروع: ۱) لینک یا QR دعوت همان مجموعه را باز کنید، ۲) از فهرست کسب‌وکارهای فعال در صفحهٔ ورود یکی را انتخاب کنید تا حساب شما همان لحظه ساخته شود، یا ۳) از مدیر مجموعه بخواهید شمارهٔ شما را در فهرست کاربرانش ثبت کند."
            />
          )}
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'home' && (
        <>
      {/* Compact summary: the industries themselves live in the strip above and
          in «صنف‌ها و مجموعه‌ها». */}
      <Card>
        <CardHeader
          title="عضویت‌های من"
          description="یک شمارهٔ موبایل می‌تواند هم‌زمان در چند صنف و کسب‌وکار (مثلاً یک آموزشگاه زبان و یک باشگاه ورزشی) عضو باشد."
          action={
            clubsQuery.data?.length ? (
              <Button size="sm" variant="outline" onClick={() => setTab('clubs')}>
                <Layers className="h-4 w-4" />
                مشاهدهٔ فهرست کامل
              </Button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          {clubsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : clubsQuery.data?.length ? (
            <>
              <p className="text-sm text-slate-500">
                شما در {formatNumber(clubGroups.length)} صنف و{' '}
                {formatNumber(clubsQuery.data.length)} مجموعه عضو هستید. مجموعهٔ فعال:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {session.tenantName}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {clubGroups.map((group) => {
                  const active = group.clubs.some((club) => club.tenantId === session.tenantId);
                  return (
                    <Badge key={group.industry} tone={active ? 'brand' : 'neutral'}>
                      {registry.label(group.industry)} • {formatNumber(group.clubs.length)}
                    </Badge>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Building2}
              title="هنوز در هیچ کسب‌وکاری عضو نیستید"
              description="حساب شما با همین شمارهٔ موبایل ساخته می‌شود و می‌تواند هم‌زمان در چند کسب‌وکار باشد. برای شروع: ۱) لینک یا QR دعوت همان مجموعه را باز کنید، ۲) از فهرست کسب‌وکارهای فعال در صفحهٔ ورود یکی را انتخاب کنید تا حساب شما همان لحظه ساخته شود، یا ۳) از مدیر مجموعه بخواهید شمارهٔ شما را در فهرست کاربرانش ثبت کند."
            />
          )}
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'attendance' && (
        <>
      {/* Attendance history */}
      <Card>
        <CardHeader title="سوابق حضور و غیاب" description="آخرین جلسات ثبت‌شده" />
        <CardBody className="space-y-2">
          {attendanceQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : attendance?.records.length ? (
            attendance.records.slice(0, 12).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <BadgeCheck className="h-5 w-5 text-slate-400" />
                  <span className="text-sm nums">{formatJalali(record.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {record.checkInAt && (
                    <span className="text-xs text-slate-400 nums">
                      {formatJalali(record.checkInAt, true).split('،').pop()}
                    </span>
                  )}
                  <Badge
                    tone={
                      record.status === 'PRESENT'
                        ? 'success'
                        : record.status === 'LATE'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {ATTENDANCE_STATUS_LABELS[record.status] ?? record.status}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={UserCheck} title="حضوری ثبت نشده است" />
          )}
        </CardBody>
      </Card>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
        اگر مدیر یا مربی لینک یا QR حاضری فرستاده، آن را باز کنید؛ می‌توانید حاضری را همان‌جا با
        کد تأیید موبایل ثبت کنید. برای جلسه‌های باز، از دکمهٔ «حاضرم» همین بخش استفاده کنید.
      </div>
        </>
      )}

      {tab === 'absence' && (
        <>
      <Card>
        <CardHeader
          title="درخواست غیبت / عدم حضور یک جلسه"
          description="اگر نمی‌توانید در جلسه‌ای شرکت کنید، علت را ثبت کنید تا مربی بررسی کند"
          action={
            <Badge tone="info">
              {(absenceQuery.data ?? []).filter((r) => r.status === 'PENDING').length} در انتظار
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="تاریخ جلسه"
              type="date"
              dir="ltr"
              className="nums"
              value={absenceDate}
              onChange={(e) => setAbsenceDate(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                علت
              </label>
              <Select value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)}>
                {ABSENCE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Input
            label="توضیح تکمیلی (اختیاری)"
            value={absenceNote}
            onChange={(e) => setAbsenceNote(e.target.value)}
          />
          <Button
            loading={createAbsence.isPending}
            disabled={!absenceDate}
            onClick={() => createAbsence.mutate()}
          >
            <CalendarDays className="h-4 w-4" />
            ارسال درخواست به مربی
          </Button>

          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">درخواست‌های من</p>
            {absenceQuery.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : absenceQuery.data?.length ? (
              absenceQuery.data.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm nums">{formatJalali(request.absenceDate)}</span>
                    <Badge tone={ABSENCE_STATUS_TONES[request.status] ?? 'neutral'}>
                      {ABSENCE_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.reason}
                    {request.note ? ` — ${request.note}` : ''}
                  </p>
                  {request.reviewNote && (
                    <p className="mt-1 text-xs text-brand-600">پاسخ مربی: {request.reviewNote}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">درخواستی ثبت نکرده‌اید.</p>
            )}
          </div>
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'appointments' && (
        <>
      <Card>
        <CardHeader title="نوبت‌های من" />
        <CardBody className="space-y-2">
          {appointmentsQuery.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : appointmentsQuery.data?.length ? (
            appointmentsQuery.data.slice(0, 10).map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium">{appointment.service?.name ?? 'نوبت'}</p>
                    <p className="text-xs text-slate-500">
                      {formatJalali(appointment.startsAt, true)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={appointment.status === 'CANCELED' ? 'neutral' : 'info'}>
                    {appointment.status}
                  </Badge>
                  {['SCHEDULED', 'CONFIRMED'].includes(appointment.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancel.mutate(appointment.id)}>
                      لغو
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="نوبتی ندارید" />
          )}
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'finance' && (
        <>
      <Card>
        <CardHeader title="فاکتورها و پرداخت" />
        <CardBody className="space-y-2">
          {invoicesQuery.data?.length ? (
            invoicesQuery.data.slice(0, 10).map((invoice) => {
              const remaining = Number(invoice.total) - Number(invoice.paidTotal);
              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-slate-500 nums">مانده: {formatToman(remaining)}</p>
                    </div>
                  </div>
                  {remaining > 0 ? (
                    <Button
                      size="sm"
                      loading={pay.isPending}
                      onClick={() => pay.mutate(invoice.id)}
                    >
                      پرداخت
                    </Button>
                  ) : (
                    <Badge tone="success">تسویه‌شده</Badge>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState title="فاکتوری ندارید" />
          )}
        </CardBody>
      </Card>

      {/* Wallet/points live on the home KPIs too; the finance tab keeps them
          next to the invoices they are spent on. */}
      <Card>
        <CardHeader title="کیف پول و امتیاز" description="اعتبار و امتیاز شما در این مجموعه" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-brand-600" />
            <div>
              <p className="text-xs text-slate-500">کیف پول</p>
              <p className="font-bold nums">
                {formatToman(loyaltyQuery.data?.walletBalance ?? 0)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">امتیاز</p>
              <p className="font-bold nums">{loyaltyQuery.data?.points ?? 0}</p>
            </div>
          </div>
        </CardBody>
      </Card>
        </>
      )}

      {tab === 'profile' && (
        <>
      {/* نام، شمارهٔ تماس و مجموعهٔ فعال — همان چیزی که کاربر با آن شناسایی
          می‌شود (درخواست کاربر: «صفحهٔ پروفایل حاوی اطلاعات شماره تماس»). */}
      <Card>
        <CardHeader
          title="اطلاعات من"
          description="نام، شمارهٔ تماس و مجموعه‌ای که همین حالا در پنل فعال است"
        />
        <CardBody className="space-y-3 text-sm">
          {meQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ProfileRow label="نام و نام خانوادگی">
                {activeClub?.fullName || session.fullName || meQuery.data?.member.fullName}
              </ProfileRow>
              <ProfileRow label="شمارهٔ موبایل">
                <span className="nums" dir="ltr">
                  {session.phone ?? meQuery.data?.member.phone ?? '—'}
                </span>
              </ProfileRow>
              {meQuery.data?.member.email && (
                <ProfileRow label="ایمیل">
                  <span dir="ltr">{meQuery.data.member.email}</span>
                </ProfileRow>
              )}
              <ProfileRow label="مجموعهٔ فعال">
                {session.tenantName}
                {registry.label(activeClub?.industry ?? meQuery.data?.tenant.industry) && (
                  <Badge tone="neutral">
                    {registry.label(activeClub?.industry ?? meQuery.data?.tenant.industry)}
                  </Badge>
                )}
              </ProfileRow>
              {(activeClub?.branch?.name || meQuery.data?.branch?.name) && (
                <ProfileRow label="محل / آموزشگاه">
                  {activeClub?.branch?.name ?? meQuery.data?.branch?.name}
                  {activeClub?.branch?.city ? ` • ${activeClub.branch.city}` : ''}
                </ProfileRow>
              )}
              {activeClub?.joinedAt && (
                <ProfileRow label="عضویت در این مجموعه از">
                  <span className="nums">{formatJalali(activeClub.joinedAt)}</span>
                </ProfileRow>
              )}
              <ProfileRow label="وضعیت ورود">
                {meQuery.data?.member.hasPassword ? (
                  <span>با رمز عبور یا کد یکبار مصرف وارد می‌شوید</span>
                ) : (
                  <span className="text-amber-600">فعلاً فقط با کد یکبار مصرف وارد می‌شوید</span>
                )}
              </ProfileRow>
            </div>
          )}
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-800/60">
            شمارهٔ موبایل شما کلید ورود و شناسایی‌تان است: با همین شماره می‌توانید در چند صنف و
            مجموعهٔ مختلف عضو باشید. برای دیدن یا تغییر مجموعهٔ فعال، از بخش «صنف‌ها و مجموعه‌ها»
            استفاده کنید.
          </p>
        </CardBody>
      </Card>

      <ChangePasswordCard
        hasPassword={meQuery.data?.member.hasPassword}
        token={session.accessToken}
        onDone={onLogout}
      />
        </>
      )}

      <Button variant="outline" className="w-full" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        خروج از حساب
      </Button>
      </div>
      </div>
    </div>
  );
}
