import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAll } from "@/lib/data/universities";
import type { Locale } from "@/lib/constants";

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function HomePage({ params: { locale } }: Props) {
  const t = await getTranslations("home");
  const universities = await getAll();
  const moeCount = universities.filter((u) => u.moe_approved).length;
  const countryCount = new Set(universities.map((u) => u.country)).size;

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
    </>
  );
}
