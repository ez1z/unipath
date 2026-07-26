import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { getAll } from "@/lib/data/universities";
import { getAll as getAllScholarships } from "@/lib/data/scholarships";
import { loadPopularIds } from "@/lib/analytics/queries";
import { UniversityCard } from "@/components/university/UniversityCard";
import { ScholarshipCard } from "@/components/scholarship/ScholarshipCard";
import { canonicalFor, localeAlternates } from "@/lib/seo";
import type { Locale } from "@/lib/constants";

// Most-viewed ids first (preserving rank), then fill from the front so the
// sections are never empty while analytics is still sparse.
function pickPopular<T extends { id: string }>(all: T[], ids: string[], n: number): T[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const x = byId.get(id);
    if (x && !seen.has(id)) { picked.push(x); seen.add(id); }
  }
  for (const x of all) {
    if (picked.length >= n) break;
    if (!seen.has(x.id)) { picked.push(x); seen.add(x.id); }
  }
  return picked.slice(0, n);
}

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('home_title'),
    description: t('home_description'),
    alternates: {
      canonical: canonicalFor(locale, ''),
      languages: localeAlternates(''),
    },
    openGraph: { title: t('home_title'), description: t('home_description') },
  };
}

export default async function HomePage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const [universities, scholarships, popular] = await Promise.all([
    getAll(),
    getAllScholarships(),
    loadPopularIds(6),
  ]);
  const moeCount = universities.filter((u) => u.moe_approved).length;
  const countryCount = new Set(universities.map((u) => u.country)).size;

  const popularUniversities = pickPopular(universities, popular.universityIds, 6);
  const popularScholarships = pickPopular(scholarships, popular.scholarshipIds, 6);
  const uniNameById = new Map(universities.map((u) => [u.id, u.name[locale] ?? u.name.en]));

  const features = [
    {
      title: t("feature_universities_title"),
      desc: t("feature_universities_desc"),
    },
    {
      title: t("feature_transfer_title"),
      desc: t("feature_transfer_desc"),
    },
    {
      title: t("feature_tracker_title"),
      desc: t("feature_tracker_desc"),
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-brand-dark overflow-hidden">
        <div className="container mx-auto px-5 pt-14 pb-12 sm:pt-24 sm:pb-20 text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-gold/70 uppercase mb-5">
            {t("hero_eyebrow")}
          </p>
          <h1 className="font-heading text-[2.6rem] sm:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-5 max-w-2xl mx-auto">
            {t("hero_title")}
          </h1>
          <p className="text-base sm:text-lg text-white/45 mb-10 max-w-sm sm:max-w-lg mx-auto leading-relaxed">
            {t("hero_subtitle")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/universities`}
              className="px-8 py-3.5 bg-gold text-white rounded-lg font-semibold hover:bg-gold-dark transition-colors shadow-lg shadow-black/30"
            >
              {t("browse_all")}
            </Link>
            <Link
              href={`/${locale}/transfer`}
              className="px-8 py-3.5 border border-white/15 text-white/75 rounded-lg font-semibold hover:border-gold/40 hover:text-white transition-colors"
            >
              {t("transfer_guide")}
            </Link>
          </div>
        </div>
      </section>

      {/* Floating stats */}
      <section className="container mx-auto px-5 mt-6 sm:mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto sm:-mt-8">
          {[
            { value: universities.length, label: t("stats_universities") },
            { value: countryCount, label: t("stats_countries") },
            { value: moeCount, label: t("stats_moe_approved") },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="bg-card rounded-2xl border border-border shadow-card text-center p-5 sm:p-6 border-t-2 border-t-gold"
            >
              <div className="font-heading text-4xl font-bold text-foreground">
                {value}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-5 py-16 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12 max-w-3xl mx-auto">
          {features.map((f) => (
            <div key={f.title}>
              <div className="w-7 h-0.5 bg-gold mb-5" />
              <h3 className="font-heading font-semibold text-base text-foreground mb-2.5">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular universities */}
      {popularUniversities.length > 0 && (
        <section className="container mx-auto px-5 pb-4">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              {t("popular_universities_title")}
            </h2>
            <Link href={`/${locale}/universities`} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap">
              {t("view_all")}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularUniversities.map((u) => (
              <UniversityCard key={u.id} university={u} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {/* Popular scholarships */}
      {popularScholarships.length > 0 && (
        <section className="container mx-auto px-5 py-16 sm:py-20">
          <div className="flex items-end justify-between mb-5">
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              {t("popular_scholarships_title")}
            </h2>
            <Link href={`/${locale}/scholarships`} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap">
              {t("view_all")}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularScholarships.map((sc) => (
              <ScholarshipCard
                key={sc.id}
                scholarship={sc}
                locale={locale}
                universityName={sc.university_id ? uniNameById.get(sc.university_id) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
