import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { requireSuperuser } from '@/lib/admin/auth';
import { loadAnalytics } from '@/lib/analytics/queries';
import { KpiCard } from '@/components/admin/analytics/KpiCard';
import { BarList } from '@/components/admin/analytics/BarList';
import { TopEntityTable } from '@/components/admin/analytics/TopEntityTable';
import { RangeTabs } from '@/components/admin/analytics/RangeTabs';
import {
  VisitsTrendChart,
  MonthlyVisitsChart,
  LocaleDonut,
  AiTrendChart,
  SignupsTrendChart,
} from '@/components/admin/analytics/Charts';

export const metadata = { title: 'Analytics — UniPath Admin' };
export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = [7, 30, 90];

type Props = { searchParams: { days?: string } };

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h2 className="font-heading font-bold text-base text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { user } = await requireSuperuser();

  const parsed = Number(searchParams.days);
  const days = ALLOWED_DAYS.includes(parsed) ? parsed : 30;

  const a = await loadAnalytics(days);
  const { summary: s, engagement: eng } = a;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Dashboard
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-1">Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visitor activity, top content, and engagement over the last {days} days.
            </p>
          </div>
          <RangeTabs days={days} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total users" value={s.total_users} hint={`+${s.new_users_30d} in 30d`} accent="primary" />
          <KpiCard label="MAU" value={s.mau} hint="Unique visitors, 30d" accent="gold" />
          <KpiCard label="DAU" value={s.dau} hint="Unique visitors today" accent="tk-green" />
          <KpiCard label="Visits today" value={s.visits_today} hint={`${s.visits_30d} in 30d`} accent="amber-400" />
          <KpiCard label="New users (7d)" value={s.new_users_7d} accent="slate-400" />
          <KpiCard label="New users (30d)" value={s.new_users_30d} accent="slate-400" />
          <KpiCard label="Conversion" value={`${s.conversion_rate}%`} hint="Signups ÷ visitors, 30d" accent="primary" />
          <KpiCard label="Pages / visitor" value={eng.avg_events_per_visitor} hint={`${days}d average`} accent="gold" />
        </div>

        {/* Visits + locale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div className="lg:col-span-2">
            <Section title="Daily visits" subtitle="Pageviews and unique visitors (DAU)">
              <VisitsTrendChart data={a.visitsDaily} />
            </Section>
          </div>
          <Section title="Traffic by language" subtitle="Pageviews per locale">
            <LocaleDonut data={a.localeSplit} />
          </Section>
        </div>

        {/* Monthly + signups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <Section title="Monthly visits" subtitle="Last 12 months">
            <MonthlyVisitsChart data={a.visitsMonthly} />
          </Section>
          <Section title="New signups" subtitle="Conversion trend">
            <SignupsTrendChart data={a.signupsDaily} />
          </Section>
        </div>

        {/* Top entities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <Section title="Most viewed universities">
            <TopEntityTable
              editPrefix="/admin/universities"
              rows={a.topUniversities.map((u) => ({
                id: u.entity_id,
                name: u.name_en,
                views: u.views,
                country: u.country,
                moeApproved: u.moe_approved,
              }))}
            />
          </Section>
          <Section title="Most viewed scholarships">
            <TopEntityTable
              editPrefix="/admin/scholarships"
              rows={a.topScholarships.map((sc) => ({
                id: sc.entity_id,
                name: sc.name_en,
                views: sc.views,
              }))}
            />
          </Section>
        </div>

        {/* Searches / countries / referrers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <Section title="Top searches" subtitle="What students look for">
            <BarList
              rows={a.topSearches.map((r) => ({ label: r.search_query, value: r.count }))}
              emptyText="No searches yet."
            />
          </Section>
          <Section title="Country interest" subtitle="Views by destination">
            <BarList
              rows={a.topCountries.map((r) => ({ label: r.country, value: r.views }))}
              barClass="bg-tk-green/15"
              emptyText="No views yet."
            />
          </Section>
          <Section title="Top referrers" subtitle="Where traffic comes from">
            <BarList
              rows={a.topReferrers.map((r) => ({ label: r.referrer, value: r.count }))}
              barClass="bg-gold/20"
              emptyText="No external referrers yet."
            />
          </Section>
        </div>

        {/* AI questions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <Section title="AI questions per day" subtitle="Assistant usage">
            <AiTrendChart data={a.aiDaily} />
          </Section>
          <Section title="Recent AI questions">
            {a.recentAiQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No questions yet.</p>
            ) : (
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {a.recentAiQuestions.map((q, i) => (
                  <li key={i} className="text-sm border-b border-border pb-2 last:border-0">
                    <p className="text-foreground line-clamp-2">{q.ai_question}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(q.locale ?? '—').toUpperCase()} · {formatDate(q.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Engagement */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="New visitors" value={eng.new_visitors} hint={`First seen in ${days}d`} accent="tk-green" />
          <KpiCard label="Returning visitors" value={eng.returning_visitors} hint="Seen before window" accent="primary" />
          <KpiCard label="Active visitors (MAU)" value={s.mau} accent="gold" />
          <KpiCard label="Pages / visitor" value={eng.avg_events_per_visitor} accent="slate-400" />
        </div>
      </main>
    </div>
  );
}
