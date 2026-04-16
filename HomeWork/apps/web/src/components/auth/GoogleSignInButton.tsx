'use client';

import { signIn } from 'next-auth/react';
import { Button } from '../ui/button';

type GoogleSignInButtonProps = {
  callbackUrl: string;
};

export function GoogleSignInButton({ callbackUrl }: GoogleSignInButtonProps) {
  return (
    <Button
      type="button"
      className="w-full"
      size="md"
      onClick={() => signIn('google', { callbackUrl })}
    >
      Continue with Google
    </Button>
  );
}
