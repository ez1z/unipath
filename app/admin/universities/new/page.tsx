import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { UniversityForm } from '@/components/admin/UniversityForm';
import { createUniversityAction } from '@/app/admin/universities/actions';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'Add University — UniPath Admin' };

export default async function NewUniversityPage() {
  const { user } = await requireAdmin();
  const t = await getTranslations('admin');

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <Link href="/admin/universities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t('back_universities')}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{t('unis_add_title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('unis_add_subtitle')}</p>
        </div>
        <UniversityForm
          action={createUniversityAction}
          submitLabel={t('unis_add_title')}
          cancelHref="/admin/universities"
        />
      </main>
    </div>
  );
}
