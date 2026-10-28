-- `INDUSTRY_DEFAULT_MODULES` in @repo/shared gives the three education verticals
-- MSG (اطلاعیه/پیامک) next to APP, but their `industry_default_modules` rows were
-- seeded from an older constant and `IndustryRegistryService.ensureSeeded()` only
-- ever creates *missing industries* — so those three rows silently drifted and a
-- brand-new language school/art school/kindergarten would start without messaging.
--
-- Re-sync them additively (never delete a key the platform admin added or removed
-- on purpose). This is a one-off repair on purpose: doing it on every boot would
-- undo the admin console's ability to edit an industry's default modules.
INSERT INTO "industry_default_modules" ("id", "industry", "key", "createdAt")
SELECT gen_random_uuid(), i.key, 'MSG'::"ModuleKey", CURRENT_TIMESTAMP
FROM "industries" i
WHERE i.key IN ('LANGUAGE_SCHOOL', 'ART_MUSIC', 'EARLY_CHILD')
ON CONFLICT ("industry", "key") DO NOTHING;
