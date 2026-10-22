-- CreateEnum
CREATE TYPE "Role" AS ENUM ('platform', 'supplier', 'lab', 'merchant', 'partner', 'sales', 'nutritionist', 'customer');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('pending', 'active', 'suspended', 'rejected');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('platform', 'merchant', 'partner');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" "Role"[],
    "primaryRole" "Role" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'pending',
    "organizationId" TEXT,
    "realName" TEXT,
    "idCardNo" TEXT,
    "gender" TEXT,
    "birthDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelIdentity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qualificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Qualification_userId_idx" ON "Qualification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIdentity_code_key" ON "ChannelIdentity"("code");

-- CreateIndex
CREATE INDEX "ChannelIdentity_userId_idx" ON "ChannelIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_partnerId_key" ON "Invitation"("partnerId");

-- CreateIndex
CREATE INDEX "Invitation_inviterId_idx" ON "Invitation"("inviterId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_type_subjectId_dueAt_key" ON "Reminder"("type", "subjectId", "dueAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelIdentity" ADD CONSTRAINT "ChannelIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
