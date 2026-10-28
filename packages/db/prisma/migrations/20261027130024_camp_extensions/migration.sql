-- AlterTable
ALTER TABLE "campaign_contributions" ADD COLUMN     "receiptNumber" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "surplusAction" TEXT;

-- CreateTable
CREATE TABLE "campaign_expenses" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(14,0) NOT NULL,
    "receiptKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_expenses_campaignId_idx" ON "campaign_expenses"("campaignId");

-- AddForeignKey
ALTER TABLE "campaign_expenses" ADD CONSTRAINT "campaign_expenses_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
