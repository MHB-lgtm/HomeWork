'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PenTool, Type, Eraser, Undo2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Bold, Italic, Underline, List, ListOrdered,
  PanelRightOpen, Trash2, Check, X,
} from 'lucide-react';
import { cn } from '../../../../../../../../lib/utils';
import { Button } from '../../../../../../../../components/ui/button';

/* ── Lexical Imports ── */
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type LexicalEditor,
} from 'lexical';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type DrawTool = 'pen' | 'highlighter' | 'eraser';
type WorkspaceMode = 'text' | 'draw';

interface Stroke {
  points: { x: number; y: number; pressure: number }[];
  tool: DrawTool;
  color: string;
  width: number;
  opacity: number;
}

interface QuestionPart {
  label: string;
  text: string;
}

interface Question {
  id: string;
  number: number;
  intro?: string;
  parts?: QuestionPart[];
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

const MOCK_ASSIGNMENT = {
  title: 'Homework 2',
  course: 'Calculus II \u2014 Spring 2025-26',
  deadline: 'Apr 30, 2026 23:59',
};

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    number: 1,
    intro:
      "Define each of the following terms. Give a full and complete mathematical definition. If your definition includes a secondary term that was defined in the course, you must define it as well! You do not have to define any term that appears prior to the words 'define the term'. You are not required to re-define terms that were already defined.\n\nLet (a\u2099) be a sequence of real numbers.",
    parts: [
      { label: '(a)', text: 'Define the term: the sequence (a\u2099) is not bounded from below and not bounded from above, without using any negation word.' },
      { label: '(b)', text: 'Define the term: lim n\u2192\u221E a\u2099 \u2260 \u221E, without using any negation word.' },
      { label: '(c)', text: 'Define the term: we have lim n\u2192\u221E a\u2099 = \u22121.' },
      { label: '(d)', text: 'Define the term: the sequence (a\u2099) is strictly monotone.' },
    ],
  },
  {
    id: 'q2',
    number: 2,
    intro: 'Let (a\u2099) be a sequence of real numbers.\n\nProve each of the following statements. In items (a) and (b) prove using only the definitions.',
    parts: [
      { label: '(a)', text: 'For every k \u2208 \u2115, the sequence (a\u2099\u208A\u2096) is convergent if and only if (a\u2099) is convergent, and in that case,\n\n        lim n\u2192\u221E a\u2099\u208A\u2096 = lim n\u2192\u221E a\u2099.' },
      { label: '(b)', text: 'If (a\u2099) is increasing, then (a\u2099) converges in the extended sense and\n\n        lim n\u2192\u221E a\u2099 = sup { a\u2099 : n \u2208 \u2115 }.' },
      { label: '(c)', text: 'Suppose that (a\u2099) is bounded and consider the sequence (b\u2096) defined by\n\n        b\u2096 = inf { a\u2099 : n \u2265 k }    \u2200k \u2208 \u2115.\n\nProve that (b\u2096) is convergent.\n\nHint: prove that (b\u2096) is increasing and bounded from above.' },
    ],
  },
  {
    id: 'q3',
    number: 3,
    parts: [
      { label: '(a)', text: 'Let a \u2208 \u211D and let f be a function that is defined on [a, \u221E). Assume that lim x\u2192\u221E f(x) = \u221E.\n\nProve that for every sequence (x\u2099) such that lim n\u2192\u221E x\u2099 = \u221E, we have lim n\u2192\u221E f(x\u2099) = \u221E.' },
      { label: '(b)', text: 'Compute the following limit:\n\n        lim n\u2192\u221E [ n + n\u00B2 ln n \u2212 n\u00B2 ln(n+1) ]' },
    ],
  },
  {
    id: 'q4',
    number: 4,
    intro: 'Compute the following limit as a function of 0 < \u03B1 < 1:\n\n        lim n\u2192\u221E [ (n+1)\u00B2\u1D45 \u2212 (n\u00B2+1)\u1D45 ]',
  },
  {
    id: 'q5',
    number: 5,
    parts: [
      { label: '(a)', text: 'Consider the sequence (a\u2099) defined by the recursive formula\n\n        a\u2099\u208A\u2081 = a\u2099 + 1/a\u2099    \u2200n \u2208 \u2115\n        a\u2081 = 1\n\nProve that lim n\u2192\u221E a\u2099 = \u221E.' },
      { label: '(b)', text: 'i.  Let 0 \u2264 \u03B1 \u2264 2. Prove that \u03B1 \u2264 \u221A(2\u03B1) \u2264 2.\n\nii. Let (a\u2099) be the sequence of real numbers defined by the recursive formula\n\n        a\u2099\u208A\u2081 = \u221A(2a\u2099)    \u2200n \u2208 \u2115\n        a\u2081 = \u221A2\n\n    Prove that the sequence (a\u2099) is convergent.\n\niii. Prove that \u221A(2\u221A(2\u221A(2\u221A2\u2026))) = 2, that is, prove that lim n\u2192\u221E a\u2099 = 2.' },
    ],
  },
  {
    id: 'q6',
    number: 6,
    intro: 'Let 0 < \u03B2 < \u03B1 and let (a\u2099) and (b\u2099) be two sequences defined by the recursive formulas\n\n        a\u2099\u208A\u2081 = (a\u2099 + b\u2099) / 2,    b\u2099\u208A\u2081 = 2a\u2099b\u2099 / (a\u2099 + b\u2099),    \u2200n \u2208 \u2115\n        a\u2081 = \u03B1,    b\u2081 = \u03B2',
    parts: [
      { label: '(a)', text: 'Prove that (a\u2099) and (b\u2099) are well-defined, and prove that a\u2099\u208A\u2081 \u2265 b\u2099\u208A\u2081 for every n \u2208 \u2115.' },
      { label: '(b)', text: 'Prove that there exists an L \u2208 \u211D such that lim n\u2192\u221E a\u2099 = lim n\u2192\u221E b\u2099 = L.' },
      { label: '(c)', text: 'Prove that a\u2099b\u2099 = a\u2081b\u2081 for every n \u2208 \u2115 and find the value of L.' },
    ],
  },
];

