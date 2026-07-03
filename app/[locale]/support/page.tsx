import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { FaqAccordion } from "@/components/support/FaqAccordion";
import { canonicalFor, localeAlternates, jsonLdScript } from "@/lib/seo";
import type { Locale } from "@/lib/constants";

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('support_title'),
    description: t('support_description'),
    alternates: {
      canonical: canonicalFor(locale, '/support'),
      languages: localeAlternates('/support'),
    },
  };
}

export default function SupportPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = useTranslations("support");

  const faqItems = [
    { question: t("faq_what_title"), answer: t("faq_what_body") },
    { question: t("faq_moe_title"), answer: t("faq_moe_body") },
    { question: t("faq_cap_title"), answer: t("faq_cap_body") },
    { question: t("faq_payment_title"), answer: t("faq_payment_body") },
    { question: t("faq_tracker_title"), answer: t("faq_tracker_body") },
    { question: t("faq_compare_title"), answer: t("faq_compare_body") },
    { question: t("faq_language_title"), answer: t("faq_language_body") },
    { question: t("faq_contact_title"), answer: t("faq_contact_body") },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }}
      />
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* About section */}
        <section className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-10">
          <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center gap-3">
            <div className="w-1 h-8 bg-gold rounded-full" />
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {t("about_title")}
            </h2>
          </div>
          <div className="px-6 py-5">
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {t("about_desc")}
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gold/20 bg-gold/5 px-4 py-3">
                <p className="font-semibold text-sm text-foreground mb-1">
                  {t("about_free")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("about_free_desc")}
                </p>
              </div>
              <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
                <p className="font-semibold text-sm text-foreground mb-1">
                  {t("about_guide_only")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("about_guide_only_desc")}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="font-semibold text-sm text-foreground mb-1">
                  {t("about_moe")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("about_moe_desc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ section */}
        <section className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-10">
          <div className="bg-primary/5 border-b border-border px-6 py-4 flex items-center gap-3">
            <div className="w-1 h-8 bg-gold rounded-full" />
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {t("faq_title")}
            </h2>
          </div>
          <FaqAccordion items={faqItems} />
        </section>

        {/* Contact section */}
        <section className="bg-card rounded-xl border border-border shadow-card overflow-hidden mb-10">
          <div className="px-6 py-8 text-center">
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
              {t("contact_title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {t("contact_desc")}
            </p>
            <a
              href="mailto:unipathtm@gmail.com"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-primary font-semibold text-sm rounded-lg hover:bg-gold/90 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="2,4 12,13 22,4" />
              </svg>
              {t("contact_email")}
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
