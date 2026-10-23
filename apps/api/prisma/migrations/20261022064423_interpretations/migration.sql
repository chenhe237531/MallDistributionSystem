-- CreateEnum
CREATE TYPE "InterpretationStatus" AS ENUM ('generating', 'generated', 'blocked', 'reviewed', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "Interpretation" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "InterpretationStatus" NOT NULL DEFAULT 'generating',
    "sections" JSONB,
    "aiRawOutput" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "modelVersion" TEXT NOT NULL DEFAULT 'mock-ai-v1',
    "sensitiveHits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewDiff" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interpretation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "interpretationId" TEXT,
    "customerId" TEXT NOT NULL,
    "nutritionistId" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "meals" JSONB NOT NULL,
    "followUpNodes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interpretation_reportId_idx" ON "Interpretation"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "Interpretation_reportId_version_key" ON "Interpretation"("reportId", "version");

-- CreateIndex
CREATE INDEX "NutritionPlan_reportId_idx" ON "NutritionPlan"("reportId");

-- CreateIndex
CREATE INDEX "NutritionPlan_customerId_idx" ON "NutritionPlan"("customerId");

-- AddForeignKey
ALTER TABLE "Interpretation" ADD CONSTRAINT "Interpretation_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_interpretationId_fkey" FOREIGN KEY ("interpretationId") REFERENCES "Interpretation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
