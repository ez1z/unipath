import type { Metadata } from 'next';
import { Lora, Inter } from 'next/font/google';
import '@/app/globals.css';

const lora = Lora({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Admin — UniPath',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // The admin area is English-only; its copy is written inline in the admin
  // components rather than going through next-intl, so no i18n provider here.
  return (
    <html lang="en" className={`${lora.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
