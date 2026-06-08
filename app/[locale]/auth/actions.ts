'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
});

export async function signInWithEmailAction(
  locale: string,
  formData: FormData
): Promise<{ error: string }> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect(`/${locale}`);
}

export async function signUpWithEmailAction(
  locale: string,
  formData: FormData
): Promise<{ error: string }> {
  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name } },
  });
  if (error) return { error: error.message };

  redirect(`/${locale}`);
}

export async function signInWithOAuthAction(
  locale: string,
  next?: string
): Promise<{ error: string }> {
  const headersList = await headers();
  const origin = headersList.get('origin') ?? 'http://localhost:3000';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/${locale}${next ?? ''}`,
    },
  });
  if (error || !data.url) return { error: error?.message ?? 'OAuth failed' };

  redirect(data.url);
}

export async function signOutAction(locale: string): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/auth/signin`);
}
