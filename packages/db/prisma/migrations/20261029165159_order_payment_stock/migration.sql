-- CreateEnum
CREATE TYPE "OrderStockState" AS ENUM ('NONE', 'RESERVED', 'COMMITTED', 'RELEASED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'RESERVATION';
ALTER TYPE "StockMovementType" ADD VALUE 'RELEASE';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stockState" "OrderStockState" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "orderId" UUID;

-- CreateIndex
CREATE INDEX "payments_tenantId_orderId_idx" ON "payments"("tenantId", "orderId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
