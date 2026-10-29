-- AlterTable
ALTER TABLE "products" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "category" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "city" TEXT,
ADD COLUMN     "marketplaceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tagline" TEXT;

-- CreateIndex
CREATE INDEX "products_isPublic_isActive_idx" ON "products"("isPublic", "isActive");

-- CreateIndex
CREATE INDEX "services_isPublic_isActive_idx" ON "services"("isPublic", "isActive");

-- CreateIndex
CREATE INDEX "tenants_marketplaceEnabled_status_idx" ON "tenants"("marketplaceEnabled", "status");
