import { useTranslations } from 'next-intl';

const STEPS = [
  { title: 'step1_title', desc: 'step1_desc' },
  { title: 'step2_title', desc: 'step2_desc' },
  { title: 'step3_title', desc: 'step3_desc' },
  { title: 'step4_title', desc: 'step4_desc' },
  { title: 'step5_title', desc: 'step5_desc' },
] as const;

export function TransferGuideSteps() {
  const t = useTranslations('transfer');

  return (
    <ol className="space-y-5" aria-label={t('guide_title')}>
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gold text-white font-heading font-bold text-base flex items-center justify-center shadow-sm">
            {i + 1}
          </div>
          <div className="pt-1.5">
            <h3 className="font-semibold text-foreground">{t(step.title)}</h3>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{t(step.desc)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
