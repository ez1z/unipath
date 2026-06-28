import Link from 'next/link';

export type EntityRow = {
  id: string;
  name: string;
  views: number;
  country?: string;
  moeApproved?: boolean;
};

type Props = {
  rows: EntityRow[];
  /** Admin edit path prefix, e.g. '/admin/universities'. Links to `${prefix}/${id}/edit`. */
  editPrefix: string;
  emptyText?: string;
};

function MoeBadge() {
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      MoE
    </span>
  );
}

// Mobile card list + desktop table, mirroring UniversityAdminTable's responsive pattern.
export function TopEntityTable({ rows, editPrefix, emptyText = 'No views yet.' }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>;
  }

  return (
    <>
      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        {rows.map((r, i) => (
          <Link
            key={r.id}
            href={`${editPrefix}/${r.id}/edit`}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
          >
            <span className="text-xs font-semibold text-muted-foreground w-5 shrink-0">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-foreground truncate flex items-center gap-1.5">
                {r.name}
                {r.moeApproved && <MoeBadge />}
              </div>
              {r.country && <div className="text-xs text-muted-foreground">{r.country}</div>}
            </div>
            <span className="shrink-0 font-heading font-bold text-foreground tabular-nums">{r.views}</span>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-8">#</th>
              <th className="text-left font-medium px-3 py-2">Name</th>
              <th className="text-left font-medium px-3 py-2">Country</th>
              <th className="text-right font-medium px-3 py-2">Views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link href={`${editPrefix}/${r.id}/edit`} className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5">
                    {r.name}
                    {r.moeApproved && <MoeBadge />}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.country ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
