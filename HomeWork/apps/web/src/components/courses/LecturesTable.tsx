'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lecture } from '@hg/shared-schemas';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type LecturesTableProps = {
  lectures: Lecture[];
  loading?: boolean;
  error?: string | null;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export function LecturesTable({ lectures, loading = false, error }: LecturesTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const sortedLectures = useMemo(() => {
    return [...lectures].sort((a, b) => {
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
        return bTime - aTime;
      }
      return a.lectureId.localeCompare(b.lectureId);
    });
  }, [lectures]);

  const handleCopy = async (lectureId: string) => {
    try {
      await navigator.clipboard.writeText(lectureId);
      setCopiedId(lectureId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900">Lectures</CardTitle>
        <p className="text-sm text-slate-600">Uploaded lecture files and transcript sources.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load lectures</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : loading ? (
          <div className="text-sm text-slate-600">Loading lectures...</div>
        ) : sortedLectures.length === 0 ? (
          <div className="text-sm text-slate-600">
            No lectures yet. Upload one to build an index.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>External URL</TableHead>
                <TableHead className="text-right">Lecture ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLectures.map((lecture) => (
                <TableRow key={lecture.lectureId}>
                  <TableCell className="font-medium text-slate-900">{lecture.title}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-slate-600">
                    {lecture.sourceType}
                  </TableCell>
                  <TableCell className="text-slate-600">{formatDate(lecture.createdAt)}</TableCell>
                  <TableCell className="text-slate-600">
                    {lecture.externalUrl ? (
                      <a
                        href={lecture.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Open link
                      </a>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono text-xs text-slate-700">{lecture.lectureId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleCopy(lecture.lectureId)}
                        className="h-7 px-2 text-xs"
                      >
                        {copiedId === lecture.lectureId ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
