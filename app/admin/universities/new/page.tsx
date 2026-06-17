import Link from 'next/link';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { UniversityForm } from '@/components/admin/UniversityForm';
import { createUniversityAction } from '@/app/admin/universities/actions';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'Add University — UniPath Admin' };

function loadMoeNames(): string[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'moe-universities.json'), 'utf8');
    const list = JSON.parse(raw) as Array<{ name: string }>;
    return list.map((e) => e.name);
  } catch {
    return [];
  }
}

export default async function NewUniversityPage() {
  const { user } = await requireAdmin();
  const moeNames = loadMoeNames();

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <Link href="/admin/universities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {"← Universities"}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Add university"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{"Fill in the details below. All fields marked * are required."}</p>
        </div>
        <UniversityForm
          action={createUniversityAction}
          submitLabel={"Add university"}
          cancelHref="/admin/universities"
          moeNames={moeNames}
        />
      </main>
    </div>
  );
}
