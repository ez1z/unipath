type Row = { label: string; value: number; href?: string };

type Props = {
  rows: Row[];
  emptyText?: string;
  /** Tailwind bar color class, e.g. 'bg-primary/15'. */
  barClass?: string;
};

// Dependency-free horizontal bar list — reused for top searches, countries, referrers.
export function BarList({ rows, emptyText = 'No data yet.', barClass = 'bg-primary/15' }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="relative">
          <div
            className={`absolute inset-y-0 left-0 rounded-md ${barClass}`}
            style={{ width: `${Math.max((r.value / max) * 100, 4)}%` }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{r.value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
