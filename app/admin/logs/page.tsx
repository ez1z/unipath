import Link from 'next/link';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminHeader';

export const metadata = { title: 'Audit Logs — UniPath Admin' };

export default async function LogsPage() {
  const { user } = await requireSuperuser();
  const service = createServiceClient();

  const ACTION_LABELS: Record<string, string> = {
    create_university: "Created university",
    update_university: "Updated university",
    delete_university: "Deleted university",
    toggle_moe_approved: "Toggled MoE status",
    import_universities: "Imported universities",
    create_scholarship: "Created scholarship",
    update_scholarship: "Updated scholarship",
    delete_scholarship: "Deleted scholarship",
    add_admin: "Added admin",
    remove_admin: "Removed admin",
    set_role: "Changed role",
    reset_admin_password: "Reset admin password",
  };

  const { data: logs } = await service
    .from('audit_logs')
    .select('id, admin_email, action, entity_type, entity_id, entity_name, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {"← Dashboard"}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Audit Logs"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{`Last ${logs?.length ?? 0} actions`}</p>
        </div>

        {!logs || logs.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <p className="text-muted-foreground text-sm">{"No activity recorded yet."}</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{"Date & Time"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"Admin"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"Action"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"Target"}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{log.admin_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        log.action.startsWith('delete') || log.action === 'remove_admin'
                          ? 'bg-red-50 text-red-700'
                          : log.action.startsWith('create') || log.action === 'add_admin'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      {log.action === 'import_universities' && log.details?.count && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {`(${String(log.details.count)} rows)`}
                        </span>
                      )}
                      {log.action === 'set_role' && log.details?.role && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {`→ ${String(log.details.role)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.entity_name ?? log.entity_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
