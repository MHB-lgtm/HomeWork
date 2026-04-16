import type {
  ChunkHitV1,
  CourseChunk,
  RagManifest,
  StudyPointerV1,
} from '@hg/shared-schemas';
import { CourseChunkSchema, RagManifestSchema } from '@hg/shared-schemas';
import { CourseRagMethod, LectureSourceType, type PrismaClient } from '@prisma/client';
import { asJsonValue, toDate, toIsoString } from '../mappers/domain';
import { readStoredAssetBytes } from '../storage/runtime-asset-storage';
import {
  buildSnippet,
  scoreChunk,
  selectReasonTokens,
  tokenize,
  uniqueTokens,
} from '../utils/lexical-search';
import { buildTimeUrl } from '../utils/time';
import { parseSrtToSegments, parseVttToSegments, type TranscriptSegment } from '../utils/transcript';

const MAX_CHARS = 1200;
const OVERLAP_CHARS = 200;

type RagChunking = {
  maxChars: number;
  overlapChars: number;
};

type RagQueryResult = {
  hits: ChunkHitV1[];
  method: 'lexical_v1';
};

type SuggestStudyPointersResult = {
  pointers: StudyPointerV1[];
};

type RagLectureRow = {
  id: string;
  domainId: string;
  title: string;
  sourceType: LectureSourceType;
  externalUrl: string | null;
  asset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  };
};

type IndexedChunkRow = {
  chunkId: string;
  order: number;
  text: string;
  anchorsJson: unknown;
  lecture: {
    domainId: string;
    title: string;
    externalUrl: string | null;
  };
};

type InternalChunkHit = {
  chunk: CourseChunk;
  score: number;
  matchedTokens: string[];
  snippet: string;
  lectureTitle: string;
  lectureExternalUrl?: string;
};

export class CourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = 'CourseNotFoundError';
  }
}

export class IndexNotBuiltError extends Error {
  code = 'INDEX_NOT_BUILT';

  constructor(courseId: string) {
    super(`Index not built for courseId=${courseId}`);
    this.name = 'IndexNotBuiltError';
  }
}

const mapStoredMethod = (method: CourseRagMethod): 'lexical_v1' => {
  if (method !== CourseRagMethod.LEXICAL_V1) {
    throw new Error(`Unsupported stored RAG method: ${method}`);
  }
  return 'lexical_v1';
};

const defaultChunking = (): RagChunking => ({
  maxChars: MAX_CHARS,
  overlapChars: OVERLAP_CHARS,
});

const chunkText = (text: string): string[] => {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const joined = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join('\n\n');

  if (!joined) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < joined.length) {
    let end = Math.min(start + MAX_CHARS, joined.length);

    if (end < joined.length) {
      const window = joined.slice(start, end);
      const breakDouble = window.lastIndexOf('\n\n');
      const breakSingle = window.lastIndexOf('\n');
      const preferredBreak = breakDouble !== -1 ? breakDouble : breakSingle;

      if (preferredBreak !== -1 && preferredBreak > OVERLAP_CHARS) {
        end = start + preferredBreak;
      }
    }

    const chunk = joined.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end === joined.length) {
      break;
    }

    const nextStart = end - OVERLAP_CHARS;
    start = nextStart > start ? nextStart : start + (MAX_CHARS - OVERLAP_CHARS);
  }

  return chunks;
};

const chunkTextWithOffsets = (
  text: string
): Array<{ text: string; startIndex: number; endIndex: number }> => {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return [];
  }

  const chunks: Array<{ text: string; startIndex: number; endIndex: number }> = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHARS, normalized.length);

    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const breakDouble = window.lastIndexOf('\n\n');
      const breakSingle = window.lastIndexOf('\n');
      const preferredBreak = breakDouble !== -1 ? breakDouble : breakSingle;

      if (preferredBreak !== -1 && preferredBreak > OVERLAP_CHARS) {
        end = start + preferredBreak;
      }
    }

    const rawChunk = normalized.slice(start, end);
    const trimmedStart = rawChunk.trimStart();
    const leadingTrim = rawChunk.length - trimmedStart.length;
    const trimmedText = trimmedStart.trimEnd();
    const trailingTrim = trimmedStart.length - trimmedText.length;
    const adjustedStart = start + leadingTrim;
    const adjustedEnd = end - trailingTrim;

    if (trimmedText) {
      chunks.push({
        text: normalized.slice(adjustedStart, adjustedEnd),
        startIndex: adjustedStart,
        endIndex: adjustedEnd,
      });
    }

    if (end === normalized.length) {
      break;
    }

    const nextStart = end - OVERLAP_CHARS;
    start = nextStart > start ? nextStart : start + (MAX_CHARS - OVERLAP_CHARS);
  }

  return chunks;
};

