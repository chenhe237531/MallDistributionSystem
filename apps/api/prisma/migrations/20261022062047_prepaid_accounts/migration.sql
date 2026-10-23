-- CreateEnum
CREATE TYPE "PrepaidAccountStatus" AS ENUM ('active', 'locked');

-- CreateEnum
CREATE TYPE "RechargeStatus" AS ENUM ('pending', 'pending_review', 'credited', 'rejected');

-- CreateEnum
CREATE TYPE "PrepaidEntryType" AS ENUM ('recharge', 'freeze', 'deduct', 'unfreeze', 'refund', 'adjust');

-- CreateTable
CREATE TABLE "PrepaidAccount" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "frozenCents" INTEGER NOT NULL DEFAULT 0,
    "totalRechargeCents" INTEGER NOT NULL DEFAULT 0,
    "totalDeductedCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PrepaidAccountStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepaidAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeOrder" (
    "id" TEXT NOT NULL,
    "rechargeNo" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAmountCents" INTEGER,
    "voucherUrl" TEXT,
    "payerName" TEXT,
    "status" "RechargeStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "registeredBy" TEXT,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepaidLedger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "PrepaidEntryType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "frozenAfterCents" INTEGER NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "operatorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepaidLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrepaidAccount_merchantId_key" ON "PrepaidAccount"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeOrder_rechargeNo_key" ON "RechargeOrder"("rechargeNo");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeOrder_voucherUrl_key" ON "RechargeOrder"("voucherUrl");

-- CreateIndex
CREATE INDEX "RechargeOrder_merchantId_idx" ON "RechargeOrder"("merchantId");

-- CreateIndex
CREATE INDEX "PrepaidLedger_accountId_createdAt_idx" ON "PrepaidLedger"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_type_subjectId_idx" ON "SystemAlert"("type", "subjectId");

-- AddForeignKey
ALTER TABLE "PrepaidAccount" ADD CONSTRAINT "PrepaidAccount_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechargeOrder" ADD CONSTRAINT "RechargeOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepaidLedger" ADD CONSTRAINT "PrepaidLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PrepaidAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
