import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AdminRole = 'admin' | 'superuser';

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');
  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id, role')
    .eq('user_id', user.id)
    .single();
  if (!adminRow) notFound();
  return { supabase, user, role: adminRow.role as AdminRole };
}

export async function requireSuperuser() {
  const { supabase, user, role } = await requireAdmin();
  if (role !== 'superuser') redirect('/admin');
  return { supabase, user };
}

export async function logAction(params: {
  adminUserId: string;
  adminEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const service = createServiceClient();
    await service.from('audit_logs').insert({
      admin_user_id: params.adminUserId,
      admin_email: params.adminEmail,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName ?? null,
      details: params.details ?? null,
    });
  } catch {
    // Never block the main action if logging fails
  }
}
