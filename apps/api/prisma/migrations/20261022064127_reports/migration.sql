-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'pending_review', 'published', 'corrected', 'archived');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sampleId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "labUserId" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "fields" JSONB NOT NULL,
    "summary" TEXT,
    "missingItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pdfUrl" TEXT,
    "reviewerId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportView" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'view',
    "version" INTEGER NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_sampleId_idx" ON "Report"("sampleId");

-- CreateIndex
CREATE INDEX "Report_customerId_idx" ON "Report"("customerId");

-- CreateIndex
CREATE INDEX "Report_merchantId_idx" ON "Report"("merchantId");

-- CreateIndex
CREATE INDEX "Report_channelId_idx" ON "Report"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportNo_version_key" ON "Report"("reportNo", "version");

-- CreateIndex
CREATE INDEX "ReportView_reportId_viewedAt_idx" ON "ReportView"("reportId", "viewedAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportView" ADD CONSTRAINT "ReportView_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
