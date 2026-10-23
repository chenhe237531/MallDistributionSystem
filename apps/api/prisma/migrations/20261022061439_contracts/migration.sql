-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'pending_sign', 'signing', 'active', 'pending_renewal', 'terminated');

-- CreateEnum
CREATE TYPE "SignMode" AS ENUM ('esignbao', 'tencent', 'offline');

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "partyType" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "lockedClauses" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "subjectType" "Role" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "signMode" "SignMode",
    "provider" TEXT,
    "fileHash" TEXT,
    "evidenceNo" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ESignTask" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "signUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ESignTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineAgreement" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "scanFileUrl" TEXT,
    "registeredBy" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "OfflineAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_code_version_key" ON "ContractTemplate"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

-- CreateIndex
CREATE INDEX "Contract_subjectUserId_idx" ON "Contract"("subjectUserId");

-- CreateIndex
CREATE INDEX "ESignTask_contractId_idx" ON "ESignTask"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineAgreement_contractId_key" ON "OfflineAgreement"("contractId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESignTask" ADD CONSTRAINT "ESignTask_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineAgreement" ADD CONSTRAINT "OfflineAgreement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
