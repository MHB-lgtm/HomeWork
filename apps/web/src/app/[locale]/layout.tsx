import { Rubik } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { RoleProvider } from '../../contexts/RoleContext';
import { AppShell } from '../../components/layout/AppShell';
import '../globals.css';

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-rubik',
  display: 'swap',
});

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'he' | 'en')) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'} className={rubik.variable}>
      <body className="antialiased font-sans">
        <NextIntlClientProvider messages={messages}>
          <RoleProvider>
            <AppShell>{children}</AppShell>
          </RoleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
