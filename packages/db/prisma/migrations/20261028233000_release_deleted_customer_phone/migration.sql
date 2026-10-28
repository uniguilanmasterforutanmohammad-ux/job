-- Soft-deleted customers used to keep their phone number, which occupies the
-- unique `(tenantId, phone)` slot forever: the same number could never be
-- registered again (P2002 / 409 on create). Deletion now releases the number
-- (see CustomersService.remove) and archives it in `meta.archivedPhone`.
--
-- This migration applies the same rule to rows that were deleted before the
-- fix. Data-only: the table structure is unchanged.
UPDATE "customers"
SET
    "meta" = COALESCE("meta", '{}'::jsonb) || jsonb_build_object('archivedPhone', "phone"),
    "phone" = NULL
WHERE "deletedAt" IS NOT NULL
  AND "phone" IS NOT NULL;
