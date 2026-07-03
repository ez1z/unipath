import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { Fraunces, DM_Sans } from 'next/font/google';
import Link from 'next/link';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { Locale } from '@/lib/constants';
import { NavBar } from '@/components/NavBar';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { getSiteUrl, localeAlternates, organizationJsonLd, websiteJsonLd, jsonLdScript } from '@/lib/seo';
import '@/app/globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) return {};
  const t = await getTranslations({ locale: locale as Locale, namespace: 'meta' });
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t('site_title'),
      template: `%s | UniPath`,
    },
    description: t('site_description'),
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: localeAlternates(''),
    },
    openGraph: {
      siteName: 'UniPath',
      locale,
      type: 'website',
      url: `${siteUrl}/${locale}`,
      title: t('site_title'),
      description: t('site_description'),
    },
    twitter: {
      card: 'summary',
      title: t('site_title'),
      description: t('site_description'),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params;
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) notFound();

  // Make the locale available to next-intl during static rendering. Without
  // this, statically-generated pages fall back to DEFAULT_LOCALE regardless of
  // the URL segment, producing the wrong language on non-dynamic routes.
  setRequestLocale(locale);

  const [messages, tNav] = await Promise.all([
    getMessages(),
    getTranslations({ locale: locale as Locale, namespace: 'nav' }),
  ]);

  const year = new Date().getFullYear();

  return (
    <html lang={locale} className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-background font-sans flex flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd(locale as Locale)) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <NavBar locale={locale as Locale} />
          <main className="flex-1">{children}</main>
          <ChatWidget />
          <AnalyticsTracker />

          <footer className="bg-brand-dark">
            <div className="container mx-auto px-5 pt-12 pb-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 mb-10">
                <div className="max-w-xs">
                  <span className="font-heading font-bold text-xl text-gold tracking-wide block mb-3">UniPath</span>
                  <p className="text-sm text-white/30 leading-relaxed">
                    {tNav('footer_tagline')}
                  </p>
                </div>
                <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label={tNav('footer_nav_label')}>
                  <Link href={`/${locale}/universities`} className="text-white/40 hover:text-gold transition-colors">{tNav('universities')}</Link>
                  <Link href={`/${locale}/compare`} className="text-white/40 hover:text-gold transition-colors">{tNav('compare')}</Link>
                  <Link href={`/${locale}/transfer`} className="text-white/40 hover:text-gold transition-colors">{tNav('transfer')}</Link>
                  <Link href={`/${locale}/scholarships`} className="text-white/40 hover:text-gold transition-colors">{tNav('scholarships')}</Link>
                  <Link href={`/${locale}/support`} className="text-white/40 hover:text-gold transition-colors">{tNav('support')}</Link>
                </nav>
              </div>
              <div className="border-t border-white/10 pt-6 flex flex-wrap justify-between gap-3 text-xs text-white/20">
                <span>© {year} UniPath</span>
                <span>{tNav('footer_disclaimer')}</span>
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
