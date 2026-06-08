import { redirect } from 'next/navigation';
import type { Locale } from '@/lib/constants';

type Props = { params: Promise<{ locale: Locale }> };

export default async function TrackerPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/tracker/profile`);
}
