import Link from 'next/link';

const RANGES = [7, 30, 90] as const;

export function RangeTabs({ days }: { days: number }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5" role="tablist" aria-label="Date range">
      {RANGES.map((r) => {
        const active = r === days;
        return (
          <Link
            key={r}
            href={`/admin/analytics?days=${r}`}
            role="tab"
            aria-selected={active}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r}d
          </Link>
        );
      })}
    </div>
  );
}
