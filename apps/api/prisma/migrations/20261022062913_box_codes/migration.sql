-- CreateEnum
CREATE TYPE "BoxCodeStatus" AS ENUM ('generated', 'active', 'used', 'voided');

-- CreateTable
CREATE TABLE "BoxCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "procurementOrderId" TEXT NOT NULL,
    "procurementItemId" TEXT,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "BoxCodeStatus" NOT NULL DEFAULT 'generated',
    "voidReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoxCode_code_key" ON "BoxCode"("code");

-- CreateIndex
CREATE INDEX "BoxCode_procurementOrderId_idx" ON "BoxCode"("procurementOrderId");

-- CreateIndex
CREATE INDEX "BoxCode_merchantId_idx" ON "BoxCode"("merchantId");

-- AddForeignKey
ALTER TABLE "BoxCode" ADD CONSTRAINT "BoxCode_procurementOrderId_fkey" FOREIGN KEY ("procurementOrderId") REFERENCES "ProcurementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
