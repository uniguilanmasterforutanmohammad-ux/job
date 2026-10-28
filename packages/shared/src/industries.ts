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
