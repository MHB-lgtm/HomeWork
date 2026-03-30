'use client';

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
  return (
    <div className="space-y-2">
      {options.map((option) => (
        <Button
          key={option.accountId}
          type="button"
          variant="outline"
          className="w-full"
          size="md"
          onClick={() =>
            signIn('demo-login', {
              callbackUrl,
              demoAccountId: option.accountId,
            })
          }
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
