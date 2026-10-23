-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "SalesCustomerClaim" (
    "id" TEXT NOT NULL,
    "salesId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "SalesCustomerClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesCustomerClaim_salesId_idx" ON "SalesCustomerClaim"("salesId");

-- CreateIndex
CREATE INDEX "SalesCustomerClaim_customerId_idx" ON "SalesCustomerClaim"("customerId");
