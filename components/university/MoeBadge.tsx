import { useTranslations } from 'next-intl';

export function MoeBadge() {
  const t = useTranslations('university');
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold/10 text-gold-dark border border-gold/40 whitespace-nowrap"
      title={t('moe_badge_title')}
      aria-label={t('moe_badge_title')}
    >
      ★ {t('moe_badge')}
    </span>
  );
}
