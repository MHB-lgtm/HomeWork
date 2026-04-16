'use client';

import type { RagManifest } from '@hg/shared-schemas';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type RagIndexPanelProps = {
  courseId: string;
  manifest: RagManifest | null;
  loadingManifest: boolean;
  rebuilding: boolean;
  error?: string | null;
  onRebuild: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export function RagIndexPanel({
  courseId,
  manifest,
  loadingManifest,
  rebuilding,
  error,
  onRebuild,
  onRefresh,
}: RagIndexPanelProps) {
  const isBusy = loadingManifest || rebuilding;

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-slate-900">RAG Index</CardTitle>
            <p className="text-sm text-slate-600">Track chunking status and rebuild when content changes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={isBusy}>
              {loadingManifest ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => void onRebuild()} disabled={isBusy}>
              {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Index error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loadingManifest ? (
          <div className="text-sm text-slate-600">Loading index status...</div>
        ) : !manifest ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            Index not built yet for {courseId}.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Built at</p>
                <p className="text-sm font-semibold text-slate-900">{formatDate(manifest.builtAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Counts</p>
                <p className="text-sm font-semibold text-slate-900">
                  {manifest.lectureCount} lectures, {manifest.chunkCount} chunks
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="text-xs uppercase tracking-wide text-slate-500">Chunking</p>
              <p className="text-sm font-semibold text-slate-900">
                maxChars {manifest.chunking.maxChars} / overlap {manifest.chunking.overlapChars}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
