'use client';

import { useState } from 'react';
import type { ChunkHitV1, StudyPointerV1 } from '@hg/shared-schemas';
import { CoursesClientError, ragQuery, ragSuggest } from '../../lib/coursesClient';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type RagTestPanelProps = {
  courseId: string;
  hasIndexHint?: boolean;
};

type PanelError = {
  message: string;
  code?: string;
  status?: number;
};

type Mode = 'query' | 'suggest';

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

const parseError = (error: unknown): PanelError => {
  if (error instanceof CoursesClientError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: 'Something went wrong.' };
};

export function RagTestPanel({ courseId, hasIndexHint }: RagTestPanelProps) {
  const [mode, setMode] = useState<Mode>('query');
  const [queryText, setQueryText] = useState('');
  const [queryK, setQueryK] = useState(5);
  const [queryHits, setQueryHits] = useState<ChunkHitV1[]>([]);
  const [issueText, setIssueText] = useState('');
  const [suggestK, setSuggestK] = useState(3);
  const [pointers, setPointers] = useState<StudyPointerV1[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PanelError | null>(null);

  const runQuery = async () => {
    const trimmed = queryText.trim();
    if (trimmed.length < 3) {
      setError({ message: 'Query must be at least 3 characters.' });
      return;
    }

    setLoading(true);
    setError(null);
    setQueryHits([]);
    try {
      const result = await ragQuery(courseId, { query: trimmed, k: queryK });
      setQueryHits(result.hits);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const runSuggest = async () => {
    const trimmed = issueText.trim();
    if (trimmed.length < 10) {
      setError({ message: 'Issue text must be at least 10 characters.' });
      return;
    }

    setLoading(true);
    setError(null);
    setPointers([]);
    try {
      const result = await ragSuggest(courseId, { issueText: trimmed, k: suggestK });
      setPointers(result.pointers);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const isIndexMissing = error?.code === 'INDEX_NOT_BUILT' || error?.status === 409;

  const scrollToIndex = () => {
    const target = document.getElementById('rag-index-panel');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const showEmptyState =
    !loading &&
    !error &&
    ((mode === 'query' && queryHits.length === 0 && queryText.trim()) ||
      (mode === 'suggest' && pointers.length === 0 && issueText.trim()));

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-slate-900">Test RAG</CardTitle>
            <p className="text-sm text-slate-600">Run query and suggest to validate chunk quality.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === 'query' ? 'default' : 'outline'}
              size="sm"
              type="button"
              onClick={() => {
                setMode('query');
                setError(null);
              }}
              disabled={loading}
            >
              Query
            </Button>
            <Button
              variant={mode === 'suggest' ? 'default' : 'outline'}
              size="sm"
              type="button"
              onClick={() => {
                setMode('suggest');
                setError(null);
              }}
              disabled={loading}
            >
              Suggest
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasIndexHint && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-2 text-sm text-slate-600">
            Index not built yet. Use the RAG Index panel to rebuild before testing.
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Request failed</AlertTitle>
            <AlertDescription>
              {isIndexMissing ? (
                <div className="space-y-2">
                  <p>Index not built yet. Click Rebuild Index in the RAG Index section.</p>
                  <Button type="button" variant="outline" size="sm" onClick={scrollToIndex}>
                    Go to RAG Index
                  </Button>
                </div>
              ) : (
                <span>{error.code ? `${error.message} (${error.code})` : error.message}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {mode === 'query' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="rag-query" className="text-sm font-medium text-slate-700">
                Query
              </label>
              <Textarea
                id="rag-query"
                value={queryText}
                onChange={(event) => setQueryText(event.target.value)}
                placeholder="convolution kernel properties"
                rows={3}
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label htmlFor="query-k" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Top K
                </label>
                <Input
                  id="query-k"
                  type="number"
                  min={1}
                  max={10}
                  value={queryK}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setQueryK(Number.isNaN(value) ? 1 : Math.max(1, Math.min(10, value)));
                  }}
                  className="w-24"
                  disabled={loading}
                />
              </div>
              <Button type="button" onClick={runQuery} disabled={loading}>
                {loading ? 'Running...' : 'Run Query'}
              </Button>
            </div>

            {queryHits.length > 0 && (
              <div className="space-y-4">
                {queryHits.map((hit) => (
                  <div
                    key={`${hit.chunkId}-${hit.lectureId}`}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">{hit.lectureTitle}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        Score {hit.score.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-700 max-h-24 overflow-hidden">
                      {hit.snippet}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Chunk: {hit.chunkId} / Lecture: {hit.lectureId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="rag-issue" className="text-sm font-medium text-slate-700">
                Issue text
              </label>
              <Textarea
                id="rag-issue"
                value={issueText}
                onChange={(event) => setIssueText(event.target.value)}
                placeholder="I struggled to apply the convolution theorem in this problem."
                rows={4}
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label htmlFor="suggest-k" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Top K
                </label>
                <Input
                  id="suggest-k"
                  type="number"
                  min={1}
                  max={5}
                  value={suggestK}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setSuggestK(Number.isNaN(value) ? 1 : Math.max(1, Math.min(5, value)));
                  }}
                  className="w-24"
                  disabled={loading}
                />
              </div>
              <Button type="button" onClick={runSuggest} disabled={loading}>
                {loading ? 'Running...' : 'Run Suggest'}
              </Button>
            </div>

            {pointers.length > 0 && (
              <div className="space-y-4">
                {pointers.map((pointer) => {
                  const startSec = pointer.anchor?.startSec;
                  const timeLabel = typeof startSec === 'number' ? formatSeconds(startSec) : null;
                  const deepLinkUrl = pointer.deepLink?.url;

                  return (
                    <div
                      key={`${pointer.chunkId}-${pointer.lectureId}`}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{pointer.lectureTitle}</div>
                        <Badge variant="secondary" className="text-[10px]">
                          {Math.round(pointer.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{pointer.reason}</div>
                      {timeLabel && (
                        <div className="mt-2 text-xs text-slate-600">Time: {timeLabel}</div>
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
                      <div className="mt-2 text-sm text-slate-700 max-h-28 overflow-hidden">
                        {pointer.snippet}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Chunk: {pointer.chunkId} / Lecture: {pointer.lectureId}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showEmptyState && (
          <div className="text-sm text-slate-600">
            No matches found. Try different keywords.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
