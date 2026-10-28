-- The industry registry becomes data-driven so the platform admin can add new
-- industries/jobs with a custom title, and so a tenant's industry is no longer
-- locked to a database enum.
--
-- 1) new `industries` table (replaces `industry_settings`)
-- 2) `industry_default_modules.industry` and `tenants.industry` become text FKs
-- 3) `IndustryCategory` enum is dropped

-- CreateTable
CREATE TABLE "industries" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "endUserNoun" TEXT,
    "endUserNounPlural" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "industries_sortOrder_idx" ON "industries"("sortOrder");

-- Seed: the 17 PRD §17 verticals, keeping their current registration flag.
INSERT INTO "industries" (
    "key", "label", "isSystem", "isRegistrationEnabled",
    "endUserNoun", "endUserNounPlural", "sortOrder", "updatedAt"
)
SELECT
    s."industry"::text,
    v."label",
    true,
    s."isRegistrationEnabled",
    v."noun",
    v."noun_plural",
    v."sort_order",
    CURRENT_TIMESTAMP
FROM "industry_settings" s
JOIN (
    VALUES
        ('SPORTS_COACHING',     'ورزش و تندرستی',      'شاگرد',     'شاگردان',   1),
        ('LANGUAGE_SCHOOL',     'آموزش زبان',          'زبان‌آموز',  'زبان‌آموزان', 2),
        ('BEAUTY',              'زیبایی و آرایش',      'مشتری',     'مشتریان',   3),
        ('HEALTHCARE',          'پزشکی و سلامت',       'بیمار',     'بیماران',   4),
        ('ART_MUSIC',           'هنر و موسیقی',        'هنرجو',     'هنرجویان',  5),
        ('EARLY_CHILD',         'کودک و آموزش اولیه',  'والد',      'والدین',    6),
        ('PSYCHOLOGY',          'روانشناسی و مشاوره',  'مراجع',     'مراجعان',   7),
        ('LEGAL',               'حقوقی و مشاوره',      'موکل',      'موکلان',    8),
        ('MEDIA_PHOTO',         'رسانه و عکاسی',       'مشتری',     'مشتریان',   9),
        ('TECHNOLOGY',          'فناوری و کامپیوتر',   'مشتری',     'مشتریان',  10),
        ('RESTAURANT_CAFE',     'رستوران و کافه',      'مشتری',     'مشتریان',  11),
        ('RETAIL',              'فروشگاه و خرده‌فروشی', 'مشتری',     'مشتریان',  12),
        ('TECHNICAL_SERVICES',  'خدمات فنی',           'مشتری',     'مشتریان',  13),
        ('REAL_ESTATE',         'املاک و مستغلات',     'مشتری',     'مشتریان',  14),
        ('TRANSPORT',           'حمل‌ونقل',            'مسافر',     'مسافران',  15),
        ('TOURISM',             'گردشگری',             'گردشگر',    'گردشگران', 16),
        ('BUSINESS_CONSULTING', 'مشاور تخصصی',         'مراجع',     'مراجعان',  17)
) AS v ("key", "label", "noun", "noun_plural", "sort_order") ON v."key" = s."industry"::text;

-- AlterTable: industry_default_modules.industry -> text FK to industries
ALTER TABLE "industry_default_modules" DROP CONSTRAINT "industry_default_modules_industry_fkey";
ALTER TABLE "industry_default_modules" ALTER COLUMN "industry" TYPE TEXT USING "industry"::text;
ALTER TABLE "industry_default_modules" ADD CONSTRAINT "industry_default_modules_industry_fkey"
    FOREIGN KEY ("industry") REFERENCES "industries"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tenants.industry -> text FK to industries
ALTER TABLE "tenants" ALTER COLUMN "industry" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "industry" TYPE TEXT USING "industry"::text;
ALTER TABLE "tenants" ALTER COLUMN "industry" SET DEFAULT 'SPORTS_COACHING';
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_industry_fkey"
    FOREIGN KEY ("industry") REFERENCES "industries"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable / DropEnum
DROP TABLE "industry_settings";
DROP TYPE "IndustryCategory";
