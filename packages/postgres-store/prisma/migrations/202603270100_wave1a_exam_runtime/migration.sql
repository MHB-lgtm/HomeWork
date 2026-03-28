-- CreateEnum
CREATE TYPE "ExamIndexStatus" AS ENUM ('PROPOSED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "Exam" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assetId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "examRowId" UUID NOT NULL,
  "questionId" TEXT NOT NULL,
  "title" TEXT,
  "generalGuidance" TEXT,
  "criteriaJson" JSONB NOT NULL,
  "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamIndex" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "examRowId" UUID NOT NULL,
  "status" "ExamIndexStatus" NOT NULL,
  "generatedAt" TIMESTAMPTZ(6) NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  CONSTRAINT "ExamIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_domainId_key" ON "Exam"("domainId");
CREATE UNIQUE INDEX "Exam_assetId_key" ON "Exam"("assetId");
CREATE UNIQUE INDEX "Rubric_examRowId_questionId_key" ON "Rubric"("examRowId", "questionId");
CREATE INDEX "Rubric_examRowId_updatedAt_idx" ON "Rubric"("examRowId", "updatedAt" DESC);
CREATE UNIQUE INDEX "ExamIndex_examRowId_key" ON "ExamIndex"("examRowId");

-- AddForeignKey
ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "StoredAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Rubric"
  ADD CONSTRAINT "Rubric_examRowId_fkey"
  FOREIGN KEY ("examRowId") REFERENCES "Exam"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamIndex"
  ADD CONSTRAINT "ExamIndex_examRowId_fkey"
  FOREIGN KEY ("examRowId") REFERENCES "Exam"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
