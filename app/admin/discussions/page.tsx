import { AdminHeader } from '@/components/admin/AdminHeader';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteReportedMessageAction, dismissReportAction } from './actions';

export const metadata = { title: 'Reported messages — UniPath Admin' };
export const dynamic = 'force-dynamic';

type ReportRow = {
  id: string;
  reason: string | null;
  created_at: string;
  message: {
    id: string;
    body: string;
    author_label: string;
    entity_type: string;
    is_deleted: boolean;
  } | null;
};

export default async function AdminDiscussionsPage() {
  const { user } = await requireSuperuser();
  const service = createServiceClient();
  const { data } = await service
    .from('discussion_reports')
    .select('id, reason, created_at, message:discussion_messages(id, body, author_label, entity_type, is_deleted)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  const reports = (data ?? []) as unknown as ReportRow[];

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">Reported messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {reports.length} open {reports.length === 1 ? 'report' : 'reports'}
          </p>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No open reports.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => (
              <li key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="font-semibold text-foreground">{r.message?.author_label ?? '—'}</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted">{r.message?.entity_type ?? '—'}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  {r.message?.is_deleted && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">removed</span>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-3">
                  {r.message?.is_deleted ? '[removed]' : r.message?.body ?? '[message missing]'}
                </p>
                {r.reason && <p className="text-xs text-muted-foreground mb-3">Reason: {r.reason}</p>}
                <div className="flex flex-col sm:flex-row gap-2">
                  {r.message && !r.message.is_deleted && (
                    <form action={deleteReportedMessageAction.bind(null, r.message.id)}>
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Delete message
                      </button>
                    </form>
                  )}
                  <form action={dismissReportAction.bind(null, r.id)}>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                    >
                      Dismiss report
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
