-- AlterTable
ALTER TABLE "members" ADD COLUMN     "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "backup_records" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "sizeBytes" INTEGER,
    "location" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_records_tenantId_createdAt_idx" ON "backup_records"("tenantId", "createdAt");
