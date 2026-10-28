-- End-users (زبان‌آموز/شاگرد/بیمار …) can be filed under a location so the
-- business can see, e.g., «آموزشگاه یک: ۲۰ زبان‌آموز / آموزشگاه دو: ۱۵».
-- The location itself already exists as `branches`; only the link is missing.
ALTER TABLE "customers" ADD COLUMN "branchId" uuid;

CREATE INDEX "customers_tenantId_branchId_idx" ON "customers"("tenantId", "branchId");

ALTER TABLE "customers"
    ADD CONSTRAINT "customers_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
