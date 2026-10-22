-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('not_started', 'learning', 'pending_exam', 'passed', 'expired');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "audience" "Role"[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "validityMonths" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseChapter" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" JSONB NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedChapterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "examScore" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastExamAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "CourseChapter_courseId_idx" ON "CourseChapter"("courseId");

-- CreateIndex
CREATE INDEX "ExamQuestion_courseId_idx" ON "ExamQuestion"("courseId");

-- CreateIndex
CREATE INDEX "LearningRecord_courseId_idx" ON "LearningRecord"("courseId");

-- CreateIndex
CREATE INDEX "LearningRecord_userId_idx" ON "LearningRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningRecord_userId_courseId_key" ON "LearningRecord"("userId", "courseId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_courseId_idx" ON "ExamAttempt"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecord" ADD CONSTRAINT "LearningRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRecord" ADD CONSTRAINT "LearningRecord_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
