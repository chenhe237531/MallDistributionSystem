-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('pending', 'reconciling', 'reconciled', 'settled', 'disputed');

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "statementNo" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'pending',
    "openingUnsettledCents" INTEGER NOT NULL DEFAULT 0,
    "newPayableCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "totalPayableCents" INTEGER NOT NULL DEFAULT 0,
    "voucherRegisteredCents" INTEGER NOT NULL DEFAULT 0,
    "voucherMissingCents" INTEGER NOT NULL DEFAULT 0,
    "differenceCents" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseAmountCents" INTEGER NOT NULL,
    "rateBps" INTEGER,
    "level" INTEGER,
    "ruleVersion" TEXT,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementVoucher" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taxNo" TEXT,
    "amountCents" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "imageUrl" TEXT,
    "registeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementDifference" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementDifference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Statement_statementNo_key" ON "Statement"("statementNo");

-- CreateIndex
CREATE INDEX "Statement_subjectType_subjectId_idx" ON "Statement"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_period_subjectType_subjectId_key" ON "Statement"("period", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "StatementLine_statementId_idx" ON "StatementLine"("statementId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementVoucher_voucherNo_key" ON "StatementVoucher"("voucherNo");

-- CreateIndex
CREATE INDEX "StatementVoucher_statementId_idx" ON "StatementVoucher"("statementId");

-- CreateIndex
CREATE INDEX "StatementDifference_statementId_idx" ON "StatementDifference"("statementId");

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementVoucher" ADD CONSTRAINT "StatementVoucher_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementDifference" ADD CONSTRAINT "StatementDifference_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
