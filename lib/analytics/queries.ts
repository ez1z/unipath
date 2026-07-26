import { createServiceClient } from '@/lib/supabase/service';

export type AnalyticsSummary = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  dau: number;
  mau: number;
  visits_today: number;
  visits_30d: number;
  conversion_rate: number;
};
export type DailyVisit = { day: string; visits: number; visitors: number };
export type MonthlyVisit = { month: string; visits: number; visitors: number };
export type TopUniversity = {
  entity_id: string;
  entity_slug: string;
  name_en: string;
  country: string;
  moe_approved: boolean;
  views: number;
};
export type TopScholarship = { entity_id: string; entity_slug: string; name_en: string; views: number };
export type TopSearch = { search_query: string; count: number };
export type AiQuestion = { ai_question: string; locale: string | null; created_at: string };
export type DailyCount = { day: string; count: number };
export type TopCountry = { country: string; views: number };
export type TopCity = { city: string; country: string; views: number };
export type PeakHour = { hour: number; visits: number };
export type DeviceSplit = { device: string; visits: number };
export type LocaleSplit = { locale: string; visits: number };
export type TopReferrer = { referrer: string; count: number };
export type Engagement = {
  new_visitors: number;
  returning_visitors: number;
  avg_events_per_visitor: number;
};
export type SignupDaily = { day: string; signups: number };

export type AnalyticsData = {
  summary: AnalyticsSummary;
  visitsDaily: DailyVisit[];
  visitsMonthly: MonthlyVisit[];
  topUniversities: TopUniversity[];
  topScholarships: TopScholarship[];
  topSearches: TopSearch[];
  recentAiQuestions: AiQuestion[];
  aiDaily: DailyCount[];
  topCountries: TopCountry[];
  topCities: TopCity[];
  peakHours: PeakHour[];
  deviceSplit: DeviceSplit[];
  localeSplit: LocaleSplit[];
  topReferrers: TopReferrer[];
  engagement: Engagement;
  signupsDaily: SignupDaily[];
};

const EMPTY_SUMMARY: AnalyticsSummary = {
  total_users: 0,
  new_users_7d: 0,
  new_users_30d: 0,
  dau: 0,
  mau: 0,
  visits_today: 0,
  visits_30d: 0,
  conversion_rate: 0,
};

const EMPTY_ENGAGEMENT: Engagement = {
  new_visitors: 0,
  returning_visitors: 0,
  avg_events_per_visitor: 0,
};

// Runs every aggregation RPC in parallel via the service-role client (bypasses RLS).
export async function loadAnalytics(days: number): Promise<AnalyticsData> {
  const s = createServiceClient();

  const [
    summary,
    visitsDaily,
    visitsMonthly,
    topUniversities,
    topScholarships,
    topSearches,
    recentAiQuestions,
    aiDaily,
    topCountries,
    topCities,
    peakHours,
    deviceSplit,
    localeSplit,
    topReferrers,
    engagement,
    signupsDaily,
  ] = await Promise.all([
    s.rpc('analytics_summary'),
    s.rpc('analytics_visits_daily', { p_days: days }),
    s.rpc('analytics_visits_monthly', { p_months: 12 }),
    s.rpc('analytics_top_universities', { p_days: days, p_limit: 10 }),
    s.rpc('analytics_top_scholarships', { p_days: days, p_limit: 10 }),
    s.rpc('analytics_top_searches', { p_days: days, p_limit: 15 }),
    s.rpc('analytics_recent_ai_questions', { p_limit: 30 }),
    s.rpc('analytics_ai_daily', { p_days: days }),
    s.rpc('analytics_top_countries', { p_days: days, p_limit: 12 }),
    s.rpc('analytics_top_cities', { p_days: days, p_limit: 12 }),
    s.rpc('analytics_peak_hours', { p_days: days }),
    s.rpc('analytics_device_split', { p_days: days }),
    s.rpc('analytics_locale_split', { p_days: days }),
    s.rpc('analytics_top_referrers', { p_days: days, p_limit: 10 }),
    s.rpc('analytics_engagement', { p_days: days }),
    s.rpc('analytics_signups_daily', { p_days: days }),
  ]);

  return {
    summary: (summary.data as AnalyticsSummary) ?? EMPTY_SUMMARY,
    visitsDaily: (visitsDaily.data as DailyVisit[]) ?? [],
    visitsMonthly: (visitsMonthly.data as MonthlyVisit[]) ?? [],
    topUniversities: (topUniversities.data as TopUniversity[]) ?? [],
    topScholarships: (topScholarships.data as TopScholarship[]) ?? [],
    topSearches: (topSearches.data as TopSearch[]) ?? [],
    recentAiQuestions: (recentAiQuestions.data as AiQuestion[]) ?? [],
    aiDaily: (aiDaily.data as DailyCount[]) ?? [],
    topCountries: (topCountries.data as TopCountry[]) ?? [],
    topCities: (topCities.data as TopCity[]) ?? [],
    peakHours: (peakHours.data as PeakHour[]) ?? [],
    deviceSplit: (deviceSplit.data as DeviceSplit[]) ?? [],
    localeSplit: (localeSplit.data as LocaleSplit[]) ?? [],
    topReferrers: (topReferrers.data as TopReferrer[]) ?? [],
    engagement: (engagement.data as Engagement) ?? EMPTY_ENGAGEMENT,
    signupsDaily: (signupsDaily.data as SignupDaily[]) ?? [],
  };
}

// Most-viewed university/scholarship ids for the public home page. Uses the same
// service-role RPCs (server-only). Order is preserved; callers fall back to
// featured content when analytics is still sparse.
export async function loadPopularIds(
  limit = 3,
): Promise<{ universityIds: string[]; scholarshipIds: string[] }> {
  const s = createServiceClient();
  const [u, sc] = await Promise.all([
    s.rpc('analytics_top_universities', { p_days: 90, p_limit: limit }),
    s.rpc('analytics_top_scholarships', { p_days: 90, p_limit: limit }),
  ]);
  return {
    universityIds: ((u.data as { entity_id: string }[]) ?? []).map((r) => r.entity_id),
    scholarshipIds: ((sc.data as { entity_id: string }[]) ?? []).map((r) => r.entity_id),
  };
}
