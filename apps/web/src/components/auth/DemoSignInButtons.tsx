'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '../ui/button';

type DemoSignInButtonsProps = {
  callbackUrl: string;
  options: Array<{
    accountId: string;
    label: string;
  }>;
};

export function DemoSignInButtons({ callbackUrl, options }: DemoSignInButtonsProps) {
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDemoSignIn = async (accountId: string) => {
    setPendingAccountId(accountId);
    setError(null);

    try {
      const result = await signIn('demo-login', {
        callbackUrl,
        demoAccountId: accountId,
        redirect: false,
      });

      if (result?.error) {
        setError(`Demo sign-in failed: ${result.error}`);
        return;
      }

      if (result?.url) {
        window.location.assign(result.url);
        return;
      }

      setError('Demo sign-in did not return a redirect URL.');
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Demo sign-in failed.');
    } finally {
      setPendingAccountId(null);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <Button
          key={option.accountId}
          type="button"
          variant="outline"
          className="w-full"
          size="md"
          disabled={pendingAccountId !== null}
          onClick={() => void handleDemoSignIn(option.accountId)}
        >
          {pendingAccountId === option.accountId ? 'Signing in...' : option.label}
        </Button>
      ))}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
