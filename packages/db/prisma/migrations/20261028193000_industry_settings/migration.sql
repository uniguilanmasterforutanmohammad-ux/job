-- CreateTable
CREATE TABLE "industry_settings" (
    "id" UUID NOT NULL,
    "industry" "IndustryCategory" NOT NULL,
    "isRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_default_modules" (
    "id" UUID NOT NULL,
    "industry" "IndustryCategory" NOT NULL,
    "key" "ModuleKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_default_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "industry_settings_industry_key" ON "industry_settings"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "industry_default_modules_industry_key_key" ON "industry_default_modules"("industry", "key");

-- CreateIndex
CREATE INDEX "industry_default_modules_industry_idx" ON "industry_default_modules"("industry");

-- AddForeignKey
ALTER TABLE "industry_default_modules" ADD CONSTRAINT "industry_default_modules_industry_fkey" FOREIGN KEY ("industry") REFERENCES "industry_settings"("industry") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: every PRD §17 industry starts enabled for registration.
INSERT INTO "industry_settings" ("id", "industry", "isRegistrationEnabled", "updatedAt") VALUES
    (gen_random_uuid(), 'SPORTS_COACHING', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LANGUAGE_SCHOOL', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'BEAUTY', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'HEALTHCARE', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'ART_MUSIC', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'EARLY_CHILD', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'PSYCHOLOGY', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'LEGAL', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MEDIA_PHOTO', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TECHNOLOGY', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RESTAURANT_CAFE', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'RETAIL', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TECHNICAL_SERVICES', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'REAL_ESTATE', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TRANSPORT', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'TOURISM', true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'BUSINESS_CONSULTING', true, CURRENT_TIMESTAMP);

-- Seed: default modules (mirrors INDUSTRY_DEFAULT_MODULES in @repo/shared,
-- with the CRM/SCH/FIN/RPT fallback for industries without a vertical set).
INSERT INTO "industry_default_modules" ("id", "industry", "key") VALUES
    (gen_random_uuid(), 'SPORTS_COACHING', 'CRM'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'SCH'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'FIN'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'ATT'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'MSG'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'SUB'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'RPT'),
    (gen_random_uuid(), 'SPORTS_COACHING', 'APP'),
    (gen_random_uuid(), 'BEAUTY', 'CRM'),
    (gen_random_uuid(), 'BEAUTY', 'SCH'),
    (gen_random_uuid(), 'BEAUTY', 'FIN'),
    (gen_random_uuid(), 'BEAUTY', 'MSG'),
    (gen_random_uuid(), 'BEAUTY', 'MKT'),
    (gen_random_uuid(), 'BEAUTY', 'RPT'),
    (gen_random_uuid(), 'HEALTHCARE', 'CRM'),
    (gen_random_uuid(), 'HEALTHCARE', 'SCH'),
    (gen_random_uuid(), 'HEALTHCARE', 'FIN'),
    (gen_random_uuid(), 'HEALTHCARE', 'MSG'),
    (gen_random_uuid(), 'HEALTHCARE', 'DOC'),
    (gen_random_uuid(), 'HEALTHCARE', 'RPT'),
    (gen_random_uuid(), 'HEALTHCARE', 'APP'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'CRM'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'SCH'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'FIN'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'INV'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'SHOP'),
    (gen_random_uuid(), 'RESTAURANT_CAFE', 'RPT'),
    (gen_random_uuid(), 'RETAIL', 'CRM'),
    (gen_random_uuid(), 'RETAIL', 'FIN'),
    (gen_random_uuid(), 'RETAIL', 'INV'),
    (gen_random_uuid(), 'RETAIL', 'SHOP'),
    (gen_random_uuid(), 'RETAIL', 'RPT'),
    (gen_random_uuid(), 'REAL_ESTATE', 'CRM'),
    (gen_random_uuid(), 'REAL_ESTATE', 'SCH'),
    (gen_random_uuid(), 'REAL_ESTATE', 'FIN'),
    (gen_random_uuid(), 'REAL_ESTATE', 'DOC'),
    (gen_random_uuid(), 'REAL_ESTATE', 'RPT'),
    (gen_random_uuid(), 'TOURISM', 'CRM'),
    (gen_random_uuid(), 'TOURISM', 'SCH'),
    (gen_random_uuid(), 'TOURISM', 'FIN'),
    (gen_random_uuid(), 'TOURISM', 'DOC'),
    (gen_random_uuid(), 'TOURISM', 'RPT'),
    (gen_random_uuid(), 'TOURISM', 'APP');

-- Fallback set (CRM, SCH, FIN, RPT) for the remaining industries.
INSERT INTO "industry_default_modules" ("id", "industry", "key")
SELECT gen_random_uuid(), industry, key
FROM (
    VALUES
        ('LANGUAGE_SCHOOL'::"IndustryCategory"), ('ART_MUSIC'::"IndustryCategory"),
        ('EARLY_CHILD'::"IndustryCategory"), ('PSYCHOLOGY'::"IndustryCategory"),
        ('LEGAL'::"IndustryCategory"), ('MEDIA_PHOTO'::"IndustryCategory"),
        ('TECHNOLOGY'::"IndustryCategory"), ('TECHNICAL_SERVICES'::"IndustryCategory"),
        ('TRANSPORT'::"IndustryCategory"), ('BUSINESS_CONSULTING'::"IndustryCategory")
) AS industries (industry)
CROSS JOIN (
    VALUES ('CRM'::"ModuleKey"), ('SCH'::"ModuleKey"), ('FIN'::"ModuleKey"), ('RPT'::"ModuleKey")
) AS defaults (key);
