import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Admin Sign In — UniPath' };

export default async function SignInPage() {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) redirect('/admin');
    }
  } catch {
    // Supabase unreachable — render sign-in form
  }


  return (
    <main className="min-h-screen bg-brand-dark flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <span className="font-heading font-bold text-3xl text-gold tracking-wide">UniPath</span>
          <span className="text-white/35 text-sm mt-1.5">{"Admin portal"}</span>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card p-8">
          <h1 className="font-heading text-xl font-bold text-foreground mb-6">{"Sign in"}</h1>
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
