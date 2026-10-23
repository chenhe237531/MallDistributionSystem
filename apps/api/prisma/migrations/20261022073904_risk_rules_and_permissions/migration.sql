-- AlterTable
ALTER TABLE "ChannelIdentity" ADD COLUMN     "riskReason" TEXT,
ADD COLUMN     "riskStatus" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "riskUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'normal';
