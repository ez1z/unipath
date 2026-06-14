import Link from 'next/link';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System Logs — UniPath Admin' };

const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-red-50 text-red-700 border border-red-200',
  warn:  'bg-amber-50 text-amber-700 border border-amber-200',
  info:  'bg-blue-50 text-blue-700 border border-blue-200',
};

export default async function SystemLogsPage() {
  const { user } = await requireSuperuser();
  const service = createServiceClient();

  const { data: logs } = await service
    .from('system_logs')
    .select('id, level, context, message, details, created_at')
    .order('created_at', { ascending: false })
    .limit(300);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {"← Dashboard"}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">
            {"System Logs"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {`Last ${logs?.length ?? 0} entries`}
          </p>
        </div>

        {!logs || logs.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <p className="text-muted-foreground text-sm">{"No errors logged yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-card rounded-xl border border-border shadow-card p-4"
              >
                <div className="flex flex-wrap items-start gap-3 mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info}`}>
                    {log.level}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {log.context}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-sm text-foreground font-medium break-all">{log.message}</p>

                {log.details && Object.keys(log.details).length > 0 && (
                  <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
