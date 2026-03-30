'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy lecturer review route - redirects to the unified review workspace.
 * All review editing now happens at /reviews/[jobId].
 */
export default function LecturerReviewRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to lecturer dashboard - specific job routing
    // happens from the dashboard's submission table
    router.replace('/l/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-(--text-tertiary)">
      Redirecting to dashboard...
    </div>
  );
}
