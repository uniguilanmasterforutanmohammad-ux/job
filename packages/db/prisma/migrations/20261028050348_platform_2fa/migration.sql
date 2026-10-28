-- AlterTable
ALTER TABLE "platform_members" ADD COLUMN     "twoFactorConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastTimeStep" BIGINT,
ADD COLUMN     "twoFactorPendingSecret" TEXT;
