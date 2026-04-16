'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CourseMembershipRecord,
  CourseMembershipRole,
  CourseMembershipStatus,
  CoursesClientError,
  listCourseMemberships,
  upsertCourseMembership,
} from '../../lib/coursesClient';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type CourseMembershipPanelProps = {
  courseId: string;
};

const ROLE_OPTIONS: CourseMembershipRole[] = ['COURSE_ADMIN', 'LECTURER', 'STUDENT'];
const STATUS_OPTIONS: CourseMembershipStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'];

const formatDate = (value: string | null) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof CoursesClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load memberships.';
};

export function CourseMembershipPanel({ courseId }: CourseMembershipPanelProps) {
  const [memberships, setMemberships] = useState<CourseMembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<CourseMembershipRole>('LECTURER');
  const [status, setStatus] = useState<CourseMembershipStatus>('ACTIVE');

  const loadMemberships = async () => {
    setLoading(true);
    try {
      const data = await listCourseMemberships(courseId);
      setMemberships(data);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMemberships();
  }, [courseId]);

  const sortedMemberships = useMemo(() => {
    return [...memberships].sort((left, right) => {
      const roleComparison = left.role.localeCompare(right.role);
      if (roleComparison !== 0) {
        return roleComparison;
      }

      return (left.normalizedEmail ?? left.userId).localeCompare(right.normalizedEmail ?? right.userId);
    });
  }, [memberships]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertCourseMembership(courseId, {
        email: trimmedEmail,
        displayName: displayName.trim() || null,
        role,
        status,
      });

      setMemberships((current) => {
        const existing = current.find((membership) => membership.membershipId === saved.membershipId);
        if (!existing) {
          return [...current, saved];
        }

        return current.map((membership) =>
          membership.membershipId === saved.membershipId ? saved : membership
        );
      });
      setEmail('');
      setDisplayName('');
      setRole('LECTURER');
      setStatus('ACTIVE');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-5">
        <CardTitle className="text-lg font-semibold text-slate-900">Course Memberships</CardTitle>
        <p className="text-sm text-slate-600">
          Provision course admins, lecturers, and students for this course.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="membership-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="membership-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="lecturer@example.edu"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="membership-name" className="text-sm font-medium text-slate-700">
              Display name
            </label>
            <Input
              id="membership-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional display name"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="membership-role" className="text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              id="membership-role"
              value={role}
              onChange={(event) => setRole(event.target.value as CourseMembershipRole)}
              disabled={saving}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="membership-status" className="text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="membership-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as CourseMembershipStatus)}
              disabled={saving}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex justify-end pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save membership'}
            </Button>
          </div>
        </form>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Membership error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Loading memberships...</div>
        ) : sortedMemberships.length === 0 ? (
          <div className="text-sm text-slate-600">No memberships yet for this course.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMemberships.map((membership) => (
                <TableRow key={membership.membershipId}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">
                        {membership.displayName || membership.normalizedEmail || membership.userId}
                      </div>
                      {membership.normalizedEmail ? (
                        <div className="text-xs text-slate-500">{membership.normalizedEmail}</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-700">{membership.role}</TableCell>
                  <TableCell className="text-slate-700">{membership.status}</TableCell>
                  <TableCell className="text-slate-600">{formatDate(membership.joinedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
