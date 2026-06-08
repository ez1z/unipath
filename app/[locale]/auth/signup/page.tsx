import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { SignUpForm } from './SignUpForm';
import type { Locale } from '@/lib/constants';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: `${t('signup_title')} — UniPath` };
}

export default async function SignUpPage({ params }: Props) {
  const { locale } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(`/${locale}`);
  } catch {
    // Supabase unreachable — render form
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background relative overflow-hidden">
      <div className="absolute -top-20 -right-20 opacity-5 pointer-events-none select-none" aria-hidden="true">
        <GulPattern size={360} className="text-primary" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border shadow-card border-t-4 border-t-gold p-8">
          <div className="flex flex-col items-center mb-8">
            <GulPattern size={36} className="text-gold mb-2" />
            <span className="font-heading text-2xl font-bold text-foreground">UniPath</span>
          </div>
          <SignUpForm locale={locale as Locale} />
        </div>
      </div>
    </main>
  );
}
