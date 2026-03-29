-- CreateEnum
CREATE TYPE "CourseRagMethod" AS ENUM ('LEXICAL_V1');

-- CreateTable
CREATE TABLE "CourseRagIndex" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "method" "CourseRagMethod" NOT NULL,
    "builtAt" TIMESTAMPTZ(6) NOT NULL,
    "lectureCount" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL,
    "chunkingJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CourseRagIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRagChunk" (
    "id" UUID NOT NULL,
    "indexId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "lectureId" UUID NOT NULL,
    "chunkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "anchorsJson" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseRagChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseRagIndex_courseId_key" ON "CourseRagIndex"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRagChunk_indexId_chunkId_key" ON "CourseRagChunk"("indexId", "chunkId");

-- CreateIndex
CREATE INDEX "CourseRagChunk_courseId_lectureId_order_idx" ON "CourseRagChunk"("courseId", "lectureId", "order");

-- AddForeignKey
ALTER TABLE "CourseRagIndex" ADD CONSTRAINT "CourseRagIndex_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRagChunk" ADD CONSTRAINT "CourseRagChunk_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CourseRagIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRagChunk" ADD CONSTRAINT "CourseRagChunk_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRagChunk" ADD CONSTRAINT "CourseRagChunk_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "Lecture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
