-- CreateEnum
CREATE TYPE "UserGlobalRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseMembershipRole" AS ENUM ('COURSE_ADMIN', 'LECTURER', 'STUDENT');

-- CreateEnum
CREATE TYPE "CourseMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "StoredAssetStorageKind" AS ENUM ('LOCAL_FILE', 'OBJECT_STORAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CourseMaterialKind" AS ENUM (
  'ASSIGNMENT_PROMPT',
  'ASSIGNMENT_SOLUTION',
  'EXAM_ORIGINAL',
  'EXAM_MODEL_SOLUTION',
  'SUBMISSION_PDF',
  'DERIVED_ARTIFACT',
  'EXPORT_BUNDLE',
  'LECTURE_ASSET'
);

-- CreateEnum
CREATE TYPE "SubmissionModuleType" AS ENUM ('ASSIGNMENT', 'EXAM_BATCH', 'LEGACY_JOB');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM (
  'UPLOADED',
  'SUPERSEDED',
  'QUEUED',
  'PROCESSED',
  'LECTURER_EDITED',
  'PUBLISHED'
);

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'LECTURER_EDITED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReviewVersionKind" AS ENUM ('AI_DRAFT', 'LECTURER_EDIT', 'PUBLISHED_SNAPSHOT');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('USER', 'AI', 'LEGACY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PublishedResultStatus" AS ENUM ('EFFECTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "GradebookEntryStatus" AS ENUM ('EFFECTIVE');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "normalizedEmail" TEXT,
  "displayName" TEXT,
  "globalRole" "UserGlobalRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityAlias" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Course" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "legacyCourseKey" TEXT,
  "title" TEXT NOT NULL,
  "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseMembership" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "courseId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "CourseMembershipRole" NOT NULL,
  "status" "CourseMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "joinedAt" TIMESTAMPTZ(6),
  "invitedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoredAsset" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "assetKey" TEXT NOT NULL,
  "storageKind" "StoredAssetStorageKind" NOT NULL,
  "logicalBucket" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "originalName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoredAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseMaterial" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "kind" "CourseMaterialKind" NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "studentUserId" UUID,
  "moduleType" "SubmissionModuleType" NOT NULL,
  "assignmentId" TEXT,
  "examBatchId" TEXT,
  "materialId" UUID NOT NULL,
  "submittedAt" TIMESTAMPTZ(6) NOT NULL,
  "state" "SubmissionState" NOT NULL,
  "supersedesSubmissionId" UUID,
  "legacyJobId" TEXT,
  "currentPublishedResultId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "currentVersionId" UUID,
  "state" "ReviewState" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "reviewId" UUID NOT NULL,
  "kind" "ReviewVersionKind" NOT NULL,
  "actorUserId" UUID,
  "actorKind" "ActorKind" NOT NULL,
  "actorRefRaw" TEXT,
  "score" DECIMAL(8,2),
  "maxScore" DECIMAL(8,2),
  "summary" TEXT,
  "questionBreakdown" JSONB,
  "rawPayload" JSONB NOT NULL,
  "flagsJson" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishedResult" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "studentUserId" UUID,
  "moduleType" "SubmissionModuleType" NOT NULL,
  "assignmentId" TEXT,
  "examBatchId" TEXT,
  "reviewId" UUID NOT NULL,
  "sourceReviewVersionId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL,
  "status" "PublishedResultStatus" NOT NULL,
  "finalScore" DECIMAL(8,2) NOT NULL,
  "maxScore" DECIMAL(8,2) NOT NULL,
  "summary" TEXT NOT NULL,
  "breakdownSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradebookEntry" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "studentUserId" UUID,
  "moduleType" "SubmissionModuleType" NOT NULL,
  "assignmentId" TEXT,
  "examBatchId" TEXT,
  "publishedResultId" UUID NOT NULL,
  "score" DECIMAL(8,2) NOT NULL,
  "maxScore" DECIMAL(8,2) NOT NULL,
  "status" "GradebookEntryStatus" NOT NULL,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradebookEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");
