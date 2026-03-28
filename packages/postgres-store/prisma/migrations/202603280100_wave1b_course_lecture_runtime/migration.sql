-- CreateEnum
CREATE TYPE "LectureSourceType" AS ENUM ('TEXT', 'MARKDOWN', 'TRANSCRIPT_VTT', 'TRANSCRIPT_SRT');

-- CreateTable
CREATE TABLE "Lecture" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "domainId" TEXT NOT NULL,
  "courseId" UUID NOT NULL,
  "assetId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "sourceType" "LectureSourceType" NOT NULL,
  "assetPath" TEXT NOT NULL,
  "externalUrl" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lecture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lecture_domainId_key" ON "Lecture"("domainId");
CREATE UNIQUE INDEX "Lecture_assetId_key" ON "Lecture"("assetId");
CREATE INDEX "Lecture_courseId_createdAt_idx" ON "Lecture"("courseId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Lecture"
  ADD CONSTRAINT "Lecture_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lecture"
  ADD CONSTRAINT "Lecture_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "StoredAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
