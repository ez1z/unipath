import { TMT_PER_USD } from '@/lib/constants';

export function formatTuition(usd: number): string {
  const tmt = usd * TMT_PER_USD;
  return `$${usd.toLocaleString('en')} / ${tmt.toLocaleString('ru')} TMT`;
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}
