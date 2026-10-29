-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingMethodId" UUID;

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "freeAbove" DECIMAL(14,0),
    "estimatedDays" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_methods_tenantId_isActive_idx" ON "shipping_methods"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_methods_tenantId_name_key" ON "shipping_methods"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
