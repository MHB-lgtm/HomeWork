/**
 * Lightweight sanity tests for the document-type detector.
 * Run with: `npx tsx apps/web/src/lib/notes/docTypeDetector.test.ts`
 *
 * Once the project standardizes on Vitest/Jest, migrate these into proper
 * `describe/it` blocks. For now they're `assert`-based and self-contained.
 */
import assert from 'node:assert';
import {
  extractSignals,
  heuristicClassify,
  extractQuestionsFromText,
  detectDocumentType,
} from './docTypeDetector';

// ───────────── HOMEWORK ─────────────
const homeworkSample = `
תרגיל בית מס' 2 — חשבון אינפיניטסימלי 2

1. הוכח כי הסדרה a_n = 1/n מתכנסת.
2. חשב את האינטגרל: ∫ x^2 dx.
3. מצא את נגזרת הפונקציה f(x) = sin(x^2).
4. פתור את המשוואה הדיפרנציאלית y'' + y = 0.
`;

{
  const s = extractSignals(homeworkSample);
  assert.ok(s.numberedItems.length >= 4, 'should detect 4 numbered items');
  assert.equal(s.hasSolutionMarkers, false);
  assert.ok(s.homeworkCueCount >= 3);
  const r = heuristicClassify(s);
  assert.equal(r.type, 'homework', `expected homework, got ${r.type}`);
  assert.ok(r.confidence >= 0.7);
  console.log('✓ homework sample classified as homework', r.confidence.toFixed(2));
}

// ───────────── PRACTICE ─────────────
const practiceSample = `
דף תרגול — אלגברה ליניארית

1. מצא את גרעין המטריצה A.
פתרון: חשב RREF של A...
2. בדוק האם הווקטורים תלויים ליניארית.
פתרון: סידור במטריצה וחישוב דטרמיננטה...
3. הוכח כי המיפוי לינארי.
תשובה: לפי הגדרה...
`;

{
  const s = extractSignals(practiceSample);
  assert.equal(s.hasSolutionMarkers, true);
  const r = heuristicClassify(s);
  assert.equal(r.type, 'practice');
  console.log('✓ practice sample classified as practice', r.confidence.toFixed(2));
}

// ───────────── LECTURE ─────────────
const lectureSample = `
הרצאה 5 — סדרות

הגדרה 5.1: סדרה של מספרים ממשיים היא פונקציה a: ℕ → ℝ.
משפט 5.2 (בולצאנו-ויירשטראס): כל סדרה חסומה ב-ℝ יש לה תת-סדרה מתכנסת.
הוכחה: נשתמש במשפט החצאים...

דוגמה 5.3: הסדרה a_n = (-1)^n אינה מתכנסת.
מסקנה: לסדרה לא חסומה אין גבול סופי.

הגדרה 5.4: סדרה a_n נקראת חזירה אם... (עוד הרבה טקסט רציף שלא ממוספר).
טענה: עבור כל סדרה כזו קיים n מספיק גדול...
`.repeat(4);

{
  const s = extractSignals(lectureSample);
  const r = heuristicClassify(s);
  assert.equal(r.type, 'lecture', `expected lecture, got ${r.type}`);
  console.log('✓ lecture sample classified as lecture', r.confidence.toFixed(2));
}

// ───────────── QUESTION EXTRACTION ─────────────
{
  const qs = extractQuestionsFromText(homeworkSample);
  assert.equal(qs.length, 4);
  assert.equal(qs[0].number, 1);
  assert.ok(qs[0].intro?.includes('מתכנסת'));
  console.log('✓ extracted', qs.length, 'questions');
}

// ───────────── ASYNC FALLBACK ─────────────
(async () => {
  const ambiguous = 'hello world — one short paragraph';
  let fallbackCalled = false;
  const r = await detectDocumentType(ambiguous, {
    llmFallback: async () => {
      fallbackCalled = true;
      return { type: 'lecture', confidence: 0.8, reasoning: 'LLM says lecture' };
    },
  });
  // Short text → heuristic returns lecture at 0.5 → fallback kicks in (0.8 wins)
  assert.ok(fallbackCalled, 'fallback should be invoked when heuristic is uncertain');
  assert.equal(r.type, 'lecture');
  assert.ok(r.confidence >= 0.7);
  console.log('✓ llmFallback invoked correctly; final conf', r.confidence);
  console.log('\nALL TESTS PASSED');
})();
