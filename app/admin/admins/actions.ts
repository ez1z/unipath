'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSuperuser, logAction } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';

const AddAdminSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export async function addAdminAction(formData: FormData): Promise<{ error: string } | never> {
  const { user } = await requireSuperuser();

  const parsed = AddAdminSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const service = createServiceClient();

  // Check if the auth user already exists
  const { data: listData } = await service.auth.admin.listUsers({ perPage: 1000 });
  const existing = listData?.users.find((u) => u.email === parsed.data.email);

  let adminUserId: string;

  if (existing) {
    const { data: existingAdmin } = await service
      .from('admins')
      .select('user_id')
      .eq('user_id', existing.id)
      .single();
    if (existingAdmin) return { error: 'This email already has admin access.' };
    adminUserId = existing.id;
  } else {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    });
    if (createError || !created.user) return { error: createError?.message ?? 'Failed to create user.' };
    adminUserId = created.user.id;
  }

  const { error: insertError } = await service
    .from('admins')
    .insert({ user_id: adminUserId, role: 'admin' });
  if (insertError) return { error: insertError.message };

  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'add_admin',
    entityType: 'admin',
    entityId: adminUserId,
    entityName: parsed.data.email,
  });

  redirect('/admin/admins');
}

export async function removeAdminAction(targetUserId: string): Promise<{ error?: string }> {
  const { user } = await requireSuperuser();
  if (targetUserId === user.id) return { error: 'You cannot remove yourself.' };

  const service = createServiceClient();

  const { data: targetUserData } = await service.auth.admin.getUserById(targetUserId);
  const targetEmail = targetUserData?.user?.email ?? targetUserId;

  const { error } = await service.from('admins').delete().eq('user_id', targetUserId);
  if (error) return { error: error.message };

  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'remove_admin',
    entityType: 'admin',
    entityId: targetUserId,
    entityName: targetEmail,
  });

  revalidatePath('/admin/admins');
  return {};
}

const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export async function resetAdminPasswordAction(
  targetUserId: string,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireSuperuser();

  const parsed = ResetPasswordSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const service = createServiceClient();

  const { data: targetUserData } = await service.auth.admin.getUserById(targetUserId);
  const targetEmail = targetUserData?.user?.email ?? targetUserId;

  const { error } = await service.auth.admin.updateUserById(targetUserId, {
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'reset_admin_password',
    entityType: 'admin',
    entityId: targetUserId,
    entityName: targetEmail,
  });

  return { success: true };
}
