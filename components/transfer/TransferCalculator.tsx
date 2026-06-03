'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = { capUsd: number; ratePerUsd: number };

export function TransferCalculator({ capUsd, ratePerUsd }: Props) {
  const t = useTranslations('transfer');
  const [raw, setRaw] = useState('');

  const inputUsd = parseFloat(raw);
  const isValid = !isNaN(inputUsd) && inputUsd > 0;
  const effectiveUsd = isValid ? Math.min(inputUsd, capUsd) : 0;
  const tmt = effectiveUsd * ratePerUsd;
  const exceedsCap = isValid && inputUsd > capUsd;

  return (
    <div>
      <label htmlFor="tuition-input" className="block text-sm font-medium text-foreground mb-2">
        {t('amount_label')}
      </label>
      <input
        id="tuition-input"
        type="number"
        min={0}
        step={100}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={t('amount_placeholder')}
        aria-describedby={exceedsCap ? 'cap-warning' : undefined}
        className="w-full sm:w-72 px-4 py-3 border-2 border-input rounded-lg text-sm bg-background focus:outline-none focus:border-primary transition-colors"
      />

      {exceedsCap && (
        <div
          id="cap-warning"
          role="alert"
          className="mt-3 flex items-start gap-3 text-sm bg-crimson-light border border-crimson/25 rounded-lg px-4 py-3"
        >
          <span className="text-crimson font-bold text-base leading-tight">!</span>
          <span className="text-crimson-dark">{t('cap_warning')}</span>
        </div>
      )}

      {isValid && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-xs">
          <div className="border-2 border-primary/20 rounded-xl p-4 bg-background">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
              {t('result_usd')}
            </div>
            <div className="font-heading font-bold text-xl text-primary">
              ${effectiveUsd.toLocaleString('en')}
            </div>
          </div>
          <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
              {t('result_tmt')}
            </div>
            <div className="font-heading font-bold text-xl text-gold-dark">
              {tmt.toLocaleString('ru')} TMT
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
