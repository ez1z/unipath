import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Playfair_Display, Inter } from 'next/font/google';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { Locale } from '@/lib/constants';
import { NavBar } from '@/components/NavBar';
import { GulPattern } from '@/components/ui/GulPattern';
import '@/app/globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UniPath — University Search for Turkmen Students',
  description: 'Find MoE-approved universities abroad, compare options, and learn about official tuition transfer.',
};

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params;
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <NavBar locale={locale as Locale} />
          <main className="flex-1">{children}</main>
          <footer className="bg-primary text-primary-foreground mt-16">
            <div className="container mx-auto px-4 py-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <GulPattern size={26} className="text-gold" />
                  <span className="font-heading font-bold text-lg text-gold">UniPath</span>
                </div>
                <span className="text-sm opacity-50">© {new Date().getFullYear()} UniPath</span>
              </div>
              <div className="border-t border-white/15 pt-4 text-xs opacity-50 text-center">
                A guide platform for Turkmen students. Not a payment processor.
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
