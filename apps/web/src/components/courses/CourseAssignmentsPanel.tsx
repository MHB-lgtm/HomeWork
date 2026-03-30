'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Assignment } from '@hg/shared-schemas';
import {
  AssignmentsClientError,
  createCourseAssignment,
  listCourseAssignments,
  updateCourseAssignment,
} from '@/lib/assignmentsClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CourseAssignmentsPanelProps = {
  courseId: string;
};

const ASSIGNMENT_STATES: Assignment['state'][] = ['draft', 'open', 'closed'];

const toDateTimeLocalValue = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  const hours = `${parsed.getHours()}`.padStart(2, '0');
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toIsoString = (value: string) => new Date(value).toISOString();

const formatDateTime = (value: string) => {
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

export function CourseAssignmentsPanel({ courseId }: CourseAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createOpenAt, setCreateOpenAt] = useState('');
  const [createDeadlineAt, setCreateDeadlineAt] = useState('');
  const [createState, setCreateState] = useState<Assignment['state']>('draft');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOpenAt, setEditOpenAt] = useState('');
  const [editDeadlineAt, setEditDeadlineAt] = useState('');
  const [editState, setEditState] = useState<Assignment['state']>('draft');
  const [editSourceFile, setEditSourceFile] = useState<File | null>(null);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await listCourseAssignments(courseId);
      setAssignments(data);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [courseId]);

  const sortedAssignments = useMemo(
    () =>
      [...assignments].sort((left, right) => {
        const leftTime = Date.parse(left.openAt);
        const rightTime = Date.parse(right.openAt);
        if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        return left.title.localeCompare(right.title);
      }),
    [assignments]
  );

  const resetCreateForm = () => {
    setCreateTitle('');
    setCreateOpenAt('');
    setCreateDeadlineAt('');
    setCreateState('draft');
    setSourceFile(null);
  };

  const startEditing = (assignment: Assignment) => {
    setEditingId(assignment.assignmentId);
    setEditTitle(assignment.title);
    setEditOpenAt(toDateTimeLocalValue(assignment.openAt));
    setEditDeadlineAt(toDateTimeLocalValue(assignment.deadlineAt));
    setEditState(assignment.state);
  };

  const stopEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditOpenAt('');
    setEditDeadlineAt('');
    setEditState('draft');
    setEditSourceFile(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceFile) {
      setError('Assignment PDF is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createCourseAssignment(courseId, {
        title: createTitle.trim(),
        openAt: toIsoString(createOpenAt),
        deadlineAt: toIsoString(createDeadlineAt),
        state: createState,
        source: sourceFile,
      });
      setAssignments((current) => [...current, created.assignment]);
      setNotice(
        created.indexing?.ok === false
          ? `Assignment created, but exam indexing failed: ${created.indexing.message}`
          : 'Assignment created and linked to its exam-backed grading source.'
      );
      resetCreateForm();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (assignmentId: string) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCourseAssignment(courseId, assignmentId, {
        title: editTitle.trim(),
        openAt: toIsoString(editOpenAt),
        deadlineAt: toIsoString(editDeadlineAt),
        state: editState,
        ...(editSourceFile ? { source: editSourceFile } : {}),
      });
      setAssignments((current) =>
        current.map((assignment) =>
          assignment.assignmentId === assignmentId ? updated.assignment : assignment
        )
      );
      setNotice(
        updated.indexing?.ok === false
          ? `Assignment updated, but exam indexing failed: ${updated.indexing.message}`
          : editSourceFile
            ? 'Assignment updated and re-linked to its exam-backed grading source.'
            : 'Assignment updated.'
      );
      stopEditing();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900">Assignments</CardTitle>
        <p className="text-sm text-slate-600">
          Upload an assignment PDF and set the student submission window. Submissions use the same exam-style grading pipeline.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="assignment-title" className="text-sm font-medium text-slate-700">
              Title
            </label>
            <Input
              id="assignment-title"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="Homework 1"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="assignment-openAt" className="text-sm font-medium text-slate-700">
              Opens at
            </label>
            <Input
              id="assignment-openAt"
              type="datetime-local"
              value={createOpenAt}
              onChange={(event) => setCreateOpenAt(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="assignment-deadlineAt" className="text-sm font-medium text-slate-700">
              Deadline
            </label>
            <Input
              id="assignment-deadlineAt"
              type="datetime-local"
              value={createDeadlineAt}
              onChange={(event) => setCreateDeadlineAt(event.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="assignment-state" className="text-sm font-medium text-slate-700">
              Initial state
            </label>
            <select
              id="assignment-state"
              value={createState}
              onChange={(event) => setCreateState(event.target.value as Assignment['state'])}
              disabled={saving}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {ASSIGNMENT_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="assignment-source" className="text-sm font-medium text-slate-700">
              Assignment PDF
            </label>
            <Input
              id="assignment-source"
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => setSourceFile(event.target.files?.[0] || null)}
              disabled={saving}
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create assignment'}
            </Button>
          </div>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Assignment error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert>
            <AlertTitle>Assignment status</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Loading assignments...</div>
        ) : sortedAssignments.length === 0 ? (
          <div className="text-sm text-slate-600">No assignments yet for this course.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAssignments.map((assignment) => (
                <TableRow key={assignment.assignmentId}>
                  <TableCell className="align-top">
                    {editingId === assignment.assignmentId ? (
                      <Input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        disabled={saving}
                      />
                    ) : (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{assignment.title}</div>
                        <div className="text-xs text-slate-500 font-mono">{assignment.assignmentId}</div>
                        <div className="text-xs text-slate-400 font-mono">Exam: {assignment.examId}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {editingId === assignment.assignmentId ? (
                      <select
                        value={editState}
                        onChange={(event) => setEditState(event.target.value as Assignment['state'])}
                        disabled={saving}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      >
                        {ASSIGNMENT_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-700">{assignment.state}</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {editingId === assignment.assignmentId ? (
                      <div className="space-y-2">
                        <Input
                          type="datetime-local"
                          value={editOpenAt}
                          onChange={(event) => setEditOpenAt(event.target.value)}
                          disabled={saving}
                        />
                        <Input
                          type="datetime-local"
                          value={editDeadlineAt}
                          onChange={(event) => setEditDeadlineAt(event.target.value)}
                          disabled={saving}
                        />
                        <Input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(event) => setEditSourceFile(event.target.files?.[0] || null)}
                          disabled={saving}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-slate-600">
                        <div>Open: {formatDateTime(assignment.openAt)}</div>
                        <div>Deadline: {formatDateTime(assignment.deadlineAt)}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    {editingId === assignment.assignmentId ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={() => void handleUpdate(assignment.assignmentId)}
                        >
                          Save
                        </Button>
                        <Button variant="outline" size="sm" disabled={saving} onClick={stopEditing}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(assignment)}>
                        Edit
                      </Button>
                    )}
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
