import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { AuthSessionProvider } from '../components/auth/AuthSessionProvider';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Homework Grader MVP',
  description: 'MVP homework grader application',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body className="antialiased bg-body text-body">
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}

