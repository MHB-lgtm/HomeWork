import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { RoleProvider } from '../../contexts/RoleContext';
import { AppShell } from '../../components/layout/AppShell';

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'he' | 'en')) notFound();
  const messages = await getMessages();
  return (
    <div lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <NextIntlClientProvider messages={messages}>
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </NextIntlClientProvider>
    </div>
  );
}
