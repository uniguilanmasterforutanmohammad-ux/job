/**
 * Shared module registry mirroring the PRD §2 architecture layers.
 * Single source of truth for both API and Web.
 */
export const MODULE_KEYS = [
  'CRM',
  'SCH',
  'FIN',
  'ATT',
  'MSG',
  'SUB',
  'CAMP',
  'INV',
  'HR',
  'MKT',
  'SHOP',
  'DOC',
  'RPT',
  'APP',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  CRM: 'مدیریت مشتری',
  SCH: 'تقویم و نوبت‌دهی',
  FIN: 'مالی، فاکتور و پرداخت',
  ATT: 'حضور و غیاب',
  MSG: 'پیام و اطلاع‌رسانی',
  SUB: 'اشتراک، شهریه و عضویت',
  CAMP: 'کمپین و جمع‌آوری وجه',
  INV: 'موجودی و انبار',
  HR: 'کارکنان و حقوق',
  MKT: 'وفاداری و بازاریابی',
  SHOP: 'فروش آنلاین',
  DOC: 'اسناد و قرارداد',
  RPT: 'گزارش و داشبورد',
  APP: 'اپ کاربر نهایی',
};

/** One-line, user-facing description of each module (landing page, settings). */
export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  CRM: 'پروندهٔ مشتری، سرنخ‌ها، برچسب‌ها، یادداشت و تاریخچهٔ هر مراجع.',
  SCH: 'تقویم، نوبت‌دهی آنلاین، ظرفیت و یادآور جلسه‌ها.',
  FIN: 'فاکتور، دریافت و پرداخت، اقساط، صندوق و بدهی مشتریان.',
  ATT: 'حاضری با QR یا لینک، حاضری از پنل مشتری و غیبت موجه.',
  MSG: 'پیامک و اعلان خودکار برای یادآوری نوبت، بدهی و تولد.',
  SUB: 'اشتراک ماهانه، شهریه، تمدید و فریز عضویت.',
  CAMP: 'کمپین جمع‌آوری وجه برای لباس تیم، سفر یا رویداد.',
  INV: 'انبار، ورود و خروج کالا و هشدار موجودی کم.',
  HR: 'پروندهٔ کارکنان، حقوق پایه، پورسانت و عملکرد.',
  MKT: 'باشگاه مشتریان، امتیاز، کارت هدیه و نظرسنجی.',
  SHOP: 'فروشگاه آنلاین محصولات و خدمات کسب‌وکار.',
  DOC: 'قرارداد، رضایت‌نامه و اسناد قابل امضا.',
  RPT: 'داشبورد مدیریتی، درآمد، حضور و گزارش‌های تحلیلی.',
  APP: 'پنل کاربری مشتری: نوبت، فاکتور، کیف پول و حاضری.',
};

/**
 * Module dependencies (PRD §2): activating a module may require others.
 * e.g. SUB needs CRM + FIN.
 */
export const MODULE_DEPENDENCIES: Record<ModuleKey, ModuleKey[]> = {
  CRM: [],
  SCH: ['CRM'],
  FIN: ['CRM'],
  ATT: ['CRM'],
  MSG: ['CRM'],
  SUB: ['CRM', 'FIN'],
  CAMP: ['CRM', 'FIN'],
  INV: [],
  HR: [],
  MKT: ['CRM'],
  SHOP: ['INV', 'FIN'],
  DOC: [],
  RPT: [],
  APP: ['CRM'],
};

export function resolveModuleDependencies(keys: ModuleKey[]): ModuleKey[] {
  const resolved = new Set<ModuleKey>();
  const visit = (key: ModuleKey) => {
    if (resolved.has(key)) return;
    for (const dep of MODULE_DEPENDENCIES[key]) visit(dep);
    resolved.add(key);
  };
  keys.forEach(visit);
  return [...resolved];
}

/**
 * Default module set enabled per industry vertical (PRD §17 table).
 * Pilot = sports coaching.
 */
export const INDUSTRY_DEFAULT_MODULES: Record<string, ModuleKey[]> = {
  SPORTS_COACHING: ['CRM', 'SCH', 'FIN', 'ATT', 'MSG', 'SUB', 'RPT', 'APP'],
  BEAUTY: ['CRM', 'SCH', 'FIN', 'MSG', 'MKT', 'RPT'],
  HEALTHCARE: ['CRM', 'SCH', 'FIN', 'MSG', 'DOC', 'RPT', 'APP'],
  RESTAURANT_CAFE: ['CRM', 'SCH', 'FIN', 'INV', 'SHOP', 'RPT'],
  RETAIL: ['CRM', 'FIN', 'INV', 'SHOP', 'RPT'],
  REAL_ESTATE: ['CRM', 'SCH', 'FIN', 'DOC', 'RPT'],
  TOURISM: ['CRM', 'SCH', 'FIN', 'DOC', 'RPT', 'APP'],
};
