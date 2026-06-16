import { useTranslations } from 'next-intl';

type EssayType =
  | 'personal_statement'
  | 'statement_of_purpose'
  | 'why_school'
  | 'supplemental'
  | 'short_answer'
  | 'open_prompt';

type EssayEntry = {
  essay_type: EssayType;
  length?: number;
  length_unit?: 'words' | 'characters';
  description?: string;
};

type TestEntry = {
  type: 'toefl' | 'ielts' | 'sat' | 'duolingo';
  format?: 'ibt' | 'pbt';
  min_score?: number;
  min_math?: number;
  min_verbal?: number;
};

type Requirement = {
  yos?: boolean;
  ege?: boolean;
  ucas?: boolean;
  common_app?: boolean;
  quota?: boolean;
  notes?: string;
};

type Props = { requirements: Record<string, unknown> };

const COUNTRY_LABELS: Record<string, string> = {
  turkey: 'Turkey',
  russia: 'Russia',
  uk: 'United Kingdom',
  usa: 'United States',
};

const COUNTRY_KEYS = ['turkey', 'russia', 'uk', 'usa'];

export function EntranceRequirements({ requirements }: Props) {
  const t = useTranslations('university');

  const tests = Array.isArray(requirements.tests) ? (requirements.tests as TestEntry[]) : [];
  const essays = Array.isArray(requirements.essays) ? (requirements.essays as EssayEntry[]) : [];
  const countryEntries = Object.entries(requirements).filter(([k]) => COUNTRY_KEYS.includes(k));

  if (tests.length === 0 && essays.length === 0 && countryEntries.length === 0) return null;

  const essayTypeKey = (type: EssayType) =>
    `essay_type_${type}` as Parameters<typeof t>[0];

  return (
    <div className="space-y-3">
      {/* Standardized tests */}
      {tests.length > 0 && (
        <div className="border border-border rounded-xl p-4 bg-card">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-primary mb-3">
            {t('tests_title')}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {tests.map((test, i) => (
              <li key={i} className="flex items-center gap-2 text-foreground">
                <span className="text-tk-green font-bold">✓</span>
                {test.type === 'toefl' && (
                  <>
                    {test.format === 'pbt' ? t('toefl_pbt') : t('toefl_ibt')}
                    {test.min_score != null && (
                      <span className="text-muted-foreground">
                        {t('min_score_suffix', { score: test.min_score, max: test.format === 'pbt' ? 6 : 120 })}
                      </span>
                    )}
                  </>
                )}
                {test.type === 'ielts' && (
                  <>
                    {t('ielts')}
                    {test.min_score != null && (
                      <span className="text-muted-foreground">
                        {t('min_score_suffix', { score: test.min_score, max: 9 })}
                      </span>
                    )}
                  </>
                )}
                {test.type === 'sat' && (
                  <>
                    {t('sat_test')}
                    {(test.min_math != null || test.min_verbal != null) && (
                      <span className="text-muted-foreground">
                        {[
                          test.min_math != null ? t('sat_math_suffix', { score: test.min_math }) : null,
                          test.min_verbal != null ? t('sat_verbal_suffix', { score: test.min_verbal }) : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </>
                )}
                {test.type === 'duolingo' && (
                  <>
                    {t('duolingo')}
                    {test.min_score != null && (
                      <span className="text-muted-foreground">
                        {t('min_score_suffix', { score: test.min_score, max: 160 })}
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Essays */}
      {essays.length > 0 && (
        <div className="border border-border rounded-xl p-4 bg-card">
          <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-primary mb-3">
            {t('essays_title')}
          </h3>
          <ul className="space-y-3">
            {essays.map((essay, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <span className="text-tk-green font-bold">✓</span>
                  {t(essayTypeKey(essay.essay_type))}
                  {essay.length != null && (
                    <span className="text-muted-foreground font-normal">
                      — {t('essay_length', {
                        length: essay.length,
                        unit: essay.length_unit === 'characters'
                          ? t('essay_length_characters')
                          : t('essay_length_words'),
                      })}
                    </span>
                  )}
                </div>
                {essay.description && (
                  <p className="mt-1 ml-5 text-muted-foreground">{essay.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Country-specific requirements */}
      {countryEntries.map(([country, req]) => {
        const r = req as Requirement;
        const items: string[] = [];
        if (r.yos) items.push(t('yos_required'));
        if (r.ege) items.push(t('ege_required'));
        if (r.ucas) items.push(t('ucas_required'));
        if (r.common_app) items.push(t('common_app'));
        if (r.quota) items.push(t('quota_available'));
        if (items.length === 0 && !r.notes) return null;
        return (
          <div key={country} className="border border-border rounded-xl p-4 bg-card">
            <h3 className="font-heading font-semibold text-sm uppercase tracking-wider text-primary mb-3">
              {COUNTRY_LABELS[country] ?? country}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {items.map(item => (
                <li key={item} className="flex items-center gap-2 text-foreground">
                  <span className="text-tk-green font-bold">✓</span> {item}
                </li>
              ))}
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
