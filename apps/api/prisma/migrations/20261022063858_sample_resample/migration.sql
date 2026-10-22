-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "abnormalReason" TEXT,
ADD COLUMN     "resampleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resampleOfId" TEXT;
