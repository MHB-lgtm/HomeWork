'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
};

type ToastContextValue = {
  show: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback(
    (message: string, type: ToastType = 'info', duration = 3000) => {
      const id = `toast-${++toastCounter}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
    },
    []
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-(--success)" />,
  error: <XCircle className="h-4 w-4 text-(--error)" />,
  info: <Info className="h-4 w-4 text-(--info)" />,
};

const progressColors: Record<ToastType, string> = {
  success: 'bg-(--success)',
  error: 'bg-(--error)',
  info: 'bg-(--info)',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        'relative flex w-80 items-start gap-3 overflow-hidden',
        'rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-3.5 shadow-(--shadow-lg)',
        'animate-slide-left'
      )}
    >
      <span className="mt-0.5 shrink-0">{iconMap[toast.type]}</span>
      <p className="flex-1 text-[13px] text-(--text-primary) leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-0.5 text-(--text-quaternary) transition-colors duration-200 hover:text-(--text-primary)"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-(--border-light)">
        <div
          className={cn('h-full', progressColors[toast.type])}
          style={{ animation: `shrinkWidth ${toast.duration}ms linear forwards` }}
        />
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
