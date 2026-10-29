-- CreateTable
CREATE TABLE "bale_integrations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "botToken" TEXT NOT NULL,
    "botUsername" TEXT,
    "groupLink" TEXT,
    "chatId" TEXT,
    "chatTitle" TEXT,
    "adminConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "events" JSONB NOT NULL DEFAULT '["announcement"]',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bale_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "eventDate" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "baleStatus" TEXT NOT NULL DEFAULT 'SKIPPED',
    "baleError" TEXT,
    "baleMessageId" TEXT,
    "createdById" UUID,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bale_integrations_tenantId_key" ON "bale_integrations"("tenantId");

-- CreateIndex
CREATE INDEX "announcements_tenantId_publishedAt_idx" ON "announcements"("tenantId", "publishedAt");

-- AddForeignKey
ALTER TABLE "bale_integrations" ADD CONSTRAINT "bale_integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
