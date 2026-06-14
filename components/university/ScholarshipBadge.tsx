import { useTranslations } from 'next-intl';

export function ScholarshipBadge() {
  const t = useTranslations('university');
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tk-green/10 text-tk-green border border-tk-green/40 whitespace-nowrap"
      title={t('scholarship_badge_title')}
      aria-label={t('scholarship_badge_title')}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
      {t('scholarship_badge')}
    </span>
  );
}
