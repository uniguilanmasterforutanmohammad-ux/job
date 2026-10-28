-- CreateEnum
CREATE TYPE "AttendanceQrSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPIRED');

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "sessionId" UUID;

-- CreateTable
CREATE TABLE "attendance_qr_sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "branchId" UUID,
    "serviceId" UUID,
    "appointmentId" UUID,
    "label" TEXT,
    "code" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "rotateSeconds" INTEGER NOT NULL DEFAULT 45,
    "radiusMeters" INTEGER NOT NULL DEFAULT 150,
    "requireOtp" BOOLEAN NOT NULL DEFAULT true,
    "status" "AttendanceQrSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedByMemberId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_qr_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_qr_sessions_tenantId_status_idx" ON "attendance_qr_sessions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "attendance_qr_sessions_code_idx" ON "attendance_qr_sessions"("code");

-- CreateIndex
CREATE INDEX "attendances_sessionId_idx" ON "attendances"("sessionId");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_qr_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_qr_sessions" ADD CONSTRAINT "attendance_qr_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
