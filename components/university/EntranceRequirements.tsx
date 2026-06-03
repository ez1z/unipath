import { useTranslations } from 'next-intl';

type Requirement = {
  yos?: boolean;
  ege?: boolean;
  ucas?: boolean;
  common_app?: boolean;
  quota?: boolean;
  sat?: boolean | string;
  act?: boolean | string;
  notes?: string;
};

type Props = { requirements: Record<string, unknown> };

const COUNTRY_LABELS: Record<string, string> = {
  turkey: 'Turkey',
  russia: 'Russia',
  uk: 'United Kingdom',
  usa: 'United States',
};

export function EntranceRequirements({ requirements }: Props) {
  const t = useTranslations('university');
  const entries = Object.entries(requirements);

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(([country, req]) => {
        const r = req as Requirement;
        return (
          <div key={country} className="border border-border rounded-xl p-4 bg-card">
            <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-primary mb-3">
              {COUNTRY_LABELS[country] ?? country}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {r.yos && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('yos_required')}
                </li>
              )}
              {r.ege && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('ege_required')}
                </li>
              )}
              {r.ucas && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('ucas_required')}
                </li>
              )}
              {r.common_app && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('common_app')}
                </li>
              )}
              {r.quota && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('quota_available')}
                </li>
              )}
              {(r.sat === true || r.sat === 'required') && (
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {t('sat_required')}
                </li>
              )}
              {r.sat === 'optional' && (
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-bold">○</span> {t('sat_optional')}
                </li>
              )}
            </ul>
            {r.notes && (
              <p className="text-sm mt-3 text-foreground border-t border-border pt-3">
                <span className="font-semibold">{t('notes')}:</span> {r.notes}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
