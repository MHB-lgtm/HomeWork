'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Submissions page now redirects to the unified lecturer dashboard.
 * All submission management happens from /l/dashboard.
 */
export default function SubmissionsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/l/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-(--text-tertiary)">
      Redirecting to dashboard...
    </div>
  );
}
