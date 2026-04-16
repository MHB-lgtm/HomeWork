import { StudyPointerV1 } from '@hg/shared-schemas';
import { Badge } from '../ui/badge';

interface StudyPointersPanelProps {
  pointers: StudyPointerV1[];
  title?: string;
}

const formatSeconds = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
};

export function StudyPointersPanel({ pointers, title = 'Recommended material' }: StudyPointersPanelProps) {
  if (!pointers || pointers.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</div>
      <div className="mt-3 space-y-3">
        {pointers.map((pointer) => {
          const startSec = pointer.anchor?.startSec;
          const timeLabel = typeof startSec === 'number' ? formatSeconds(startSec) : null;
          const deepLinkUrl = pointer.deepLink?.url;

          return (
            <div
              key={`${pointer.lectureId}-${pointer.chunkId}`}
              className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{pointer.lectureTitle}</div>
                {typeof pointer.confidence === 'number' && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {Math.round(pointer.confidence * 100)}%
                  </Badge>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-600">{pointer.reason}</div>
              {timeLabel && (
                <div className="mt-2 text-xs text-slate-600">
                  Time: {timeLabel}
                </div>
              )}
              {deepLinkUrl && timeLabel && (
                <a
                  href={deepLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  Open at {timeLabel}
                </a>
              )}
              <div className="mt-2 text-sm text-slate-700 leading-5 max-h-20 overflow-hidden">
                {pointer.snippet}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Ref: {pointer.lectureId} / {pointer.chunkId}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
