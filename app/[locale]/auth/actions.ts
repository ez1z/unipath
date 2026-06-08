'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(80),
  age: z.coerce.number().int().min(14).max(100),
});

function mapZodSignUpError(issue: z.ZodIssue, t: (key: string) => string): string {
  const field = issue.path[0] as string;
  if (field === 'name') return issue.code === 'too_big' ? t('error_name_too_long') : t('error_name_required');
  if (field === 'email') return t('error_email_invalid');
  if (field === 'password') return t('error_password_short');
  if (field === 'age') return t('error_age_invalid');
  return t('error_generic');
}

function mapSupabaseSignUpError(message: string, t: (key: string) => string): string {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already')) {
    return t('error_email_in_use');
  }
  if (lower.includes('rate limit')) {
    return t('error_rate_limit');
  }
  return t('error_generic');
}

function mapSupabaseSignInError(message: string, t: (key: string) => string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return t('error_invalid_credentials');
  }
  return t('error_generic');
}

export async function signInWithEmailAction(
  locale: string,
  formData: FormData
): Promise<{ error: string }> {
  const t = await getTranslations({ locale, namespace: 'auth' });

  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0] as string;
    return { error: field === 'email' ? t('error_email_invalid') : t('error_generic') };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: mapSupabaseSignInError(error.message, t) };

  redirect(`/${locale}/tracker/profile`);
}

export async function signUpWithEmailAction(
  locale: string,
  formData: FormData
): Promise<{ error: string }> {
  const t = await getTranslations({ locale, namespace: 'auth' });

  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    age: formData.get('age'),
  });
  if (!parsed.success) {
    return { error: mapZodSignUpError(parsed.error.issues[0], t) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name, age: parsed.data.age } },
  });
  if (error) return { error: mapSupabaseSignUpError(error.message, t) };

  redirect(`/${locale}/tracker/profile`);
}

export async function signOutAction(locale: string): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/auth/signin`);
}
