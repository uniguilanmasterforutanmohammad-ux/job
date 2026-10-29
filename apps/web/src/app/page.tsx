import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Puzzle,
  ShieldCheck,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  INDUSTRY_CATEGORIES,
  MODULE_DESCRIPTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  industryLabel,
  type ModuleKey,
} from '@repo/shared';

const FEATURED_MODULES: ModuleKey[] = ['CRM', 'SCH', 'ATT', 'FIN', 'SUB', 'MSG'];

const STEPS = [
  {
    title: '۱. کسب‌وکارت را بساز',
    body: 'نام کسب‌وکار، صنف و شعبه را وارد کن. صنف، ماژول‌های پیشنهادی (نوبت، حاضری، مالی…) را خودکار فعال می‌کند.',
  },
  {
    title: '۲. مشتری و خدمت اضافه کن',
    body: 'خدمت‌ها، قیمت‌ها و مشتریان را وارد کن یا لینک عمومی کسب‌وکارت را بفرست تا خودشان ثبت‌نام کنند.',
  },
  {
    title: '۳. نوبت و حضور را مدیریت کن',
    body: 'تقویم روزانه، حاضری با QR/لینک و حاضری از پنل مشتری، همه در یک صفحه.',
  },
  {
    title: '۴. مالی و رشد',
    body: 'فاکتور، اقساط، اشتراک، پیامک یادآوری و گزارش درآمد به‌صورت خودکار.',
  },
];

