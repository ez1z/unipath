import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { SignInForm } from './SignInForm';
import type { Locale } from '@/lib/constants';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: `${t('signin_title')} — UniPath` };
}

export default async function SignInPage({ params }: Props) {
  const { locale } = await params;

  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — render form
  }
  if (user) redirect(`/${locale}/tracker/profile`);

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border shadow-card border-t-4 border-t-gold p-8">
          <div className="flex flex-col items-center mb-8">
            <span className="font-heading text-2xl font-bold text-primary tracking-wide">UniPath</span>
          </div>
          <SignInForm locale={locale as Locale} />
        </div>
      </div>
    </main>
  );
}
