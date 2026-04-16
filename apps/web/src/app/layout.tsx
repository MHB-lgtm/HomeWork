import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { AuthSessionProvider } from '../components/auth/AuthSessionProvider';
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
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" className={rubik.variable}>
      <body className="antialiased font-sans">
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
