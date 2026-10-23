-- CreateTable
CREATE TABLE "MaterialTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lockedClauses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicableProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validUntil" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelCode" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "generatedBy" TEXT NOT NULL,
    "channelReplaced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialTemplate_code_key" ON "MaterialTemplate"("code");

-- CreateIndex
CREATE INDEX "Material_merchantId_idx" ON "Material"("merchantId");

-- CreateIndex
CREATE INDEX "Material_templateId_idx" ON "Material"("templateId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MaterialTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
