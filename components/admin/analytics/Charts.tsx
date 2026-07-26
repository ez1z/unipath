'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { DailyVisit, MonthlyVisit, LocaleSplit, DailyCount, SignupDaily, PeakHour } from '@/lib/analytics/queries';

const PRIMARY = '#691C22';
const GOLD = '#C49A1E';
const GREEN = '#1A6344';
const AXIS = '#7A6E66';
const GRID = '#ECE7E1';
const PIE_COLORS = [PRIMARY, GOLD, GREEN, '#8B1A1A', '#B08968'];

// 'YYYY-MM-DD' (or ISO) → 'dd.MM' per the project date convention.
function dayLabel(value: string): string {
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(value: string): string {
  return new Date(value).toLocaleDateString('en', { month: 'short' });
}

const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false } as const;
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #E5E1DB', fontSize: 12 },
  labelStyle: { color: '#1c1917', fontWeight: 600 },
};

export function VisitsTrendChart({ data }: { data: DailyVisit[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.25} />
            <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => dayLabel(String(v))} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="visits" name="Visits" stroke={PRIMARY} strokeWidth={2} fill="url(#visitsFill)" />
        <Area type="monotone" dataKey="visitors" name="Unique visitors" stroke={GOLD} strokeWidth={2} fillOpacity={0} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MonthlyVisitsChart({ data }: { data: MonthlyVisit[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => monthLabel(String(v))} cursor={{ fill: 'rgba(105,28,34,0.05)' }} />
        <Bar dataKey="visits" name="Visits" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LocaleDonut({ data }: { data: LocaleSplit[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="visits"
          nameKey="locale"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((entry, i) => (
            <Cell key={entry.locale} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(v) => String(v).toUpperCase()} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AiTrendChart({ data }: { data: DailyCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => dayLabel(String(v))} cursor={{ fill: 'rgba(196,154,30,0.08)' }} />
        <Bar dataKey="count" name="Questions" fill={GOLD} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PeakHoursChart({ data }: { data: PeakHour[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} interval={2} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(h) => `${h}:00`} cursor={{ fill: 'rgba(105,28,34,0.05)' }} />
        <Bar dataKey="visits" name="Visits" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SignupsTrendChart({ data }: { data: SignupDaily[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} width={32} />
        <Tooltip {...tooltipStyle} labelFormatter={(v) => dayLabel(String(v))} cursor={{ fill: 'rgba(26,99,68,0.08)' }} />
        <Bar dataKey="signups" name="Signups" fill={GREEN} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
