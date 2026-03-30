-- CreateEnum
CREATE TYPE "AssignmentState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'PROCESSING', 'REVIEWED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AssignmentMaterialRole" AS ENUM ('PROMPT', 'REFERENCE_SOLUTION');

-- CreateEnum
CREATE TYPE "GradingJobKind" AS ENUM ('EXAM', 'ASSIGNMENT');

CREATE TABLE "Week" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "order" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Assignment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "weekId" TEXT NOT NULL,
  "examRowId" UUID,
  "title" TEXT NOT NULL,
  "openAt" TIMESTAMPTZ(6) NOT NULL,
  "deadlineAt" TIMESTAMPTZ(6) NOT NULL,
  "state" "AssignmentState" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentMaterial" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assignmentId" UUID NOT NULL,
  "materialId" UUID NOT NULL,
  "role" "AssignmentMaterialRole" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentMaterial_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GradingJob"
  ADD COLUMN "jobKind" "GradingJobKind" NOT NULL DEFAULT 'EXAM',
  ADD COLUMN "assignmentId" TEXT,
  ADD COLUMN "promptAssetId" UUID,
  ADD COLUMN "referenceSolutionAssetId" UUID,
  ALTER COLUMN "examRowId" DROP NOT NULL,
  ALTER COLUMN "examSnapshotAssetId" DROP NOT NULL;

CREATE UNIQUE INDEX "Week_domainId_key" ON "Week"("domainId");
CREATE UNIQUE INDEX "Week_courseId_order_key" ON "Week"("courseId", "order");
CREATE INDEX "Week_courseId_createdAt_idx" ON "Week"("courseId", "createdAt" DESC);

CREATE UNIQUE INDEX "Assignment_domainId_key" ON "Assignment"("domainId");
CREATE UNIQUE INDEX "Assignment_examRowId_key" ON "Assignment"("examRowId");
CREATE INDEX "Assignment_courseId_state_openAt_idx" ON "Assignment"("courseId", "state", "openAt" ASC);
CREATE INDEX "Assignment_courseId_deadlineAt_idx" ON "Assignment"("courseId", "deadlineAt" ASC);

CREATE UNIQUE INDEX "AssignmentMaterial_assignmentId_role_key" ON "AssignmentMaterial"("assignmentId", "role");
CREATE UNIQUE INDEX "AssignmentMaterial_assignmentId_materialId_key" ON "AssignmentMaterial"("assignmentId", "materialId");
CREATE INDEX "AssignmentMaterial_materialId_idx" ON "AssignmentMaterial"("materialId");

CREATE INDEX "GradingJob_assignmentId_createdAt_idx" ON "GradingJob"("assignmentId", "createdAt" DESC);

ALTER TABLE "Week"
  ADD CONSTRAINT "Week_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "Week"("domainId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_examRowId_fkey"
  FOREIGN KEY ("examRowId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentMaterial"
  ADD CONSTRAINT "AssignmentMaterial_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentMaterial"
  ADD CONSTRAINT "AssignmentMaterial_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("domainId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GradingJob"
  ADD CONSTRAINT "GradingJob_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("domainId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GradingJob"
  ADD CONSTRAINT "GradingJob_promptAssetId_fkey"
  FOREIGN KEY ("promptAssetId") REFERENCES "StoredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradingJob"
  ADD CONSTRAINT "GradingJob_referenceSolutionAssetId_fkey"
  FOREIGN KEY ("referenceSolutionAssetId") REFERENCES "StoredAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradingJob"
  ADD CONSTRAINT "GradingJob_kind_fields_check"
  CHECK (
    (
      "jobKind" = 'EXAM'
      AND "examRowId" IS NOT NULL
      AND "examSnapshotAssetId" IS NOT NULL
      AND "assignmentId" IS NULL
      AND "promptAssetId" IS NULL
      AND "referenceSolutionAssetId" IS NULL
    )
    OR
    (
      "jobKind" = 'ASSIGNMENT'
      AND "assignmentId" IS NOT NULL
      AND "examRowId" IS NOT NULL
      AND "examSnapshotAssetId" IS NOT NULL
      AND "promptAssetId" IS NULL
      AND "referenceSolutionAssetId" IS NULL
      AND "questionAssetId" IS NULL
      AND "rubricJson" IS NULL
      AND "gradingMode" = 'GENERAL'
      AND "gradingScope" = 'DOCUMENT'
    )
  );

INSERT INTO "Week" ("id", "domainId", "courseId", "order", "title", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  CONCAT('week:', "Course"."domainId", ':default'),
  "Course"."id",
  1,
  'Default Week',
  "Course"."createdAt",
  "Course"."updatedAt"
FROM "Course";
