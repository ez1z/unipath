type Accent = 'primary' | 'gold' | 'tk-green' | 'amber-400' | 'slate-400' | 'red-400';

const ACCENT: Record<Accent, string> = {
  primary: 'border-t-primary',
  gold: 'border-t-gold',
  'tk-green': 'border-t-tk-green',
  'amber-400': 'border-t-amber-400',
  'slate-400': 'border-t-slate-400',
  'red-400': 'border-t-red-400',
};

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
};

export function KpiCard({ label, value, hint, accent = 'primary' }: Props) {
  return (
    <div className={`bg-card rounded-xl border border-border border-t-4 ${ACCENT[accent]} p-5`}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</div>
      <div className="font-heading font-bold text-2xl text-foreground leading-none">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}