const mapAnchorsToChunk = (
  segments: TranscriptSegment[],
  startIndex: number,
  endIndex: number
): { startSec?: number; endSec?: number } | undefined => {
  if (segments.length === 0) {
    return undefined;
  }

  let startSegmentIndex = segments.findIndex((segment) => segment.endOffset > startIndex);
  if (startSegmentIndex === -1) {
    startSegmentIndex = segments.length - 1;
  }

  let endSegmentIndex = -1;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i].startOffset < endIndex) {
      endSegmentIndex = i;
      break;
    }
  }
  if (endSegmentIndex === -1) {
    endSegmentIndex = 0;
  }

  const startSec = segments[startSegmentIndex]?.startSec;
  const endSec = segments[endSegmentIndex]?.endSec;

  if (startSec == null && endSec == null) {
    return undefined;
  }

  return { startSec, endSec };
};

const chunkLecture = (
  courseId: string,
  lectureId: string,
  rawText: string
): CourseChunk[] => {
  const textChunks = chunkText(rawText);
  return textChunks.map((text, index) =>
    CourseChunkSchema.parse({
      version: '1.0.0',
      chunkId: `chunk-${lectureId}-${index}`,
      courseId,
      lectureId,
      order: index,
      text,
    })
  );
};

const chunkTranscriptLecture = (
  courseId: string,
  lectureId: string,
  fullText: string,
  segments: TranscriptSegment[]
): CourseChunk[] => {
  const chunks = chunkTextWithOffsets(fullText);

  return chunks.map((chunk, index) =>
    CourseChunkSchema.parse({
      version: '1.0.0',
      chunkId: `chunk-${lectureId}-${index}`,
      courseId,
      lectureId,
      order: index,
      text: chunk.text,
      anchors: mapAnchorsToChunk(segments, chunk.startIndex, chunk.endIndex),
    })
  );
};

const compareHits = (a: InternalChunkHit, b: InternalChunkHit): number => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.chunk.lectureId !== b.chunk.lectureId) {
    return a.chunk.lectureId.localeCompare(b.chunk.lectureId);
  }
  if (a.chunk.order !== b.chunk.order) {
    return a.chunk.order - b.chunk.order;
  }
  return a.chunk.chunkId.localeCompare(b.chunk.chunkId);
};

const normalizeCourseChunk = (
  courseId: string,
  row: IndexedChunkRow
): CourseChunk =>
  CourseChunkSchema.parse({
    version: '1.0.0',
    chunkId: row.chunkId,
    courseId,
    lectureId: row.lecture.domainId,
    order: row.order,
    text: row.text,
    anchors: row.anchorsJson ?? undefined,
  });

export class PrismaCourseRagStore {
  constructor(
    private readonly prisma: Pick<
      PrismaClient,
      'course' | 'lecture' | 'courseRagIndex' | 'courseRagChunk' | '$transaction'
    >
  ) {}

  private async getCourseRow(courseId: string): Promise<{ id: string; domainId: string }>{
    const course = await this.prisma.course.findUnique({
      where: { domainId: courseId },
      select: { id: true, domainId: true },
    });

    if (!course) {
      throw new CourseNotFoundError(courseId);
    }

    return course;
  }

  private async ensureIndexRow(courseId: string): Promise<{
    course: { id: string; domainId: string };
    index: {
      id: string;
      courseId: string;
      method: CourseRagMethod;
      builtAt: Date;
      lectureCount: number;
      chunkCount: number;
      chunkingJson: unknown;
    };
  }> {
    const course = await this.getCourseRow(courseId);
    const index = await this.prisma.courseRagIndex.findUnique({
      where: { courseId: course.id },
      select: {
        id: true,
        courseId: true,
        method: true,
        builtAt: true,
        lectureCount: true,
        chunkCount: true,
        chunkingJson: true,
      },
    });

    if (!index) {
      throw new IndexNotBuiltError(courseId);
    }

    return { course, index };
  }

