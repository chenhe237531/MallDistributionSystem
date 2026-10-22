-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'pending_review', 'active', 'inactive');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "testItems" TEXT[],
    "sampleType" TEXT NOT NULL,
    "samplingMethod" TEXT NOT NULL,
    "storageCondition" TEXT NOT NULL,
    "shelfLifeDays" INTEGER,
    "supplyPriceCents" INTEGER NOT NULL,
    "suggestedRetailPriceCents" INTEGER,
    "retailPriceCents" INTEGER,
    "platformServiceRateBps" INTEGER NOT NULL DEFAULT 0,
    "commissionRateCapBps" INTEGER NOT NULL DEFAULT 0,
    "distributable" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantProduct" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailPriceCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_skuCode_key" ON "Product"("skuCode");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE INDEX "Batch_productId_expiresAt_idx" ON "Batch"("productId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_productId_batchNo_key" ON "Batch"("productId", "batchNo");

-- CreateIndex
CREATE INDEX "MerchantProduct_productId_idx" ON "MerchantProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProduct_merchantId_productId_key" ON "MerchantProduct"("merchantId", "productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
