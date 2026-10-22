-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('pending_payment', 'paid', 'pending_shipment', 'shipped', 'pending_sampling', 'testing', 'report_ready', 'completed', 'cancelled', 'refunding', 'refunded', 'after_sale');

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'pending_payment',
    "totalAmountCents" INTEGER NOT NULL,
    "paidAmountCents" INTEGER,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "preAttributionChannelId" TEXT,
    "preAttributionChannelType" TEXT,
    "attributedChannelId" TEXT,
    "attributedSalesId" TEXT,
    "commissionRuleVersion" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "paidAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "supplyPriceCents" INTEGER NOT NULL,
    "platformServiceRateBps" INTEGER NOT NULL,
    "commissionRateCapBps" INTEGER NOT NULL,
    "refundedQuantity" INTEGER NOT NULL DEFAULT 0,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesStockAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "releasedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SalesStockAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo");

-- CreateIndex
CREATE INDEX "SalesOrder_merchantId_idx" ON "SalesOrder"("merchantId");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_createdAt_idx" ON "SalesOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SalesOrderItem_orderId_idx" ON "SalesOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "SalesStockAllocation_orderItemId_idx" ON "SalesStockAllocation"("orderItemId");

-- CreateIndex
CREATE INDEX "SalesStockAllocation_orderId_idx" ON "SalesStockAllocation"("orderId");

-- CreateIndex
CREATE INDEX "SalesRefund_orderId_idx" ON "SalesRefund"("orderId");

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesStockAllocation" ADD CONSTRAINT "SalesStockAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesStockAllocation" ADD CONSTRAINT "SalesStockAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRefund" ADD CONSTRAINT "SalesRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
