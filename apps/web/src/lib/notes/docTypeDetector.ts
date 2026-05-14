/**
 * StudyFlow — Document Type Detector
 *
 * Classifies an uploaded document as one of:
 *   - 'lecture'  — long-form explanatory text (reading)
 *   - 'practice' — numbered exercises WITH solutions (tutorial)
 *   - 'homework' — numbered exercises WITHOUT solutions (assignment)
 *   - 'unknown'  — can't decide; let the user pick
 *
 * Strategy:
 *   1. Cheap heuristic pass (regex + structural signals) — no AI cost.
 *   2. If confidence < 0.7 OR the document is ambiguous, escalate to Gemini
 *      with a structured-output prompt.
 *
 * This keeps AI spend low (> 80% of docs decided by regex) while still
 * handling edge cases via the LLM.
 */

import type {
  DocumentType,
  DetectionResult,
  Question,
} from '@hg/shared-schemas';

/* ─────────────────────────────────────────────
   Signal extractors — pure functions, easy to unit test
   ───────────────────────────────────────────── */

// Imperative verbs only — exclude noun forms like "הוכחה" (proof) and "חשבון" (account/calc)
// via negative lookahead on common suffix letters.
const HEBREW_HOMEWORK_CUES = [
  /הוכח(?![התוי])/, // "הוכח" (prove!) but not "הוכחה"/"הוכחת"/"הוכחתי"
  /חשב(?![הון])/, //   "חשב" (compute!) but not "חשבון" (account)
  /מצא\s+את/,
  /פתור/,
  /הראה\s+ש/,
  /קבע\s+האם/,
  /נמק/,
  /להגשה/,
];

const HEBREW_LECTURE_CUES = [
  /הגדרה/,
  /משפט/,
  /למה\s+\d/,
  /הוכחה/,
  /דוגמ(?:ה|ות|א)/,
  /מסקנה/,
  /טענה/,
];

const HEBREW_SOLUTION_CUES = [
  /פתרון/,
  /תשובה/,
  /פתרון\s+מלא/,
  /מענה/,
];

/** Matches "1.", "1)", "שאלה 1", "Q1" */
const QUESTION_NUMBER_RE = /(?:^|\n)\s*(?:שאלה\s+)?\(?\s*([0-9]+)\s*[.)\]]/g;

export interface DocSignals {
  charCount: number;
  numberedItems: number[];
  hasSolutionMarkers: boolean;
  homeworkCueCount: number;
  lectureCueCount: number;
  /** Ratio of numbered items to paragraphs — high = exercise sheet */
  numberedDensity: number;
}

export function extractSignals(text: string): DocSignals {
  const charCount = text.length;
  const numberedItems: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(QUESTION_NUMBER_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1]);
    if (n > 0 && n < 100) numberedItems.push(n);
  }

  const countMatches = (cues: RegExp[]) =>
    cues.reduce((acc, r) => acc + (text.match(new RegExp(r.source, 'g'))?.length ?? 0), 0);

  const hasSolutionMarkers = countMatches(HEBREW_SOLUTION_CUES) >= 2;
  const homeworkCueCount = countMatches(HEBREW_HOMEWORK_CUES);
  const lectureCueCount = countMatches(HEBREW_LECTURE_CUES);
  const paragraphs = Math.max(1, text.split(/\n{2,}/).length);
  const numberedDensity = numberedItems.length / paragraphs;

  return {
    charCount,
    numberedItems,
    hasSolutionMarkers,
    homeworkCueCount,
    lectureCueCount,
    numberedDensity,
  };
}

/* ─────────────────────────────────────────────
   Heuristic classifier
   ───────────────────────────────────────────── */