  async rebuildCourseRagIndex(courseId: string): Promise<{
    manifest: RagManifest;
    chunkCount: number;
    lectureCount: number;
  }> {
    const course = await this.getCourseRow(courseId);
    const lectures = await this.prisma.lecture.findMany({
      where: { courseId: course.id },
      select: {
        id: true,
        domainId: true,
        title: true,
        sourceType: true,
        externalUrl: true,
        asset: {
          select: {
            path: true,
            storageKind: true,
            logicalBucket: true,
            mimeType: true,
            originalName: true,
            assetKey: true,
            sizeBytes: true,
            metadata: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const chunks: CourseChunk[] = [];

    for (const lecture of lectures) {
      const content = (
        await readStoredAssetBytes({
          path: lecture.asset.path,
          storageKind: lecture.asset.storageKind,
          logicalBucket: lecture.asset.logicalBucket,
          mimeType: lecture.asset.mimeType ?? null,
          originalName: lecture.asset.originalName ?? null,
          assetKey: lecture.asset.assetKey ?? null,
          sizeBytes: lecture.asset.sizeBytes ?? null,
          metadata: lecture.asset.metadata ?? null,
        })
      ).toString('utf-8');

      try {
        switch (lecture.sourceType) {
          case LectureSourceType.TRANSCRIPT_VTT: {
            const parsed = parseVttToSegments(content);
            chunks.push(
              ...chunkTranscriptLecture(course.domainId, lecture.domainId, parsed.fullText, parsed.segments)
            );
            break;
          }
          case LectureSourceType.TRANSCRIPT_SRT: {
            const parsed = parseSrtToSegments(content);
            chunks.push(
              ...chunkTranscriptLecture(course.domainId, lecture.domainId, parsed.fullText, parsed.segments)
            );
            break;
          }
          case LectureSourceType.TEXT:
          case LectureSourceType.MARKDOWN:
            chunks.push(...chunkLecture(course.domainId, lecture.domainId, content));
            break;
          default:
            throw new Error(`Unsupported lecture source type: ${lecture.sourceType}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[courses] rag.skip lectureId=${lecture.domainId} sourceType=${lecture.sourceType} error=${message}`
        );
      }
    }

    const builtAt = new Date().toISOString();
    const chunking = defaultChunking();
    const manifest = RagManifestSchema.parse({
      version: '1.0.0',
      courseId,
      builtAt,
      lectureCount: lectures.length,
      chunkCount: chunks.length,
      chunking,
    });

    await this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.courseRagIndex.findUnique({
        where: { courseId: course.id },
        select: { id: true },
      });

      const index =
        existing
          ? await tx.courseRagIndex.update({
              where: { id: existing.id },
              data: {
                method: CourseRagMethod.LEXICAL_V1,
                builtAt: toDate(manifest.builtAt),
                lectureCount: manifest.lectureCount,
                chunkCount: manifest.chunkCount,
                chunkingJson: asJsonValue(manifest.chunking),
              },
              select: { id: true },
            })
          : await tx.courseRagIndex.create({
              data: {
                courseId: course.id,
                method: CourseRagMethod.LEXICAL_V1,
                builtAt: toDate(manifest.builtAt),
                lectureCount: manifest.lectureCount,
                chunkCount: manifest.chunkCount,
                chunkingJson: asJsonValue(manifest.chunking),
              },
              select: { id: true },
            });

      await tx.courseRagChunk.deleteMany({
        where: { indexId: index.id },
      });

      for (const chunk of chunks) {
        const lecture = lectures.find((candidate) => candidate.domainId === chunk.lectureId);
        if (!lecture) {
          continue;
        }

        await tx.courseRagChunk.create({
          data: {
            indexId: index.id,
            courseId: course.id,
            lectureId: lecture.id,
            chunkId: chunk.chunkId,
            order: chunk.order,
            text: chunk.text,
            anchorsJson: chunk.anchors ? asJsonValue(chunk.anchors) : undefined,
          },
        });
      }
    });

    console.log(
      `[courses] rebuilt index courseId=${courseId} lectureCount=${lectures.length} chunkCount=${chunks.length}`
    );

    return {
      manifest,
      chunkCount: chunks.length,
      lectureCount: lectures.length,
    };
  }

  async getCourseRagManifest(courseId: string): Promise<RagManifest | null> {
    const course = await this.getCourseRow(courseId);
    const index = await this.prisma.courseRagIndex.findUnique({
      where: { courseId: course.id },
      select: {
        method: true,
        builtAt: true,
        lectureCount: true,
        chunkCount: true,
        chunkingJson: true,
      },
    });

    if (!index) {
      return null;
    }

    return RagManifestSchema.parse({
      version: '1.0.0',
      courseId,
      builtAt: toIsoString(index.builtAt),
      lectureCount: index.lectureCount,
      chunkCount: index.chunkCount,
      chunking: index.chunkingJson,
    });
  }

  private async runLexicalQuery(courseId: string, query: string, k: number): Promise<{ hits: InternalChunkHit[] }> {
    const { course } = await this.ensureIndexRow(courseId);
    const queryTokens = uniqueTokens(tokenize(query));
    if (queryTokens.length === 0) {
      return { hits: [] };
    }

    const rows = await this.prisma.courseRagChunk.findMany({
      where: {
        courseId: course.id,
      },
      select: {
        chunkId: true,
        order: true,
        text: true,
        anchorsJson: true,
        lecture: {
          select: {
            domainId: true,
            title: true,
            externalUrl: true,
          },
        },
      },
    });

    const best: InternalChunkHit[] = [];

    for (const row of rows as IndexedChunkRow[]) {
      const chunk = normalizeCourseChunk(courseId, row);
      const { score, matchedTokens } = scoreChunk(queryTokens, chunk.text);
      if (score <= 0) {
        continue;
      }

      const hit: InternalChunkHit = {
        chunk,
        score,
        matchedTokens,
        snippet: buildSnippet(chunk.text, matchedTokens),
        lectureTitle: row.lecture.title,
        lectureExternalUrl: row.lecture.externalUrl ?? undefined,
      };

      let inserted = false;
      for (let i = 0; i < best.length; i += 1) {
        if (compareHits(hit, best[i]) < 0) {
          continue;
        }

        best.splice(i, 0, hit);
        inserted = true;
        break;
      }

      if (!inserted) {
        best.push(hit);
      }

      if (best.length > k) {
        best.length = k;
      }
    }

    return { hits: best };
  }

  async queryCourseIndex(courseId: string, options: {
    query: string;
    k?: number;
    method?: 'lexical_v1';
  }): Promise<RagQueryResult> {
    const method = options.method ?? 'lexical_v1';
    const k = Math.min(Math.max(options.k ?? 5, 1), 10);
    if (method !== 'lexical_v1') {
      throw new Error(`Unsupported query method: ${method}`);
    }

    const query = options.query.trim();
    const { hits } = await this.runLexicalQuery(courseId, query, k);

    return {
      method: 'lexical_v1',
      hits: hits.map((hit): ChunkHitV1 => ({
        courseId: hit.chunk.courseId,
        lectureId: hit.chunk.lectureId,
        lectureTitle: hit.lectureTitle || hit.chunk.lectureId,
        chunkId: hit.chunk.chunkId,
        order: hit.chunk.order,
        score: hit.score,
        snippet: hit.snippet,
      })),
    };
  }

  async suggestStudyPointers(courseId: string, options: {
    issueText: string;
    k?: number;
  }): Promise<SuggestStudyPointersResult> {
    const k = Math.min(Math.max(options.k ?? 3, 1), 5);
    const queryK = Math.min(10, Math.max(10, k * 3));
    const query = options.issueText.trim();

    const { hits } = await this.runLexicalQuery(courseId, query, queryK);
    const maxScore = hits.length > 0 ? hits[0].score : 0;

    const pointers = hits.slice(0, k).map((hit): StudyPointerV1 => {
      const reasonTokens = selectReasonTokens(hit.matchedTokens, 3);
      const reason =
        reasonTokens.length > 0
          ? `Relevant to: ${reasonTokens.join(', ')}`
          : 'Relevant excerpt for the reported issue';

      const confidence =
        maxScore > 0 ? Math.max(0, Math.min(1, hit.score / maxScore)) : 0;

      const anchor =
        hit.chunk.anchors?.startSec != null
          ? { startSec: hit.chunk.anchors.startSec, endSec: hit.chunk.anchors.endSec }
          : undefined;
      const deepLink =
        anchor?.startSec != null && hit.lectureExternalUrl
          ? { url: buildTimeUrl(hit.lectureExternalUrl, anchor.startSec), startSec: anchor.startSec }
          : undefined;

      return {
        version: '1.0.0',
        courseId: hit.chunk.courseId,
        lectureId: hit.chunk.lectureId,
        lectureTitle: hit.lectureTitle || hit.chunk.lectureId,
        chunkId: hit.chunk.chunkId,
        snippet: hit.snippet,
        reason,
        confidence,
        anchor,
        deepLink,
      };
    });

    return { pointers };
  }
}
