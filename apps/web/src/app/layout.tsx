import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { isAuthSecretConfigured } from '@/auth';
import { AuthSessionProvider } from '../components/auth/AuthSessionProvider';
import { getOptionalServerSession } from '../lib/server/auth-session';
import './globals.css';

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Homework Grader',
  description: 'AI-powered academic grading platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authEnabled = isAuthSecretConfigured();
  const session = await getOptionalServerSession();

  return (
    <html lang="en" className={rubik.variable}>
      <body className="antialiased font-sans">
        <AuthSessionProvider enabled={authEnabled} session={session}>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
