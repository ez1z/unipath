import type { Metadata } from 'next';
import { Fraunces, DM_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import '@/app/globals.css';
import enMessages from '@/messages/en.json';

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

export const metadata: Metadata = {
  title: 'Admin — UniPath',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  setRequestLocale('en');
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider locale="en" messages={{ admin: enMessages.admin }}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
