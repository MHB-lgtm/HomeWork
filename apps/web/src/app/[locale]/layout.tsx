import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { RoleProvider } from '../../contexts/RoleContext';
import { AppShell } from '../../components/layout/AppShell';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-en', display: 'swap' });

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'he' | 'en')) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} className={inter.variable}>
      <head>
        {locale === 'he' && <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap" rel="stylesheet" />}
        <style>{`:root{--font-he:'Assistant',sans-serif}`}</style>
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <RoleProvider>
            <AppShell>{children}</AppShell>
          </RoleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
