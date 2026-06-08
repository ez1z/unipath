'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TRANSFER_CAP_USD, UNOFFICIAL_TMT_PER_USD, OLD_MANAT_MULTIPLIER } from '@/lib/constants';

type Props = { capUsd: number; ratePerUsd: number };

export function TransferCalculator({ capUsd, ratePerUsd }: Props) {
  const t = useTranslations('transfer');
  const [raw, setRaw] = useState('');

  const inputUsd = parseFloat(raw);
  const isValid = !isNaN(inputUsd) && inputUsd > 0;
  const exceedsCap = isValid && inputUsd > capUsd;

  const officialUsd = isValid ? Math.min(inputUsd, capUsd) : 0;
  const officialTmt = officialUsd * ratePerUsd;
  const overageUsd = exceedsCap ? inputUsd - capUsd : 0;
  const unofficialTmt = overageUsd * UNOFFICIAL_TMT_PER_USD;
  const totalTmt = officialTmt + unofficialTmt;

  const oldManat = Math.round(totalTmt * OLD_MANAT_MULTIPLIER);
  const billions = Math.floor(oldManat / 1_000_000_000);
  const millions = Math.floor((oldManat % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((oldManat % 1_000_000) / 1_000);
  const oldManatParts: string[] = [];
  if (billions > 0) oldManatParts.push(`${billions} ${t('billion_word')}`);
  if (millions > 0) oldManatParts.push(`${millions} ${t('million_word')}`);
  if (thousands > 0) oldManatParts.push(`${thousands} ${t('thousand_word')}`);
  const oldManatText = oldManatParts.join(' ') || `< 1 ${t('thousand_word')}`;

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
          <span className="text-crimson font-bold text-base leading-tight shrink-0">!</span>
          <span className="text-crimson-dark">{t('dual_rate_note')}</span>
        </div>
      )}

      {isValid && !exceedsCap && (
        <div className="mt-5 space-y-3 sm:max-w-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-primary/20 rounded-xl p-4 bg-background">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_usd')}
              </div>
              <div className="font-heading font-bold text-xl text-primary">
                ${officialUsd.toLocaleString('en')}
              </div>
            </div>
            <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_tmt')}
              </div>
              <div className="font-heading font-bold text-xl text-gold-dark">
                {officialTmt.toLocaleString('ru')} TMT
              </div>
            </div>
          </div>
          <div className="border-2 border-amber-300/50 rounded-xl p-4 bg-amber-50/40">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
              {t('result_old_manat')}
            </div>
            <div className="font-heading font-bold text-lg text-amber-700">
              {oldManatText}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {officialTmt.toLocaleString('ru')} TMT × 5 000
            </div>
          </div>
        </div>
      )}

      {isValid && exceedsCap && (
        <div className="mt-5 space-y-3 sm:max-w-sm">
          {/* Official portion */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-primary/20 rounded-xl p-4 bg-background">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('official_portion')}
              </div>
              <div className="font-heading font-bold text-xl text-primary">
                ${officialUsd.toLocaleString('en')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t('official_rate_detail')}</div>
            </div>
            <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_tmt')}
              </div>
              <div className="font-heading font-bold text-xl text-gold-dark">
                {officialTmt.toLocaleString('ru')} TMT
              </div>
            </div>
          </div>

          {/* Unofficial portion */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-crimson/20 rounded-xl p-4 bg-crimson-light/40">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('unofficial_portion')}
              </div>
              <div className="font-heading font-bold text-xl text-crimson">
                ${overageUsd.toLocaleString('en')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t('unofficial_rate_detail')}</div>
            </div>
            <div className="border-2 border-crimson/20 rounded-xl p-4 bg-crimson-light/40">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_tmt')}
              </div>
              <div className="font-heading font-bold text-xl text-crimson">
                {unofficialTmt.toLocaleString('ru')} TMT
              </div>
            </div>
          </div>

          {/* Total TMT + Old manat */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-gold/30 rounded-xl p-4 bg-gold/5">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_tmt_total')}
              </div>
              <div className="font-heading font-bold text-xl text-gold-dark">
                {totalTmt.toLocaleString('ru')} TMT
              </div>
            </div>
            <div className="border-2 border-amber-300/50 rounded-xl p-4 bg-amber-50/40">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
                {t('result_old_manat')}
              </div>
              <div className="font-heading font-bold text-lg text-amber-700">
                {oldManatText}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {totalTmt.toLocaleString('ru')} TMT × 5 000
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
