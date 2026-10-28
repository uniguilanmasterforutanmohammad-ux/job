-- Each industry names its own locations differently: an education vertical
-- ("آموزشگاه") is not the same as a retail "شعبه". These columns mirror
-- `endUserNoun`/`endUserNounPlural` so the business panel can label the
-- locations/branches with the industry's own wording.
ALTER TABLE "industries"
    ADD COLUMN "branchNoun" text,
    ADD COLUMN "branchNounPlural" text;

-- Backfill the education verticals (shared defaults: BRANCH_NOUNS in @repo/shared).
UPDATE "industries" SET "branchNoun" = 'آموزشگاه',    "branchNounPlural" = 'آموزشگاه‌ها'   WHERE "key" = 'LANGUAGE_SCHOOL';
UPDATE "industries" SET "branchNoun" = 'آموزشگاه',    "branchNounPlural" = 'آموزشگاه‌ها'   WHERE "key" = 'ART_MUSIC';
UPDATE "industries" SET "branchNoun" = 'مهدکودک',     "branchNounPlural" = 'مهدکودک‌ها'    WHERE "key" = 'EARLY_CHILD';