const COLORS = ['#111111', '#3B82F6', '#EF4444', '#10B981', '#8B5CF6', '#F59E0B'];
const STROKE_SIZES = [2, 4, 8];

/* ─────────────────────────────────────────────
   Lexical: Toolbar Plugin
   ───────────────────────────────────────────── */

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => updateToolbar());
    });
  }, [editor, updateToolbar]);

  const btns: { cmd: 'bold' | 'italic' | 'underline'; icon: React.ReactNode; active: boolean; label: string }[] = [
    { cmd: 'bold', icon: <Bold size={14} />, active: isBold, label: 'Bold' },
    { cmd: 'italic', icon: <Italic size={14} />, active: isItalic, label: 'Italic' },
    { cmd: 'underline', icon: <Underline size={14} />, active: isUnderline, label: 'Underline' },
  ];

  return (
    <>
      {btns.map((btn) => (
        <button
          key={btn.cmd}
          className={cn(
            'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors',
            'text-(--text-tertiary) hover:bg-(--surface-hover)',
            btn.active && 'bg-(--brand-subtle) text-(--brand)'
          )}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, btn.cmd)}
          aria-label={btn.label}
          title={btn.label}
        >
          {btn.icon}
        </button>
      ))}

      <div className="w-px h-4 bg-(--border-light) mx-0.5" />

      <button
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        aria-label="Bullet List"
        title="Bullet List"
      >
        <List size={14} />
      </button>
      <button
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        aria-label="Numbered List"
        title="Numbered List"
      >
        <ListOrdered size={14} />
      </button>
    </>
  );
}

/* ─────────────────────────────────────────────
   Lexical: Editor Component
   ───────────────────────────────────────────── */

function LexicalTextEditor({ onDirty }: { onDirty: () => void }) {
  const initialConfig = useMemo(
    () => ({
      namespace: 'AssignmentWorkspace',
      theme: {
        paragraph: 'mb-2',
        heading: {
          h1: 'text-2xl font-bold mb-3',
          h2: 'text-xl font-semibold mb-2',
        },
        list: {
          ul: 'list-disc pl-6 mb-2',
          ol: 'list-decimal pl-6 mb-2',
          listitem: 'mb-1',
        },
        text: {
          bold: 'font-bold',
          italic: 'italic',
          underline: 'underline',
          code: 'bg-(--surface-secondary) px-1.5 py-0.5 rounded text-sm font-mono',
        },
      },
      nodes: [HeadingNode, ListNode, ListItemNode, CodeNode],
      onError: (error: Error) => console.error('Lexical error:', error),
    }),
    []
  );

  const handleChange = useCallback(
    (_editorState: EditorState, _editor: LexicalEditor) => {
      onDirty();
    },
    [onDirty]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="flex flex-1 flex-col min-h-0">
        {/* Formatting toolbar inside LexicalComposer */}
        <div className="flex items-center gap-0.5 border-b border-(--border-light) bg-(--surface) px-3 h-9 shrink-0">
          <ToolbarPlugin />
        </div>
        <div className="relative flex-1 overflow-y-auto bg-white px-8 py-6">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="lexical-editor outline-none min-h-full" />
            }
            placeholder={
              <div className="lexical-editor pointer-events-none absolute left-8 top-6 select-none text-(--text-quaternary)">
                Start typing your answer...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <OnChangePlugin onChange={handleChange} />
        </div>
      </div>
    </LexicalComposer>
  );
}

