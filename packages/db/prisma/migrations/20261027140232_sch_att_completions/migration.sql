-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "meta" JSONB NOT NULL DEFAULT '{}';
