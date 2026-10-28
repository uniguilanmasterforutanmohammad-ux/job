/** The 17 industry categories from PRD §17. */
export const INDUSTRY_CATEGORIES = [
  'SPORTS_COACHING',
  'LANGUAGE_SCHOOL',
  'BEAUTY',
  'HEALTHCARE',
  'ART_MUSIC',
  'EARLY_CHILD',
  'PSYCHOLOGY',
  'LEGAL',
  'MEDIA_PHOTO',
  'TECHNOLOGY',
  'RESTAURANT_CAFE',
  'RETAIL',
  'TECHNICAL_SERVICES',
  'REAL_ESTATE',
  'TRANSPORT',
  'TOURISM',
  'BUSINESS_CONSULTING',
] as const;

export type IndustryCategory = (typeof INDUSTRY_CATEGORIES)[number];

export const INDUSTRY_LABELS: Record<IndustryCategory, string> = {
  SPORTS_COACHING: 'ورزش و تندرستی',
  LANGUAGE_SCHOOL: 'آموزش زبان',
  BEAUTY: 'زیبایی و آرایش',
  HEALTHCARE: 'پزشکی و سلامت',
  ART_MUSIC: 'هنر و موسیقی',
  EARLY_CHILD: 'کودک و آموزش اولیه',
  PSYCHOLOGY: 'روانشناسی و مشاوره',
  LEGAL: 'حقوقی و مشاوره',
  MEDIA_PHOTO: 'رسانه و عکاسی',
  TECHNOLOGY: 'فناوری و کامپیوتر',
  RESTAURANT_CAFE: 'رستوران و کافه',
  RETAIL: 'فروشگاه و خرده‌فروشی',
  TECHNICAL_SERVICES: 'خدمات فنی',
  REAL_ESTATE: 'املاک و مستغلات',
  TRANSPORT: 'حمل‌ونقل',
  TOURISM: 'گردشگری',
  BUSINESS_CONSULTING: 'مشاور تخصصی',
};

export function industryLabel(value: string): string {
  return INDUSTRY_LABELS[value as IndustryCategory] ?? value;
}

/**
 * What a business in each industry calls its own customers. The end-user
 * portal is generic (`/me`, «پنل کاربری») because «شاگرد» is only right for a
 * sports club: a clinic calls them بیمار, a law office موکل, a language school
 * زبان‌آموز and a travel agency گردشگر.
 */
export const END_USER_NOUNS: Record<IndustryCategory, string> = {
  SPORTS_COACHING: 'شاگرد',
  LANGUAGE_SCHOOL: 'زبان‌آموز',
  BEAUTY: 'مشتری',
  HEALTHCARE: 'بیمار',
  ART_MUSIC: 'هنرجو',
  EARLY_CHILD: 'والد',
  PSYCHOLOGY: 'مراجع',
  LEGAL: 'موکل',
  MEDIA_PHOTO: 'مشتری',
  TECHNOLOGY: 'مشتری',
  RESTAURANT_CAFE: 'مشتری',
  RETAIL: 'مشتری',
  TECHNICAL_SERVICES: 'مشتری',
  REAL_ESTATE: 'مشتری',
  TRANSPORT: 'مسافر',
  TOURISM: 'گردشگر',
  BUSINESS_CONSULTING: 'مراجع',
};

/** Plural form of {@link END_USER_NOUNS}, e.g. «شاگردان» / «بیماران». */
export const END_USER_NOUNS_PLURAL: Record<IndustryCategory, string> = {
  SPORTS_COACHING: 'شاگردان',
  LANGUAGE_SCHOOL: 'زبان‌آموزان',
  BEAUTY: 'مشتریان',
  HEALTHCARE: 'بیماران',
  ART_MUSIC: 'هنرجویان',
  EARLY_CHILD: 'والدین',
  PSYCHOLOGY: 'مراجعان',
  LEGAL: 'موکلان',
  MEDIA_PHOTO: 'مشتریان',
  TECHNOLOGY: 'مشتریان',
  RESTAURANT_CAFE: 'مشتریان',
  RETAIL: 'مشتریان',
  TECHNICAL_SERVICES: 'مشتریان',
  REAL_ESTATE: 'مشتریان',
  TRANSPORT: 'مسافران',
  TOURISM: 'گردشگران',
  BUSINESS_CONSULTING: 'مراجعان',
};

/** Generic fallback used when the industry is unknown (`OTHER`, null, …). */
export const DEFAULT_END_USER_NOUN = 'مشتری';

/**
 * What each industry calls one of its locations (شعبه/آموزشگاه/مهدکودک …).
 * A language school or a music school runs «آموزشگاه»ها, while most other
 * businesses just have «شعبه». Fallback = {@link DEFAULT_BRANCH_NOUN}.
 */
export const BRANCH_NOUNS: Partial<Record<IndustryCategory, string>> = {
  LANGUAGE_SCHOOL: 'آموزشگاه',
  ART_MUSIC: 'آموزشگاه',
  EARLY_CHILD: 'مهدکودک',
};

/** Plural form of {@link BRANCH_NOUNS}, e.g. «آموزشگاه‌ها». */
export const BRANCH_NOUNS_PLURAL: Partial<Record<IndustryCategory, string>> = {
  LANGUAGE_SCHOOL: 'آموزشگاه‌ها',
  ART_MUSIC: 'آموزشگاه‌ها',
  EARLY_CHILD: 'مهدکودک‌ها',
};

/** Generic fallback used when the industry has no location noun of its own. */
export const DEFAULT_BRANCH_NOUN = 'شعبه';

/** Plural of {@link DEFAULT_BRANCH_NOUN} (ZWNJ spelled out, not concatenated). */
export const DEFAULT_BRANCH_NOUN_PLURAL = 'شعبه‌ها';

/**
 * Name of one business location for a given industry.
 *
 * ```ts
 * branchNoun('LANGUAGE_SCHOOL');        // «آموزشگاه»
 * branchNoun('RETAIL', true);           // «شعبه‌ها»
 * branchNoun(null);                     // «شعبه»
 * ```
 */
export function branchNoun(industry?: string | null, plural = false): string {
  const table = plural ? BRANCH_NOUNS_PLURAL : BRANCH_NOUNS;
  const noun = industry ? table[industry as IndustryCategory] : undefined;
  return noun ?? (plural ? DEFAULT_BRANCH_NOUN_PLURAL : DEFAULT_BRANCH_NOUN);
}

/**
 * Name of the business's end users for a given industry.
 *
 * ```ts
 * endUserNoun('HEALTHCARE');        // «بیمار»
 * endUserNoun('SPORTS_COACHING', true); // «شاگردان»
 * endUserNoun(null);                // «مشتری»
 * ```
 */
export function endUserNoun(industry?: string | null, plural = false): string {
  const table = plural ? END_USER_NOUNS_PLURAL : END_USER_NOUNS;
  const noun = industry ? table[industry as IndustryCategory] : undefined;
  return noun ?? (plural ? `${DEFAULT_END_USER_NOUN}ان` : DEFAULT_END_USER_NOUN);
}
