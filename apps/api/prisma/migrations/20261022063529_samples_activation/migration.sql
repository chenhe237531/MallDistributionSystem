-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('generated', 'activated', 'pending_mail', 'in_transit', 'received_by_lab', 'testing', 'report_generated', 'published', 'abnormal', 'voided');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "questionnaireFields" JSONB;

-- CreateTable
CREATE TABLE "CustomerOwnership" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "merchantId" TEXT,
    "salesId" TEXT,
    "sourceBoxCode" TEXT NOT NULL,
    "ownedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "boxCode" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "reportAuthorization" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "device" TEXT,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "sampleNo" TEXT NOT NULL,
    "boxCodeId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "SampleStatus" NOT NULL DEFAULT 'activated',
    "samplingMethod" TEXT NOT NULL,
    "questionnaire" JSONB NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleEvent" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOwnership_customerId_key" ON "CustomerOwnership"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOwnership_channelId_idx" ON "CustomerOwnership"("channelId");

-- CreateIndex
CREATE INDEX "ConsentRecord_customerId_idx" ON "ConsentRecord"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_sampleNo_key" ON "Sample"("sampleNo");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_boxCodeId_key" ON "Sample"("boxCodeId");

-- CreateIndex
CREATE INDEX "Sample_customerId_idx" ON "Sample"("customerId");

-- CreateIndex
CREATE INDEX "Sample_merchantId_idx" ON "Sample"("merchantId");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "SampleEvent_sampleId_idx" ON "SampleEvent"("sampleId");

-- AddForeignKey
ALTER TABLE "CustomerOwnership" ADD CONSTRAINT "CustomerOwnership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_boxCodeId_fkey" FOREIGN KEY ("boxCodeId") REFERENCES "BoxCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleEvent" ADD CONSTRAINT "SampleEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
