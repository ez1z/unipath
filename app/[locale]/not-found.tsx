import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function NotFound() {
  const t = useTranslations('common');
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-muted-foreground mb-8">{t('not_found')}</p>
      <Link href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90">
        {t('back_home')}
      </Link>
    </div>
  );
}
