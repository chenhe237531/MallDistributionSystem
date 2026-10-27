-- AlterTable
ALTER TABLE "Sample" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "examineeAge" INTEGER,
ADD COLUMN     "relationship" TEXT,
ADD COLUMN     "remark" TEXT,
ADD COLUMN     "sampledAt" TIMESTAMP(3),
ADD COLUMN     "trackingNo" TEXT;
