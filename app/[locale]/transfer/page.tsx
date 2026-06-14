import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { TMT_PER_USD, TRANSFER_CAP_USD, TRANSFER_CAP_TMT } from '@/lib/constants';
import { TransferCalculator } from '@/components/transfer/TransferCalculator';
import { TransferGuideSteps } from '@/components/transfer/TransferGuideSteps';
import { PageHeader } from '@/components/ui/PageHeader';
import type { Locale } from '@/lib/constants';

type Props = { params: { locale: Locale } };

export default function TransferPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = useTranslations('transfer');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Calculator card */}
        <section className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-10">
          <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center gap-3">
            <div className="w-1 h-8 bg-gold rounded-full" />
            <div>
              <h2 className="font-heading text-xl font-semibold text-foreground">{t('calculator_title')}</h2>
              <p className="text-sm text-muted-foreground">{t('calculator_desc')}</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="flex flex-wrap gap-4 text-sm mb-5">
              <div className="px-4 py-2.5 bg-primary/5 border border-primary/15 rounded-lg">
                <span className="text-muted-foreground">{t('cap_info', { tmt: TRANSFER_CAP_TMT.toLocaleString('ru') })}</span>
              </div>
              <div className="px-4 py-2.5 bg-gold/5 border border-gold/20 rounded-lg">
                <span className="text-muted-foreground">{t('rate_info', { rate: TMT_PER_USD })}</span>
              </div>
            </div>
            <TransferCalculator capUsd={TRANSFER_CAP_USD} ratePerUsd={TMT_PER_USD} />
          </div>
        </section>

        {/* Steps card */}
        <section className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-10">
          <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center gap-3">
            <div className="w-1 h-8 bg-gold rounded-full" />
            <h2 className="font-heading text-xl font-semibold text-foreground">{t('guide_title')}</h2>
          </div>
          <div className="px-6 py-5">
            <TransferGuideSteps />
          </div>
        </section>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">{t('disclaimer')}</p>
      </div>
    </>
  );
}
