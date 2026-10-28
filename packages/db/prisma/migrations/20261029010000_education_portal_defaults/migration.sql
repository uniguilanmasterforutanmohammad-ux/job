-- The education verticals were falling back to `FALLBACK_DEFAULT_MODULES`
-- (CRM/SCH/FIN/RPT), so a language school — or an art school or a kindergarten —
-- had no `APP` module and its زبان‌آموز/هنرجو saw an empty customer portal
-- (`/app/*` answers MODULE_DISABLED). Add the end-user portal to their defaults
-- (mirrors `INDUSTRY_DEFAULT_MODULES` in @repo/shared).
INSERT INTO "industry_default_modules" ("id", "industry", "key", "createdAt")
SELECT gen_random_uuid(), i.key, 'APP'::"ModuleKey", CURRENT_TIMESTAMP
FROM "industries" i
WHERE i.key IN ('LANGUAGE_SCHOOL', 'ART_MUSIC', 'EARLY_CHILD')
ON CONFLICT ("industry", "key") DO NOTHING;

-- Businesses already created for those verticals keep working: enable APP for
-- them (and its dependency CRM, which they already have) unless it was turned
-- off explicitly.
INSERT INTO "tenant_modules" ("id", "tenantId", "key", "isEnabled", "config", "enabledAt")
SELECT gen_random_uuid(), t.id, 'APP'::"ModuleKey", true, '{}'::jsonb, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE t.industry::text IN ('LANGUAGE_SCHOOL', 'ART_MUSIC', 'EARLY_CHILD')
  AND t."deletedAt" IS NULL
ON CONFLICT ("tenantId", "key") DO NOTHING;
