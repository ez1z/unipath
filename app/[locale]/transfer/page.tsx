import { useTranslations } from 'next-intl';
import { TMT_PER_USD, TRANSFER_CAP_USD, TRANSFER_CAP_TMT } from '@/lib/constants';
import { TransferCalculator } from '@/components/transfer/TransferCalculator';
import { TransferGuideSteps } from '@/components/transfer/TransferGuideSteps';
import { GulPattern } from '@/components/ui/GulPattern';

export default function TransferPage() {
  const t = useTranslations('transfer');

  return (
    <>
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary-foreground">{t('title')}</h1>
            <p className="text-primary-foreground/60 mt-1 text-sm">{t('subtitle')}</p>
          </div>
          <GulPattern size={52} className="text-gold/40 hidden sm:block" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
          ))}
        </div>
      </div>

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
