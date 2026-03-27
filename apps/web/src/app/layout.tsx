import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Homework Grader MVP',
  description: 'MVP homework grader application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