const isDev = process.env.NODE_ENV !== 'production';
const apiDocsUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/docs`;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-brand-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* --- header --- */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-brand-600 p-2 text-white">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 sm:text-base">
              پلتفرم مدیریت کسب‌وکار
            </span>
          </div>
          <div className="hidden items-center gap-5 text-sm text-slate-600 md:flex dark:text-slate-300">
            <a href="#audience" className="hover:text-brand-600">
              برای چه کسی؟
            </a>
            <a href="#features" className="hover:text-brand-600">
              امکانات
            </a>
            <Link href="/marketplace" className="hover:text-brand-600">
              بازارگاه
            </Link>
            <a href="#how" className="hover:text-brand-600">
              شروع کار
            </a>
            <a href="#enter" className="hover:text-brand-600">
              ورود به بخش‌ها
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ورود کسب‌وکار
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700"
            >
              ثبت‌نام
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-5 py-10 sm:py-14">
        {/* --- hero --- */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              <BadgeCheck className="h-4 w-4" />
              ۱۷ صنف • ۷۰+ شغل خدماتی
            </span>
            <h1 className="text-3xl font-black leading-[1.35] text-slate-900 sm:text-4xl dark:text-slate-100">
              کسب‌وکار خدماتی‌ات را از مشتری تا مالی،
              <span className="text-brand-600"> یک‌جا مدیریت کن</span>
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">
              از مربی ورزشی، آموزشگاه زبان و کلینیک تا سالن زیبایی، دفتر وکالت و فروشگاه:
              پلتفرم ماژولار برای نوبت‌دهی، حضور و غیاب، مالی، اشتراک و پیام — به‌همراه
              پنل اختصاصی برای مشتریان شما.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700"
              >
                <Building2 className="h-4 w-4" />
                ساخت کسب‌وکار (رایگان)
              </Link>
              <Link
                href="/me"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <UserRound className="h-4 w-4" />
                پنل کاربری من (مشتریان)
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: CalendarClock, title: 'نوبت‌دهی آنلاین', body: 'ظرفیت، یادآور و لغو' },
                { icon: CreditCard, title: 'مالی یکپارچه', body: 'فاکتور، قسط، اشتراک' },
                { icon: ShieldCheck, title: 'چند‌شعبه‌ای و امن', body: 'جداسازی داده هر کسب‌وکار' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <item.icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500">{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* --- audience cards (8.b / 8.c) --- */}
          <section id="audience" className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                <Building2 className="h-3.5 w-3.5" />
                برای صاحبان کسب‌وکار
              </span>
              <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
                مربی، پزشک، آرایشگر، وکیل، فروشنده… هستید؟
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                ثبت‌نام کن، صنفت را انتخاب کن و ماژول‌های لازم را همان لحظه فعال کن. دادهٔ هر
                کسب‌وکار جدا نگه داشته می‌شود و می‌توانی عضو تیم (مربی، پذیرش، حسابدار) اضافه کنی.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li>• پروندهٔ مشتری، نوبت و حضور و غیاب</li>
                <li>• فاکتور، پرداخت، قسط و اشتراک</li>
                <li>• گزارش درآمد و عملکرد تیم</li>
              </ul>
              <Link
                href="/register"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                ثبت‌نام کسب‌وکار
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                <UserRound className="h-3.5 w-3.5" />
                برای مشتریان و مراجعان
              </span>
              <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
                شاگرد، زبان‌آموز، بیمار، موکل، مسافر… هستید؟
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                یک پنل کاربری مشترک برای همهٔ کسب‌وکارهایی که در آن‌ها عضو هستید: نوبت‌ها،
                فاکتور و پرداخت، کیف پول و امتیاز، سوابق حضور و ثبت «حاضرم» از پنل.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <li>• ورود فقط با شماره موبایل و کد تأیید</li>
                <li>• عضویت با لینک یا QR اختصاصی هر کسب‌وکار</li>
                <li>• درخواست غیبت موجه و پیگیری تأیید آن</li>
              </ul>
              <Link
                href="/me"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/20"
              >
                ورود / ثبت‌نام مشتریان
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </section>
        </section>

        {/* --- features (8.a) --- */}
        <section id="features" className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              هر بخش، برای یک کار مشخص
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ماژول‌ها را لازم که داشتی فعال کن؛ بقیه دست‌نخورده می‌مانند.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE_KEYS.filter((key) => FEATURED_MODULES.includes(key)).map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm dark:border-brand-900/50 dark:bg-slate-900"
              >
                <p className="text-sm font-bold text-brand-700 dark:text-brand-200">
                  {MODULE_LABELS[key]}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {MODULE_DESCRIPTIONS[key]}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_KEYS.filter((key) => !FEATURED_MODULES.includes(key)).map((key) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {MODULE_LABELS[key]}
                </p>
                <p className="mt-1.5 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {MODULE_DESCRIPTIONS[key]}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Puzzle className="h-4 w-4 text-brand-600" />
              برای این صنف‌ها آماده است
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INDUSTRY_CATEGORIES.map((industry) => (
                <span
                  key={industry}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {industryLabel(industry)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              نام مشتریان شما در پنل، با صنف تطبیق داده می‌شود: در باشگاه «شاگرد»، در کلینیک
              «بیمار»، در آموزشگاه «زبان‌آموز»، در دفتر وکالت «موکل» و…
            </p>
          </div>
        </section>

        {/* --- how it works --- */}
        <section id="how" className="space-y-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
            از صفر تا اولین نوبت، در چند دقیقه
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{step.title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* --- entries (8.d) --- */}
        <section id="enter" className="space-y-5">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">
            ورود به بخش‌ها
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EntryCard
              href="/login"
              icon={<Building2 className="h-5 w-5" />}
              title="پنل کسب‌وکار"
              body="صاحب کسب‌وکار و اعضای تیم"
            />
            <EntryCard
              href="/me"
              icon={<UserRound className="h-5 w-5" />}
              title="پنل کاربری مشتری"
              body="نوبت، فاکتور، حضور و کیف پول"
            />
            <EntryCard
              href="/marketplace"
              icon={<Store className="h-5 w-5" />}
              title="بازارگاه محصولات و خدمات"
              body="خرید از فروشگاه‌ها و رزرو خدمات اصناف"
            />
            <EntryCard
              href="/admin/login"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="بنل مدیریت پلتفرم"
              body="اپراتورهای پلتفرم"
              badge="موقت"
            />
            <EntryCard
              href={apiDocsUrl}
              icon={<Wallet className="h-5 w-5" />}
              title="مستندات فنی API"
              body="Swagger برای توسعه‌دهندگان"
              external
            />
          </div>

          {isDev && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">حالت توسعه: اکانت‌های آزمایشی</p>
              <p className="mt-1 leading-7">
                کسب‌وکار: موبایل <span className="nums">09121111111</span> — کد{' '}
                <span className="nums">123456</span> • مشتری/شاگرد: هر موبایل، نمونه{' '}
                <span className="nums">09122222222</span> — کد <span className="nums">123456</span> •
                اپراتور پلتفرم: <span className="nums">09120000001</span> /{' '}
                <span className="font-mono">Admin@12345</span>
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white/70 py-8 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>پلتفرم مدیریت کسب‌وکارهای خدماتی و تک‌شغلی — نسخهٔ آزمایشی (پایلوت: مربیگری ورزشی)</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="hover:text-brand-600">
              ساخت کسب‌وکار
            </Link>
            <Link href="/login" className="hover:text-brand-600">
              ورود کسب‌وکار
            </Link>
            <Link href="/me" className="hover:text-brand-600">
              پنل مشتریان
            </Link>
            <Link href="/admin/login" className="hover:text-brand-600">
              ورود اپراتور (موقت)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EntryCard({
  href,
  icon,
  title,
  body,
  badge,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  badge?: string;
  external?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="rounded-xl bg-brand-50 p-2 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200">
          {icon}
        </span>
        {badge && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{body}</p>
    </>
  );

  const className =
    'block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900';

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
