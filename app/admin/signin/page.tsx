import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Admin Sign In — UniPath' };

export default async function SignInPage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/admin');
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Crimson background with gül decorations — mirrors the hero section */}
      <div className="flex-1 bg-primary flex items-center justify-center px-4 py-16 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 opacity-10 pointer-events-none">
          <GulPattern size={340} className="text-gold" />
        </div>
        <div className="absolute -bottom-20 -left-20 opacity-[0.07] pointer-events-none">
          <GulPattern size={280} className="text-white" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <GulPattern size={52} className="text-gold mb-3" />
            <span className="font-heading text-3xl font-bold text-gold tracking-wide">UniPath</span>
            <span className="text-primary-foreground/60 text-sm mt-1">Admin portal</span>
          </div>

          {/* Card */}
          <div className="bg-card rounded-xl border border-border shadow-card border-t-4 border-t-gold p-8">
            <h1 className="font-heading text-xl font-bold text-foreground mb-6">Sign in</h1>
            <SignInForm />
          </div>
        </div>
      </div>

      {/* Carpet stripe — same as hero bottom */}
      <div className="h-2 flex">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
        ))}
      </div>
    </main>
  );
}
