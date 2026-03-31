'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StudentAssignment } from '@hg/shared-schemas';
import { AssignmentsClientError, listMyAssignments } from '@/lib/assignmentsClient';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImmersiveShell } from '@/components/layout/ImmersiveShell';

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AssignmentsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load assignments.';
};

export default function StudentAssignmentsPageClient() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await listMyAssignments();
        setAssignments(data);
        setError(null);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <ImmersiveShell showTopNav={false} contentClassName="px-4 pb-10 pt-10 md:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Student Workspace</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Assignments</h1>
          </div>
          <AccountMenu />
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load assignments</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No assignments are visible yet for your courses.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assignments.map((assignment) => (
              <Card
                key={assignment.assignmentId}
                className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        {assignment.title}
                      </CardTitle>
                      <p className="text-xs font-mono text-slate-500">{assignment.assignmentId}</p>
                    </div>
                    <Badge variant={assignment.visibleStatus === 'PUBLISHED' ? 'default' : 'outline'}>
                      {assignment.visibleStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>Opens: {formatDate(assignment.openAt)}</div>
                    <div>Deadline: {formatDate(assignment.deadlineAt)}</div>
                  </div>
                  <Link href={`/assignments/${assignment.assignmentId}`} className="block">
                    <Button className="w-full">Open assignment</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ImmersiveShell>
  );
}