CREATE UNIQUE INDEX "IdentityAlias_kind_normalizedValue_key" ON "IdentityAlias"("kind", "normalizedValue");
CREATE UNIQUE INDEX "Course_domainId_key" ON "Course"("domainId");
CREATE UNIQUE INDEX "Course_legacyCourseKey_key" ON "Course"("legacyCourseKey");
CREATE UNIQUE INDEX "CourseMembership_courseId_userId_key" ON "CourseMembership"("courseId", "userId");
CREATE INDEX "CourseMembership_courseId_role_status_idx" ON "CourseMembership"("courseId", "role", "status");
CREATE INDEX "CourseMembership_userId_status_idx" ON "CourseMembership"("userId", "status");
CREATE UNIQUE INDEX "StoredAsset_assetKey_key" ON "StoredAsset"("assetKey");
CREATE UNIQUE INDEX "CourseMaterial_domainId_key" ON "CourseMaterial"("domainId");
CREATE INDEX "CourseMaterial_courseId_kind_idx" ON "CourseMaterial"("courseId", "kind");
CREATE UNIQUE INDEX "Submission_domainId_key" ON "Submission"("domainId");
CREATE UNIQUE INDEX "Submission_legacyJobId_key" ON "Submission"("legacyJobId");
CREATE INDEX "Submission_courseId_studentUserId_submittedAt_idx" ON "Submission"("courseId", "studentUserId", "submittedAt" DESC);
CREATE UNIQUE INDEX "Review_domainId_key" ON "Review"("domainId");
CREATE UNIQUE INDEX "Review_submissionId_key" ON "Review"("submissionId");
CREATE UNIQUE INDEX "ReviewVersion_domainId_key" ON "ReviewVersion"("domainId");
CREATE INDEX "ReviewVersion_reviewId_createdAt_idx" ON "ReviewVersion"("reviewId", "createdAt" DESC);
CREATE UNIQUE INDEX "PublishedResult_domainId_key" ON "PublishedResult"("domainId");
CREATE INDEX "PublishedResult_submissionId_publishedAt_idx" ON "PublishedResult"("submissionId", "publishedAt" DESC);
CREATE INDEX "PublishedResult_courseId_studentUserId_publishedAt_idx" ON "PublishedResult"("courseId", "studentUserId", "publishedAt" DESC);
CREATE UNIQUE INDEX "GradebookEntry_domainId_key" ON "GradebookEntry"("domainId");
CREATE UNIQUE INDEX "GradebookEntry_publishedResultId_key" ON "GradebookEntry"("publishedResultId");
CREATE INDEX "GradebookEntry_courseId_publishedAt_idx" ON "GradebookEntry"("courseId", "publishedAt" DESC);

ALTER TABLE "IdentityAlias" ADD CONSTRAINT "IdentityAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "StoredAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CourseMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_sourceReviewVersionId_fkey" FOREIGN KEY ("sourceReviewVersionId") REFERENCES "ReviewVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GradebookEntry" ADD CONSTRAINT "GradebookEntry_publishedResultId_fkey" FOREIGN KEY ("publishedResultId") REFERENCES "PublishedResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_moduleType_parity_check"
  CHECK (
    ("moduleType" = 'ASSIGNMENT' AND "assignmentId" IS NOT NULL AND "examBatchId" IS NULL)
    OR ("moduleType" = 'EXAM_BATCH' AND "assignmentId" IS NULL AND "examBatchId" IS NOT NULL)
    OR ("moduleType" = 'LEGACY_JOB' AND "assignmentId" IS NULL AND "examBatchId" IS NULL AND "legacyJobId" IS NOT NULL)
  );

ALTER TABLE "PublishedResult"
  ADD CONSTRAINT "PublishedResult_moduleType_parity_check"
  CHECK (
    ("moduleType" = 'ASSIGNMENT' AND "assignmentId" IS NOT NULL AND "examBatchId" IS NULL)
    OR ("moduleType" = 'EXAM_BATCH' AND "assignmentId" IS NULL AND "examBatchId" IS NOT NULL)
    OR ("moduleType" = 'LEGACY_JOB' AND "assignmentId" IS NULL AND "examBatchId" IS NULL)
  );

ALTER TABLE "GradebookEntry"
  ADD CONSTRAINT "GradebookEntry_moduleType_parity_check"
  CHECK (
    ("moduleType" = 'ASSIGNMENT' AND "assignmentId" IS NOT NULL AND "examBatchId" IS NULL)
    OR ("moduleType" = 'EXAM_BATCH' AND "assignmentId" IS NULL AND "examBatchId" IS NOT NULL)
    OR ("moduleType" = 'LEGACY_JOB' AND "assignmentId" IS NULL AND "examBatchId" IS NULL)
  );

CREATE UNIQUE INDEX "PublishedResult_effective_submission_idx"
  ON "PublishedResult" ("submissionId")
  WHERE "status" = 'EFFECTIVE';
