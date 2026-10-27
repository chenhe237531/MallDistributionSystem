-- 移植后健康助手（doc/health-assistant-prd.html §6.1）

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('pending_schedule', 'active', 'paused', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DosingScheme" AS ENUM ('morning_once', 'twice_daily');

-- CreateEnum
CREATE TYPE "PushSlot" AS ENUM ('morning', 'noon', 'evening');

-- CreateEnum
CREATE TYPE "PushTaskStatus" AS ENUM ('pending', 'sent', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "BowelPrepStatus" AS ENUM ('none', 'platform_ordered', 'self_confirmed', 'ready');

-- CreateTable
CREATE TABLE "TransplantJourney" (
    "id" TEXT NOT NULL,
    "journeyNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transplantDate" TIMESTAMP(3),
    "dosingScheme" "DosingScheme" NOT NULL DEFAULT 'morning_once',
    "status" "JourneyStatus" NOT NULL DEFAULT 'pending_schedule',
    "bowelPrepStatus" "BowelPrepStatus" NOT NULL DEFAULT 'none',
    "pauseReason" TEXT,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransplantJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyPushTask" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "slot" "PushSlot" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PushTaskStatus" NOT NULL DEFAULT 'pending',
    "notificationId" TEXT,
    "skipReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyPushTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BowelPrepRecord" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "path" TEXT,
    "productId" TEXT,
    "orderId" TEXT,
    "selfDrugName" TEXT,
    "selfNote" TEXT,
    "selfPhotoUrl" TEXT,
    "readyAt" TIMESTAMP(3),
    "readyBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BowelPrepRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransplantJourney_journeyNo_key" ON "TransplantJourney"("journeyNo");

-- CreateIndex
CREATE UNIQUE INDEX "TransplantJourney_orderId_orderItemId_key" ON "TransplantJourney"("orderId", "orderItemId");

-- CreateIndex
CREATE INDEX "TransplantJourney_customerId_status_idx" ON "TransplantJourney"("customerId", "status");

-- CreateIndex
CREATE INDEX "TransplantJourney_merchantId_status_idx" ON "TransplantJourney"("merchantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JourneyPushTask_journeyId_dayOffset_slot_key" ON "JourneyPushTask"("journeyId", "dayOffset", "slot");

-- CreateIndex
CREATE INDEX "JourneyPushTask_status_scheduledAt_idx" ON "JourneyPushTask"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "BowelPrepRecord_journeyId_key" ON "BowelPrepRecord"("journeyId");

-- AddForeignKey
ALTER TABLE "JourneyPushTask" ADD CONSTRAINT "JourneyPushTask_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TransplantJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowelPrepRecord" ADD CONSTRAINT "BowelPrepRecord_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "TransplantJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
