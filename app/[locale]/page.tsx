import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAll } from "@/lib/data/universities";
import type { Locale } from "@/lib/constants";
import { GulPattern } from "@/components/ui/GulPattern";

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function HomePage({ params: { locale } }: Props) {
  const t = await getTranslations("home");
  const universities = await getAll();
  const moeCount = universities.filter((u) => u.moe_approved).length;
  const countryCount = new Set(universities.map((u) => u.country)).size;

  return (
    <>
      {/* Hero */}
      <section className="relative bg-primary overflow-hidden">
        {/* Background gül decorations */}
        <div className="absolute -top-12 -right-12 opacity-10 pointer-events-none">
          <GulPattern size={320} className="text-gold" />
        </div>
        <div className="absolute -bottom-16 -left-16 opacity-[0.07] pointer-events-none">
          <GulPattern size={260} className="text-white" />
        </div>

        <div className="relative container mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <GulPattern size={60} className="text-gold" />
          </div>
          <h1 className="font-heading text-5xl sm:text-6xl font-bold text-primary-foreground mb-5 leading-tight">
            {t("hero_title")}
          </h1>
          <p className="text-lg text-primary-foreground/70 mb-10 max-w-xl mx-auto">
            {t("hero_subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/universities`}
              className="px-8 py-3.5 bg-gold text-white rounded-md font-semibold hover:bg-gold-dark transition-colors shadow-md"
            >
              {t("browse_all")}
            </Link>
            <Link
              href={`/${locale}/transfer`}
              className="px-8 py-3.5 border-2 border-primary-foreground/30 text-primary-foreground rounded-md font-semibold hover:border-gold hover:text-gold transition-colors"
            >
              {t("transfer_guide")}
            </Link>
          </div>
        </div>

        {/* Carpet-stripe bottom border */}
        <div className="h-1.5 w-full flex">
          <div className="flex-1 bg-gold" />
          <div className="flex-1 bg-tk-green" />
          <div className="flex-1 bg-gold" />
          <div className="flex-1 bg-tk-green" />
          <div className="flex-1 bg-gold" />
          <div className="flex-1 bg-tk-green" />
          <div className="flex-1 bg-gold" />
          <div className="flex-1 bg-tk-green" />
        </div>
      </section>

      {/* Floating stats */}
      <section className="container mx-auto px-4 mt-6 sm:mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto sm:-mt-8">
          {[
            { value: universities.length, label: t("stats_universities") },
            { value: countryCount, label: t("stats_countries") },
            { value: moeCount, label: t("stats_moe_approved") },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="bg-card rounded-xl border border-border shadow-card text-center p-4 sm:p-6 border-t-4 border-t-gold"
            >
              <div className="font-heading text-4xl font-bold text-primary">
                {value}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
