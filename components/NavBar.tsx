import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { GulPattern } from '@/components/ui/GulPattern';
import { MobileMenu } from '@/components/MobileMenu';

type Props = { locale: Locale };

export function NavBar({ locale }: Props) {
  const t = useTranslations('nav');
  return (
    <nav
      className="bg-primary sticky top-0 z-40 shadow-md"
      aria-label="Main navigation"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-7">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 group"
            aria-label="UniPath home"
          >
            <GulPattern size={28} className="text-gold transition-transform group-hover:scale-110" />
            <span className="font-heading font-bold text-xl text-gold tracking-wide">UniPath</span>
          </Link>
          <div className="hidden sm:flex items-center gap-5 text-sm font-medium">
            <Link
              href={`/${locale}/universities`}
              className="text-primary-foreground/80 hover:text-gold transition-colors"
            >
              {t('universities')}
            </Link>
            <Link
              href={`/${locale}/compare`}
              className="text-primary-foreground/80 hover:text-gold transition-colors"
            >
              {t('compare')}
            </Link>
            <Link
              href={`/${locale}/transfer`}
              className="text-primary-foreground/80 hover:text-gold transition-colors"
            >
              {t('transfer')}
            </Link>
            <Link
              href={`/${locale}/scholarships`}
              className="text-primary-foreground/80 hover:text-gold transition-colors"
            >
              {t('scholarships')}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <MobileMenu locale={locale} />
          <LocaleSwitcher currentLocale={locale} />
        </div>
      </div>
    </nav>
  );
}
