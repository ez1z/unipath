import { TMT_PER_USD, UNOFFICIAL_TMT_PER_USD, TRANSFER_CAP_USD, OLD_MANAT_MULTIPLIER } from '@/lib/constants';

export function formatTuition(usd: number): string {
  const tmt = usd * TMT_PER_USD;
  return `$${usd.toLocaleString('en')} / ${tmt.toLocaleString('ru')} TMT`;
}

export function computeTuitionBreakdown(tuitionUsd: number) {
  const exceedsCap = tuitionUsd > TRANSFER_CAP_USD;
  const officialTmt = Math.min(tuitionUsd, TRANSFER_CAP_USD) * TMT_PER_USD;
  const overageUsd = exceedsCap ? tuitionUsd - TRANSFER_CAP_USD : 0;
  const unofficialTmt = overageUsd * UNOFFICIAL_TMT_PER_USD;
  const totalTmt = officialTmt + unofficialTmt;
  const oldManat = Math.round(totalTmt * OLD_MANAT_MULTIPLIER);
  return {
    exceedsCap,
    officialTmt,
    overageUsd,
    unofficialTmt,
    totalTmt,
    billions: Math.floor(oldManat / 1_000_000_000),
    millions: Math.floor((oldManat % 1_000_000_000) / 1_000_000),
    thousands: Math.floor((oldManat % 1_000_000) / 1_000),
  };
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}
