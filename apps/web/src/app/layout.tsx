import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Homework Grader MVP',
  description: 'MVP homework grader application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

