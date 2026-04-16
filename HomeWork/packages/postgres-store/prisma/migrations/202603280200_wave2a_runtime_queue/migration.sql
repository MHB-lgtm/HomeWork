-- CreateEnum
CREATE TYPE "GradingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "GradingMode" AS ENUM ('RUBRIC', 'GENERAL');

-- CreateEnum
CREATE TYPE "GradingScope" AS ENUM ('QUESTION', 'DOCUMENT');

-- CreateTable
CREATE TABLE "GradingJob" (
    "id" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "courseId" UUID,
    "submissionId" UUID NOT NULL,
    "examRowId" UUID NOT NULL,
    "examSnapshotAssetId" UUID NOT NULL,
    "submissionAssetId" UUID NOT NULL,
    "questionAssetId" UUID,
    "status" "GradingJobStatus" NOT NULL,
    "questionId" TEXT,
    "submissionMimeType" TEXT,
    "gradingMode" "GradingMode" NOT NULL,
    "gradingScope" "GradingScope" NOT NULL,
    "notes" TEXT,
    "rubricJson" JSONB,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "workerId" TEXT,
    "claimedAt" TIMESTAMPTZ(6),
    "leaseExpiresAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GradingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" UUID NOT NULL,
    "workerId" TEXT NOT NULL,
    "pid" INTEGER NOT NULL,
    "hostname" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradingJob_domainId_key" ON "GradingJob"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingJob_submissionId_key" ON "GradingJob"("submissionId");

-- CreateIndex
CREATE INDEX "GradingJob_status_createdAt_idx" ON "GradingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GradingJob_status_leaseExpiresAt_idx" ON "GradingJob"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "GradingJob_workerId_idx" ON "GradingJob"("workerId");

-- CreateIndex
CREATE INDEX "GradingJob_courseId_createdAt_idx" ON "GradingJob"("courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerHeartbeat_workerId_key" ON "WorkerHeartbeat"("workerId");

-- CreateIndex
CREATE INDEX "WorkerHeartbeat_lastSeenAt_idx" ON "WorkerHeartbeat"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_examRowId_fkey" FOREIGN KEY ("examRowId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_examSnapshotAssetId_fkey" FOREIGN KEY ("examSnapshotAssetId") REFERENCES "StoredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_submissionAssetId_fkey" FOREIGN KEY ("submissionAssetId") REFERENCES "StoredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingJob" ADD CONSTRAINT "GradingJob_questionAssetId_fkey" FOREIGN KEY ("questionAssetId") REFERENCES "StoredAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