/* ─────────────────────────────────────────────
   Questions Panel
   ───────────────────────────────────────────── */

function QuestionsPanel({
  open,
  onClose,
  activeQuestionId,
  onSelectQuestion,
}: {
  open: boolean;
  onClose: () => void;
  activeQuestionId: string;
  onSelectQuestion: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed right-0 top-12 bottom-0 z-50 w-80 flex flex-col bg-(--surface) border-l border-(--border) shadow-(--shadow-lg)',
          'md:relative md:top-0 md:z-auto md:shadow-none',
          'max-md:bottom-0 max-md:top-auto max-md:w-full max-md:h-[70vh] max-md:rounded-t-xl max-md:border-t max-md:border-l-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
          <h3 className="text-sm font-semibold text-(--text-primary)">All questions</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-lg bg-(--brand-subtle) px-3 py-2 mb-4">
            <p className="text-xs font-medium text-(--brand)">{MOCK_ASSIGNMENT.course}</p>
            <p className="text-sm font-semibold text-(--text-primary) mt-0.5">{MOCK_ASSIGNMENT.title}</p>
            <p className="text-xs text-(--text-tertiary) mt-1">Due {MOCK_ASSIGNMENT.deadline}</p>
          </div>

          <ol className="space-y-1.5">
            {QUESTIONS.map((q) => {
              const isActive = q.id === activeQuestionId;
              const partsCount = q.parts?.length ?? 0;
              return (
                <li key={q.id}>
                  <button
                    onClick={() => {
                      onSelectQuestion(q.id);
                      onClose();
                    }}
                    className={cn(
                      'w-full text-left rounded-lg px-3 py-2 transition-colors border',
                      isActive
                        ? 'bg-(--brand-subtle) border-(--brand) text-(--text-primary)'
                        : 'bg-(--surface) border-(--border) hover:bg-(--surface-hover) text-(--text-secondary)'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Question {q.number}</span>
                      {partsCount > 0 && (
                        <span className="text-[10px] uppercase tracking-wide text-(--text-quaternary)">
                          {partsCount} part{partsCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    {q.intro && (
                      <p className="mt-0.5 text-xs text-(--text-tertiary) line-clamp-2">
                        {q.intro.split('\n')[0]}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </>
  );
}

/* ─────────────────────────────────────────────
   Active Question Card
   ───────────────────────────────────────────── */

function QuestionCard({
  question,
  expanded,
  onToggle,
}: {
  question: Question;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="shrink-0 border-b border-(--border) bg-(--surface-secondary)">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-8 py-3 text-left hover:bg-(--surface-hover) transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-(--brand) px-2 text-xs font-semibold text-white">
            Q{question.number}
          </span>
          <span className="text-sm font-semibold text-(--text-primary)">
            Question {question.number} of {QUESTIONS.length}
          </span>
        </div>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-(--text-tertiary)">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="px-8 pb-4 pt-1">
          {question.intro && (
            <p className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-(--text-secondary)">
              {question.intro}
            </p>
          )}
          {question.parts && question.parts.length > 0 && (
            <ol className="mt-3 space-y-2.5">
              {question.parts.map((p) => (
                <li key={p.label} className="flex gap-3">
                  <span className="shrink-0 text-[13.5px] font-semibold text-(--text-primary) leading-relaxed">
                    {p.label}
                  </span>
                  <p className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-(--text-secondary)">
                    {p.text}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────
   Submit Confirmation Modal
   ───────────────────────────────────────────── */

function SubmitModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-(--surface) p-6 shadow-(--shadow-lg) animate-in">
        <h3 className="text-base font-semibold text-(--text-primary) mb-2">Submit your assignment?</h3>
        <p className="text-sm text-(--text-secondary) leading-relaxed mb-6">
          You can resubmit until the deadline.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Submission Success
   ───────────────────────────────────────────── */

function SubmissionSuccess({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-(--bg)">
      <div className="animate-in text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-(--success-subtle)">
          <Check size={36} className="text-(--success)" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-(--text-primary)">Submitted successfully</h1>
        <p className="mb-8 text-sm text-(--text-secondary)">
          Your assignment has been submitted for grading.
        </p>
        <Button variant="primary" size="md" onClick={onBack}>
          Back to course
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Workspace Page
   ───────────────────────────────────────────── */

export default function WorkspacePage() {
  const router = useRouter();

  const [mode, setMode] = useState<WorkspaceMode>('text');
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(QUESTIONS[0].id);
  const [questionExpanded, setQuestionExpanded] = useState(true);

  const activeQuestionIndex = QUESTIONS.findIndex((q) => q.id === activeQuestionId);
  const activeQuestion = QUESTIONS[activeQuestionIndex] ?? QUESTIONS[0];

  const goToQuestion = useCallback((delta: number) => {
    const next = activeQuestionIndex + delta;
    if (next < 0 || next >= QUESTIONS.length) return;
    setActiveQuestionId(QUESTIONS[next].id);
  }, [activeQuestionIndex]);

  // Drawing state
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [drawColor, setDrawColor] = useState(COLORS[0]);
  const [drawWidth, setDrawWidth] = useState(STROKE_SIZES[1]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  // Auto-save every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsaved) {
        setHasUnsaved(false);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [hasUnsaved]);

  const markDirty = useCallback(() => {
    setHasUnsaved(true);
    setShowSaved(false);
  }, []);

  const handleSubmit = useCallback(() => {
    setShowConfirm(false);
    setSubmitted(true);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /* ── Canvas logic ── */

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = stroke.color;

    for (let i = 1; i < stroke.points.length; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const pressure = curr.pressure > 0 ? curr.pressure : 0.5;
      ctx.beginPath();
      ctx.lineWidth = stroke.width * pressure;
      ctx.moveTo(prev.x, prev.y);

      if (i < stroke.points.length - 1) {
        const next = stroke.points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      } else {
        ctx.lineTo(curr.x, curr.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const redrawAll = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      strokesRef.current.forEach((s) => drawStroke(ctx, s));
    },
    [drawStroke]
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      redrawAll(ctx);
    }
  }, [redrawAll]);

  useEffect(() => {
    if (mode !== 'draw') return;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [mode, resizeCanvas]);

  const getPointerPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      const pos = getPointerPos(e);
      const w = drawTool === 'highlighter' ? drawWidth * 4 : drawTool === 'eraser' ? drawWidth * 3 : drawWidth;

      currentStrokeRef.current = {
        points: [pos],
        tool: drawTool,
        color: drawTool === 'eraser' ? '#000000' : drawColor,
        width: w,
        opacity: drawTool === 'highlighter' ? 0.3 : 1,
      };
    },
    [drawTool, drawColor, drawWidth, getPointerPos]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      e.preventDefault();

      const pos = getPointerPos(e);
      currentStrokeRef.current.points.push(pos);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      strokesRef.current.forEach((s) => drawStroke(ctx, s));
      drawStroke(ctx, currentStrokeRef.current);
    },
    [getPointerPos, drawStroke]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      const canvas = canvasRef.current;
      if (canvas) canvas.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
        strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
        markDirty();
      }
      currentStrokeRef.current = null;
    },
    [markDirty]
  );

  const handleUndo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) redrawAll(ctx);
    markDirty();
  }, [redrawAll, markDirty]);

  const handleClear = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    if (!window.confirm('Clear the entire canvas?')) return;
    strokesRef.current = [];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    markDirty();
  }, [markDirty]);

  /* ── Render ── */

  if (submitted) {
    return <SubmissionSuccess onBack={handleBack} />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Top bar (h-12) ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--border) bg-(--surface) px-3">
        {/* Back */}
        <button
          onClick={handleBack}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Title */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-(--text-primary) truncate leading-tight">
            {MOCK_ASSIGNMENT.title}
          </span>
          <span className="text-[11px] text-(--text-tertiary) truncate leading-tight">
            {MOCK_ASSIGNMENT.course}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auto-save indicator */}
        <div className="flex items-center gap-1.5 text-xs mr-2">
          {hasUnsaved ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-(--warning)" />
              <span className="text-(--text-tertiary)">Unsaved</span>
            </>
          ) : showSaved ? (
            <span className="text-(--text-quaternary)">Saved</span>
          ) : (
            <span className="text-(--text-quaternary)">Saved</span>
          )}
        </div>

        {/* Questions panel toggle */}
        <button
          onClick={() => setInstructionsOpen(!instructionsOpen)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors mr-1"
          aria-label="Toggle question list"
          title="All questions"
        >
          <PanelRightOpen size={16} />
        </button>

        {/* Submit */}
        <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)}>
          Submit
        </Button>
      </header>

      {/* ── Mode toolbar (h-10) ── */}
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-(--border) bg-(--surface) px-3">
        {/* Mode buttons */}
        <button
          className={cn(
            'h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors',
            mode === 'text'
              ? 'bg-(--surface-secondary) text-(--text-primary)'
              : 'text-(--text-tertiary) hover:bg-(--surface-hover)'
          )}
          onClick={() => setMode('text')}
        >
          <Type size={14} />
          Text
        </button>
        <button
          className={cn(
            'h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors',
            mode === 'draw'
              ? 'bg-(--surface-secondary) text-(--text-primary)'
              : 'text-(--text-tertiary) hover:bg-(--surface-hover)'
          )}
          onClick={() => setMode('draw')}
        >
          <PenTool size={14} />
          Draw
        </button>

        {/* Draw mode: drawing tools */}
        {mode === 'draw' && (
          <>
            <div className="w-px h-4 bg-(--border-light) mx-1" />

            {/* Color dots */}
            {COLORS.map((c) => (
              <button
                key={c}
                className={cn(
                  'h-4 w-4 rounded-full shrink-0 transition-all',
                  drawColor === c && drawTool !== 'eraser'
                    ? 'ring-2 ring-(--brand) ring-offset-1'
                    : 'hover:scale-110'
                )}
                style={{ backgroundColor: c }}
                onClick={() => { setDrawColor(c); if (drawTool === 'eraser') setDrawTool('pen'); }}
                aria-label={`Color ${c}`}
              />
            ))}

            <div className="w-px h-4 bg-(--border-light) mx-1" />

            {/* Stroke width dots */}
            {STROKE_SIZES.map((size) => (
              <button
                key={size}
                className={cn(
                  'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors',
                  drawWidth === size
                    ? 'bg-(--surface-secondary)'
                    : 'hover:bg-(--surface-hover)'
                )}
                onClick={() => setDrawWidth(size)}
                aria-label={`Stroke width ${size}`}
              >
                <span
                  className="rounded-full bg-(--text-primary)"
                  style={{ width: size + 2, height: size + 2 }}
                />
              </button>
            ))}

            <div className="w-px h-4 bg-(--border-light) mx-1" />

            {/* Eraser */}
            <button
              className={cn(
                'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors text-(--text-tertiary)',
                drawTool === 'eraser'
                  ? 'bg-(--surface-secondary) text-(--text-primary)'
                  : 'hover:bg-(--surface-hover)'
              )}
              onClick={() => setDrawTool(drawTool === 'eraser' ? 'pen' : 'eraser')}
              aria-label="Eraser"
            >
              <Eraser size={14} />
            </button>

            {/* Undo */}
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
              onClick={handleUndo}
              aria-label="Undo"
            >
              <Undo2 size={14} />
            </button>

            {/* Clear */}
            <button
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
              onClick={handleClear}
              aria-label="Clear"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* ── Question selector strip (h-10) ── */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-(--border) bg-(--surface) px-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-(--text-quaternary) mr-1">
          Questions
        </span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {QUESTIONS.map((q) => {
            const isActive = q.id === activeQuestionId;
            return (
              <button
                key={q.id}
                onClick={() => setActiveQuestionId(q.id)}
                className={cn(
                  'h-7 px-2.5 inline-flex items-center justify-center rounded-md text-xs font-semibold transition-colors shrink-0',
                  isActive
                    ? 'bg-(--brand) text-white shadow-(--shadow-sm)'
                    : 'bg-(--surface-secondary) text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
                )}
                aria-pressed={isActive}
                aria-label={`Question ${q.number}`}
              >
                Q{q.number}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <span className="text-[11px] text-(--text-tertiary) hidden sm:inline">
          {activeQuestionIndex + 1} / {QUESTIONS.length}
        </span>
        <button
          onClick={() => goToQuestion(-1)}
          disabled={activeQuestionIndex === 0}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous question"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => goToQuestion(1)}
          disabled={activeQuestionIndex === QUESTIONS.length - 1}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next question"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* ── Workspace area ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Active question card */}
          <QuestionCard
            question={activeQuestion}
            expanded={questionExpanded}
            onToggle={() => setQuestionExpanded((v) => !v)}
          />

          {mode === 'text' ? (
            <LexicalTextEditor onDirty={markDirty} />
          ) : (
            <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className={cn(
                  'workspace-canvas absolute inset-0',
                  drawTool === 'eraser' && 'cursor-cell'
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>
          )}
        </div>

        {/* Questions panel (slide-in from right) */}
        <QuestionsPanel
          open={instructionsOpen}
          onClose={() => setInstructionsOpen(false)}
          activeQuestionId={activeQuestionId}
          onSelectQuestion={setActiveQuestionId}
        />
      </div>

      {/* Modals */}
      <SubmitModal
        open={showConfirm}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
