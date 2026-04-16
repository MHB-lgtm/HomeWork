import * as fs from 'fs/promises';
import * as fss from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  CourseChunk,
  CourseChunkSchema,
  Lecture,
  RagManifest,
  RagManifestSchema,
} from '@hg/shared-schemas';
import { getCourse, getDataDirOnce, resolveRagDir } from './fileCourseStore';
import { listLectures } from './fileLectureStore';
import {
  IndexNotBuiltError,
  RagQueryOptions,
  RagQueryResult,
  RebuildIndexResult,
  SuggestStudyPointersOptions,
  SuggestStudyPointersResult,
} from './types';
import {
  buildSnippet,
  scoreChunk,
  tokenize,
  uniqueTokens,
  selectReasonTokens,
} from './utils/lexicalSearch';
import { parseSrtToSegments, parseVttToSegments, TranscriptSegment } from './utils/transcript';
import { buildTimeUrl } from './utils/time';

const MAX_CHARS = 1200;
const OVERLAP_CHARS = 200;

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

const writeJsonlAtomic = async (filePath: string, lines: string[]): Promise<void> => {
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, lines.join('\n'), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

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

const chunkLecture = (lecture: Lecture, rawText: string): CourseChunk[] => {
  const textChunks = chunkText(rawText);
  return textChunks.map((text, index) =>
    CourseChunkSchema.parse({
      version: '1.0.0',
      chunkId: `chunk-${lecture.lectureId}-${index}`,
      courseId: lecture.courseId,
      lectureId: lecture.lectureId,
      order: index,
      text,
    })
  );
};

const chunkTranscriptLecture = (
  lecture: Lecture,
  fullText: string,
  segments: TranscriptSegment[]
): CourseChunk[] => {
  const chunks = chunkTextWithOffsets(fullText);

  return chunks.map((chunk, index) =>
    CourseChunkSchema.parse({
      version: '1.0.0',
      chunkId: `chunk-${lecture.lectureId}-${index}`,
      courseId: lecture.courseId,
      lectureId: lecture.lectureId,
      order: index,
      text: chunk.text,
      anchors: mapAnchorsToChunk(segments, chunk.startIndex, chunk.endIndex),
    })
  );
};

const isTranscriptSource = (sourceType: string): sourceType is 'transcript_vtt' | 'transcript_srt' => {
  return sourceType === 'transcript_vtt' || sourceType === 'transcript_srt';
};

export const rebuildCourseIndex = async (courseId: string): Promise<RebuildIndexResult> => {
  // Ensure course exists before attempting to read lectures or write index
  await getCourse(courseId);

  const lectures = await listLectures(courseId);
  const dataDir = getDataDirOnce();
  const ragDir = resolveRagDir(courseId);
  await fs.mkdir(ragDir, { recursive: true });

  const chunks: CourseChunk[] = [];

  for (const lecture of lectures) {
    const assetFullPath = path.isAbsolute(lecture.assetPath)
      ? lecture.assetPath
      : path.join(dataDir, lecture.assetPath);

    const content = await fs.readFile(assetFullPath, 'utf-8');
    try {
      if (isTranscriptSource(lecture.sourceType)) {
        const parsed =
          lecture.sourceType === 'transcript_vtt'
            ? parseVttToSegments(content)
            : parseSrtToSegments(content);
        const lectureChunks = chunkTranscriptLecture(lecture, parsed.fullText, parsed.segments);
        chunks.push(...lectureChunks);
      } else {
        const lectureChunks = chunkLecture(lecture, content);
        chunks.push(...lectureChunks);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[courses] rag.skip lectureId=${lecture.lectureId} sourceType=${lecture.sourceType} error=${message}`
      );
    }
  }

  const manifest: RagManifest = RagManifestSchema.parse({
    version: '1.0.0',
    courseId,
    builtAt: new Date().toISOString(),
    lectureCount: lectures.length,
    chunkCount: chunks.length,
    chunking: {
      maxChars: MAX_CHARS,
      overlapChars: OVERLAP_CHARS,
    },
  });

  const chunksPath = path.join(ragDir, 'chunks.jsonl');
  const manifestPath = path.join(ragDir, 'manifest.json');

  await writeJsonlAtomic(
    chunksPath,
    chunks.map((chunk) => JSON.stringify(chunk))
  );
  await writeJsonAtomic(manifestPath, manifest);

  console.log(
    `[courses] rebuilt index courseId=${courseId} lectureCount=${lectures.length} chunkCount=${chunks.length}`
  );

  return {
    manifest,
    chunkCount: chunks.length,
    lectureCount: lectures.length,
  };
};

export const loadRagManifest = async (courseId: string): Promise<RagManifest | null> => {
  const manifestPath = path.join(resolveRagDir(courseId), 'manifest.json');

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const parsed = JSON.parse(content);
    return RagManifestSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

export const rebuildCourseRagIndex = rebuildCourseIndex;

export const getCourseRagManifest = loadRagManifest;

type InternalChunkHit = {
  chunk: CourseChunk;
  score: number;
  matchedTokens: string[];
  snippet: string;
  lectureTitle: string;
  lectureExternalUrl?: string;
};

const loadLectureTitleMap = async (courseId: string): Promise<Map<string, Lecture>> => {
  const lectures = await listLectures(courseId);
  const map = new Map<string, Lecture>();
  for (const lecture of lectures) {
    map.set(lecture.lectureId, lecture);
  }
  return map;
};

const streamChunks = async function* (courseId: string): AsyncGenerator<CourseChunk> {
  const ragDir = resolveRagDir(courseId);
  const chunksPath = path.join(ragDir, 'chunks.jsonl');

  const stream = fss.createReadStream(chunksPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let loggedInvalid = false;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      const validated = CourseChunkSchema.parse(parsed);

      // Ensure chunk belongs to the requested course
      if (validated.courseId !== courseId) {
        continue;
      }

      yield validated;
    } catch (error) {
      if (!loggedInvalid) {
        console.warn('[courses] rag.skip invalid chunk line', error);
        loggedInvalid = true;
      }
      continue;
    }
  }
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

const ensureCourseIndexBuilt = async (courseId: string): Promise<RagManifest> => {
  // Validate course exists
  await getCourse(courseId);

  const manifest = await loadRagManifest(courseId);
  if (!manifest) {
    throw new IndexNotBuiltError(courseId);
  }

  const ragDir = resolveRagDir(courseId);
  const chunksPath = path.join(ragDir, 'chunks.jsonl');

  try {
    await fs.access(chunksPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new IndexNotBuiltError(courseId);
    }
    throw error;
  }

  return manifest;
};

const runLexicalQuery = async (
  courseId: string,
  query: string,
  k: number
): Promise<{ hits: InternalChunkHit[] }> => {
  await ensureCourseIndexBuilt(courseId);

  const queryTokens = uniqueTokens(tokenize(query));
  if (queryTokens.length === 0) {
    return { hits: [] };
  }

  const lectureMap = await loadLectureTitleMap(courseId);
  const best: InternalChunkHit[] = [];

  for await (const chunk of streamChunks(courseId)) {
    const { score, matchedTokens } = scoreChunk(queryTokens, chunk.text);
    if (score <= 0) {
      continue;
    }

    const hit: InternalChunkHit = {
      chunk,
      score,
      matchedTokens,
      snippet: buildSnippet(chunk.text, matchedTokens),
      lectureTitle: lectureMap.get(chunk.lectureId)?.title ?? '',
      lectureExternalUrl: lectureMap.get(chunk.lectureId)?.externalUrl,
    };

    // Insert into sorted position
    let inserted = false;
    for (let i = 0; i < best.length; i++) {
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

  const hits: InternalChunkHit[] = best.map((hit) => {
    return {
      ...hit,
      chunk: {
        ...hit.chunk,
        lectureId: hit.chunk.lectureId,
        courseId: hit.chunk.courseId,
      },
    };
  });

  return { hits };
};

export const queryCourseIndex = async (
  courseId: string,
  options: RagQueryOptions
): Promise<RagQueryResult> => {
  const method = options.method ?? 'lexical_v1';
  const k = Math.min(Math.max(options.k ?? 5, 1), 10);
  if (method !== 'lexical_v1') {
    throw new Error(`Unsupported query method: ${method}`);
  }

  const query = options.query.trim();
  const { hits } = await runLexicalQuery(courseId, query, k);

  return {
    method: 'lexical_v1',
    hits: hits.map((hit) => ({
      courseId: hit.chunk.courseId,
      lectureId: hit.chunk.lectureId,
      lectureTitle: hit.lectureTitle || hit.chunk.lectureId,
      chunkId: hit.chunk.chunkId,
      order: hit.chunk.order,
      score: hit.score,
      snippet: hit.snippet,
    })),
  };
};

export const suggestStudyPointers = async (
  courseId: string,
  options: SuggestStudyPointersOptions
): Promise<SuggestStudyPointersResult> => {
  const k = Math.min(Math.max(options.k ?? 3, 1), 5);
  const queryK = Math.min(10, Math.max(10, k * 3));
  const query = options.issueText.trim();

  const { hits } = await runLexicalQuery(courseId, query, queryK);

  const maxScore = hits.length > 0 ? hits[0].score : 0;

  const pointers = hits.slice(0, k).map((hit) => {
    const reasonTokens = selectReasonTokens(hit.matchedTokens, 3);
    const reason =
      reasonTokens.length > 0
        ? `Relevant to: ${reasonTokens.join(', ')}`
        : 'Relevant excerpt for the reported issue';

    const confidence =
      maxScore > 0 ? Math.max(0, Math.min(1, hit.score / maxScore)) : 0;

    const anchor = hit.chunk.anchors?.startSec != null
      ? { startSec: hit.chunk.anchors.startSec, endSec: hit.chunk.anchors.endSec }
      : undefined;
    const deepLink =
      anchor?.startSec != null && hit.lectureExternalUrl
        ? { url: buildTimeUrl(hit.lectureExternalUrl, anchor.startSec), startSec: anchor.startSec }
        : undefined;

    return {
      version: '1.0.0' as const,
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
};
