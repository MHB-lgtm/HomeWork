'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PenTool, Type, Eraser, Undo2, ChevronLeft,
  Bold, Italic, Underline, List, ListOrdered,
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

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

const MOCK_ASSIGNMENT = {
  title: 'Matrix Operations \u2014 Week 5',
  course: 'Linear Algebra',
  deadline: 'Apr 2, 2026 23:59',
  instructions: `Solve the following matrix problems. Show all work and intermediate steps.\n\nProblem 1: Given matrices A and B, compute A \u00d7 B.\n\nA = [[2, 1, 3], [4, -1, 0], [1, 5, 2]]\nB = [[1, 0], [2, 3], [-1, 4]]\n\nProblem 2: Determine if the matrix C is invertible. If so, find the inverse.\n\nC = [[1, 2], [3, 4]]\n\nProblem 3: Using the results above, explain the relationship between matrix multiplication and invertibility.\n\nSubmission Guidelines:\n- Show all intermediate steps\n- Clearly label each problem\n- You may type or draw your work\n- Due: April 2, 2026 at 11:59 PM`,
};

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
   Instructions Panel
   ───────────────────────────────────────────── */

function InstructionsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
          <h3 className="text-sm font-semibold text-(--text-primary)">Instructions</h3>
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
          </div>

          <div className="text-sm text-(--text-secondary) leading-relaxed space-y-2">
            {MOCK_ASSIGNMENT.instructions.split('\n').map((line, i) => {
              if (line.trim() === '') return <div key={i} className="h-2" />;
              if (line.startsWith('- ')) {
                return (
                  <li key={i} className="ml-4 list-disc text-sm">
                    {line.replace('- ', '')}
                  </li>
                );
              }
              return <p key={i}>{line}</p>;
            })}
          </div>
        </div>
      </aside>
    </>
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
        <span className="text-sm font-medium text-(--text-primary) truncate">
          {MOCK_ASSIGNMENT.title}
        </span>

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

        {/* Instructions toggle */}
        <button
          onClick={() => setInstructionsOpen(!instructionsOpen)}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors mr-1"
          aria-label="Toggle instructions"
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

      {/* ── Workspace area ── */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
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

        {/* Instructions panel (slide-in from right) */}
        <InstructionsPanel
          open={instructionsOpen}
          onClose={() => setInstructionsOpen(false)}
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
