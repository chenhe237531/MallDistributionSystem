-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('estimated', 'pending_reconciliation', 'reconciling', 'reconciled', 'settled', 'invalid', 'disputed');

-- CreateEnum
CREATE TYPE "CommissionRateType" AS ENUM ('percentage', 'fixed');

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "rateType" "CommissionRateType" NOT NULL,
    "rateBps" INTEGER,
    "fixedAmountCents" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "commissionNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "beneficiaryId" TEXT NOT NULL,
    "beneficiaryType" TEXT NOT NULL,
    "baseAmountCents" INTEGER NOT NULL,
    "rateType" "CommissionRateType" NOT NULL,
    "rateBps" INTEGER,
    "fixedAmountCents" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "reversedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "ruleId" TEXT,
    "ruleVersion" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'estimated',
    "selfPurchase" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSettlement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "supplyCostCents" INTEGER NOT NULL,
    "platformServiceFeeCents" INTEGER NOT NULL,
    "level1CommissionCents" INTEGER NOT NULL,
    "level2CommissionCents" INTEGER NOT NULL,
    "merchantIncomeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommissionRule_productId_level_effectiveFrom_idx" ON "CommissionRule"("productId", "level", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_commissionNo_key" ON "Commission"("commissionNo");

-- CreateIndex
CREATE INDEX "Commission_orderId_idx" ON "Commission"("orderId");

-- CreateIndex
CREATE INDEX "Commission_beneficiaryId_idx" ON "Commission"("beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_orderItemId_level_ruleVersion_generation_key" ON "Commission"("orderItemId", "level", "ruleVersion", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSettlement_orderItemId_key" ON "OrderSettlement"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderSettlement_orderId_idx" ON "OrderSettlement"("orderId");
