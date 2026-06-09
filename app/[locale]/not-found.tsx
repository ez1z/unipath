import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-5 text-center">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-gold/70 uppercase mb-6">
        UniPath
      </p>
      <div className="font-heading text-[7rem] sm:text-[9rem] font-bold leading-none text-foreground/8 select-none">
        404
      </div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-2 mb-4">
        {t('not_found')}
      </h1>
      <p className="text-muted-foreground text-sm max-w-xs mb-10 leading-relaxed">
        {t('not_found_desc')}
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        ← {t('back_home')}
      </Link>
    </div>
  );
}