export function heuristicClassify(signals: DocSignals): DetectionResult {
  const {
    charCount,
    numberedItems,
    hasSolutionMarkers,
    homeworkCueCount,
    lectureCueCount,
    numberedDensity,
  } = signals;

  // Case A: Lots of numbered items + no solution markers → Homework
  if (numberedItems.length >= 3 && !hasSolutionMarkers && homeworkCueCount >= 2) {
    return {
      type: 'homework',
      confidence: Math.min(0.95, 0.65 + 0.05 * homeworkCueCount + 0.02 * numberedItems.length),
      reasoning: `${numberedItems.length} numbered questions, ${homeworkCueCount} imperative cues ("הוכח"/"חשב"), no solution markers.`,
    };
  }

  // Case B: Numbered items + solution markers → Practice
  if (numberedItems.length >= 3 && hasSolutionMarkers) {
    return {
      type: 'practice',
      confidence: 0.85,
      reasoning: `${numberedItems.length} numbered items with solutions — exercise sheet with answers.`,
    };
  }

  // Case C: Lecture-style cues strongly dominate → Lecture
  // Two sub-cases: (1) long prose with lecture markers, or (2) lecture markers
  // overwhelm all other signals regardless of length.
  const lectureDominates =
    lectureCueCount >= 3 &&
    lectureCueCount > homeworkCueCount * 2 &&
    numberedItems.length < 3;
  if ((charCount > 3000 && numberedDensity < 0.3) || lectureDominates) {
    return {
      type: 'lecture',
      confidence: Math.min(0.9, 0.55 + 0.04 * lectureCueCount),
      reasoning: `${lectureCueCount} lecture markers ("הגדרה"/"משפט"/"הוכחה"), density=${numberedDensity.toFixed(2)}, len=${charCount}.`,
    };
  }

  // Case D: Short + unstructured → probably Lecture notes (default)
  if (charCount < 1000 && numberedItems.length < 2) {
    return {
      type: 'lecture',
      confidence: 0.5,
      reasoning: 'Short document with no structural cues — defaulting to lecture notes.',
    };
  }

  // Otherwise → escalate
  return {
    type: 'unknown',
    confidence: 0.3,
    reasoning: 'Signals conflict or insufficient. Escalate to LLM.',
  };
}

/* ─────────────────────────────────────────────
   Question extractor (for homework/practice flows)
   ───────────────────────────────────────────── */

/**
 * Given a text with "1.", "2.", … markers, split into Question objects that
 * match the shape the existing HomeWork workspace already renders.
 */
export function extractQuestionsFromText(text: string): Question[] {
  // Match "\n1." blocks and capture everything until the next number or EOF.
  const re = /(?:^|\n)\s*(?:שאלה\s+)?\(?\s*([0-9]+)\s*[.)\]]([\s\S]+?)(?=(?:\n\s*(?:שאלה\s+)?\(?\s*[0-9]+\s*[.)\]])|$)/g;
  const out: Question[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = Number(m[1]);
    if (num <= 0 || num > 100) continue;
    const body = m[2].trim();

    // Detect sub-parts labeled (a), (b), (1), א., ב.
    const partsRe = /\(([א-ת]|[a-z]|[0-9]+)\)\s*([^()\n]+)/g;
    const parts = [] as { label: string; text: string }[];
    let pm: RegExpExecArray | null;
    while ((pm = partsRe.exec(body)) !== null) {
      parts.push({ label: pm[1], text: pm[2].trim() });
    }

    out.push({
      id: `q${num}`,
      number: num,
      intro: parts.length > 0 ? body.split(/\([א-תa-z0-9]+\)/)[0].trim() : body,
      parts: parts.length > 0 ? parts : undefined,
    });
  }
  // Sort and dedupe by question number
  const seen = new Set<number>();
  return out
    .filter((q) => {
      if (seen.has(q.number)) return false;
      seen.add(q.number);
      return true;
    })
    .sort((a, b) => a.number - b.number);
}

/* ─────────────────────────────────────────────
   Public API — the main entry point called from API routes / workers
   ───────────────────────────────────────────── */

export interface DetectOptions {
  /** Called when heuristics are inconclusive. Should call Gemini. */
  llmFallback?: (text: string) => Promise<DetectionResult>;
  /** Extract questions when type is homework/practice (default: true) */
  extractQuestions?: boolean;
}

export async function detectDocumentType(
  text: string,
  opts: DetectOptions = {},
): Promise<DetectionResult> {
  const signals = extractSignals(text);
  let result = heuristicClassify(signals);

  if (result.confidence < 0.7 && opts.llmFallback) {
    try {
      const llm = await opts.llmFallback(text);
      // Prefer LLM result only if it's more confident
      if (llm.confidence > result.confidence) result = llm;
    } catch (e) {
      // Silently keep heuristic result on LLM failure
      result = { ...result, reasoning: (result.reasoning ?? '') + ' (LLM fallback failed)' };
    }
  }

  // Attach extracted questions for downstream flows
  const shouldExtract =
    (opts.extractQuestions ?? true) &&
    (result.type === 'homework' || result.type === 'practice');

  if (shouldExtract) {
    const questions = extractQuestionsFromText(text);
    if (questions.length > 0) result.questions = questions;
  }

  return result;
}

/* ─────────────────────────────────────────────
   Type guard helpers
   ───────────────────────────────────────────── */

export function isHomework(t: DocumentType): t is 'homework' {
  return t === 'homework';
}
export function isLecture(t: DocumentType): t is 'lecture' {
  return t === 'lecture';
}
export function isPractice(t: DocumentType): t is 'practice' {
  return t === 'practice';
}
