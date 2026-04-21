'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, DonutChart, LineChart } from '../../components/charts';
import { LiveIndicator } from '../../components/live-indicator';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { KpiWidget } from '../../components/ui/kpi-widget';
import { SkeletonKpiGrid } from '../../components/ui/skeleton';
import { apiFetch, getToken } from '../../lib/api';
import { formatRoleLabel } from '../../lib/roles';

type DashboardType = 'SALES' | 'SUPPORT' | 'TEAM';
type DateRangePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_7_DAYS'
  | 'THIS_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_60_DAYS'
  | 'LAST_90_DAYS'
  | 'CUSTOM';

type Overview = {
  leadsByStatus: Record<string, number>;
  ticketsByStatus: Record<string, number>;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  revenue: number;
  openTickets: number;
  slaBreaches: number;
  totalTicketsInPeriod: number;
  escalatedTickets: number;
  closedTicketsInPeriod: number;
};

type AgentStat = {
  id: string;
  name: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  department: string;
  leads: number;
  converted: number;
  revenue: number;
  openTickets: number;
  convRate: number;
};

type TeamStat = {
  teamId: string | null;
  teamName: string;
  members: number;
  leads: number;
  converted: number;
  revenue: number;
  openTickets: number;
};

type DashboardData = {
  dashboardType: DashboardType;
  filters: {
    dateRange: DateRangePreset;
    from: string;
    to: string;
    department: 'SALES' | 'SUPPORT' | null;
    teamId: string;
  };
  scopedUsers: number;
  overview: Overview;
  revenueTimeline: { month: string; revenue: number }[];
  leadsTimeline: { date: string; count: number }[];
  ticketsTimeline?: { date: string; count: number }[];
  agentStats: AgentStat[];
  teamStats: TeamStat[];
};

type Team = { id: string; name: string; department: 'SALES' | 'SUPPORT' };

type KpiRow = {
  label: string;
  value: number;
  tone: 'accent' | 'success' | 'warning' | 'danger' | 'default';
  hint: string;
  formatter?: (value: number) => string;
};

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#f59e0b',
  FOLLOW_UP: '#8b5cf6',
  QUALIFIED: '#06b6d4',
  TRIAL: '#6366f1',
  CONVERTED: '#22c55e',
  WON: '#16a34a',
  COLD: '#94a3b8',
  LOST: '#ef4444',
  OPEN: '#3b82f6', IN_PROGRESS: '#f59e0b', ESCALATED: '#ef4444', CLOSED: '#22c55e',
};

const DATE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'THIS_WEEK', label: 'This Week' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_60_DAYS', label: 'Last 60 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
  { value: 'CUSTOM', label: 'Custom' },
];

function toDateInput(d: Date) {
  const x = new Date(d);
  const tz = x.getTimezoneOffset() * 60_000;
  return new Date(x.getTime() - tz).toISOString().slice(0, 10);
}

function windowFromPreset(preset: DateRangePreset) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (preset === 'TODAY') return { from: todayStart, to: todayEnd };
  if (preset === 'YESTERDAY') {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 1);
    const to = new Date(todayEnd);
    to.setDate(to.getDate() - 1);
    return { from, to };
  }
  if (preset === 'THIS_WEEK') {
    const from = new Date(todayStart);
    const day = from.getDay();
    const delta = day === 0 ? 6 : day - 1;
    from.setDate(from.getDate() - delta);
    return { from, to: todayEnd };
  }
  if (preset === 'THIS_MONTH') {
    const from = new Date(todayStart);
    from.setDate(1);
    return { from, to: todayEnd };
  }

  const days =
    preset === 'LAST_7_DAYS'
      ? 7
      : preset === 'LAST_60_DAYS'
        ? 60
        : preset === 'LAST_90_DAYS'
          ? 90
          : 30;
  const from = new Date(todayStart);
  from.setDate(from.getDate() - (days - 1));
  return { from, to: todayEnd };
}

function buildDashboardQuery(p: {
  dashboardType: DashboardType;
  dateRange: DateRangePreset;
  fromDate: string;
  toDate: string;
  department: 'SALES' | 'SUPPORT' | '';
  teamId: string;
}) {
  const q = new URLSearchParams();
  q.set('dashboardType', p.dashboardType);
  q.set('dateRange', p.dateRange);
  q.set('from', p.fromDate);
  q.set('to', p.toDate);
  if (p.department) q.set('department', p.department);
  if (p.teamId && p.teamId !== 'ALL') q.set('teamId', p.teamId);
  return q.toString();
}

export default function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false);
  const skipHydrateFromUrlWrite = useRef(false);
  const loadAbortRef = useRef<AbortController | null>(null);
  const hadSuccessfulLoadRef = useRef(false);

  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dashboardType, setDashboardType] = useState<DashboardType>('SALES');
  const [dateRange, setDateRange] = useState<DateRangePreset>('LAST_30_DAYS');
  const [fromDate, setFromDate] = useState<string>(toDateInput(windowFromPreset('LAST_30_DAYS').from));
  const [toDate, setToDate] = useState<string>(toDateInput(windowFromPreset('LAST_30_DAYS').to));
  const [department, setDepartment] = useState<'SALES' | 'SUPPORT' | ''>('SALES');
  const [teamId, setTeamId] = useState<string>('ALL');

  useEffect(() => {
    if (skipHydrateFromUrlWrite.current) {
      skipHydrateFromUrlWrite.current = false;
      return;
    }
    const dt = searchParams.get('dashboardType');
    if (dt && ['SALES', 'SUPPORT', 'TEAM'].includes(dt)) setDashboardType(dt as DashboardType);

    const dr = searchParams.get('dateRange');
    if (dr && DATE_OPTIONS.some((o) => o.value === dr)) {
      setDateRange(dr as DateRangePreset);
      if (dr !== 'CUSTOM') {
        const w = windowFromPreset(dr as DateRangePreset);
        setFromDate(toDateInput(w.from));
        setToDate(toDateInput(w.to));
      }
    }

    if (searchParams.has('from')) {
      const from = searchParams.get('from');
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) setFromDate(from);
    }
    if (searchParams.has('to')) {
      const to = searchParams.get('to');
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) setToDate(to);
    }

    if (searchParams.has('department')) {
      const dep = searchParams.get('department');
      if (dep === 'SALES' || dep === 'SUPPORT') setDepartment(dep);
      else if (dep === '') setDepartment('');
    }

    if (searchParams.has('teamId')) {
      const tm = searchParams.get('teamId');
      if (tm) setTeamId(tm);
    }

    setHydratedFromUrl(true);
  }, [searchParams]);

  useEffect(() => {
    if (!hydratedFromUrl) return;
    const next = buildDashboardQuery({
      dashboardType,
      dateRange,
      fromDate,
      toDate,
      department,
      teamId,
    });
    const cur = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
    if (next === cur) return;
    const t = window.setTimeout(() => {
      skipHydrateFromUrlWrite.current = true;
      router.replace(`${pathname}?${next}`, { scroll: false });
    }, 280);
    return () => window.clearTimeout(t);
  }, [
    hydratedFromUrl,
    dashboardType,
    dateRange,
    fromDate,
    toDate,
    department,
    teamId,
    pathname,
    router,
  ]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setErr('Sign in to load live metrics.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    setErr(null);
    if (!hadSuccessfulLoadRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({
        dashboardType,
        dateRange,
        from: `${fromDate}T00:00:00.000Z`,
        to: `${toDate}T23:59:59.999Z`,
      });
      if (department) params.set('department', department);
      if (teamId && teamId !== 'ALL') params.set('teamId', teamId);
      const signal = ac.signal;
      const [dashboard, teamRows] = await Promise.all([
        apiFetch<DashboardData>(`/reports/dashboard?${params.toString()}`, { signal }),
        apiFetch<Team[]>(department ? `/teams?department=${department}` : '/teams', { signal }),
      ]);
      if (signal.aborted) return;
      setData(dashboard);
      setTeams(teamRows);
      hadSuccessfulLoadRef.current = true;
    } catch (e) {
      const aborted =
        (typeof e === 'object' &&
          e !== null &&
          'name' in e &&
          (e as { name: string }).name === 'AbortError') ||
        (e instanceof DOMException && e.name === 'AbortError');
      if (aborted) return;
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [dashboardType, dateRange, fromDate, toDate, department, teamId]);

  useEffect(() => { void load(); }, [load]);

  function applyPreset(preset: DateRangePreset) {
    setDateRange(preset);
    if (preset === 'CUSTOM') return;
    const w = windowFromPreset(preset);
    setFromDate(toDateInput(w.from));
    setToDate(toDateInput(w.to));
  }

  function setBoard(type: DashboardType) {
    setDashboardType(type);
    setTeamId('ALL');
    if (type === 'SALES') setDepartment('SALES');
    else if (type === 'SUPPORT') setDepartment('SUPPORT');
    else if (type === 'TEAM') setDepartment('');
  }

  const ov = data?.overview;

  const kpis: KpiRow[] = useMemo(() => {
    if (!ov) return [];
    const totalTickets = ov.totalTicketsInPeriod ?? Object.values(ov.ticketsByStatus).reduce((a, b) => a + b, 0);
    const escalated = ov.escalatedTickets ?? ov.ticketsByStatus['ESCALATED'] ?? 0;
    const closedT = ov.closedTicketsInPeriod ?? ov.ticketsByStatus['CLOSED'] ?? 0;
    const teamCount = data?.teamStats?.length ?? 0;
    const memberCount = data?.scopedUsers ?? 0;

    if (dashboardType === 'SUPPORT') {
      return [
        { label: 'New tickets', value: totalTickets, tone: 'accent' as const, hint: 'Created in selected period' },
        { label: 'Open / active', value: ov.openTickets, tone: 'warning' as const, hint: 'Open, in progress, escalated' },
        { label: 'Escalated', value: escalated, tone: escalated > 0 ? ('danger' as const) : ('default' as const), hint: 'Needs senior attention' },
        { label: 'SLA breaches', value: ov.slaBreaches, tone: ov.slaBreaches > 0 ? ('danger' as const) : ('default' as const), hint: 'Past SLA, not closed' },
        { label: 'Closed', value: closedT, tone: 'success' as const, hint: 'Resolved in period' },
      ];
    }
    if (dashboardType === 'TEAM') {
      return [
        { label: 'Teams', value: teamCount, tone: 'accent' as const, hint: 'With activity in filters' },
        { label: 'Members in scope', value: memberCount, tone: 'default' as const, hint: 'Users matching filters' },
        { label: 'Total leads', value: ov.totalLeads, tone: 'accent' as const, hint: 'Leads in period' },
        {
          label: 'Revenue',
          value: ov.revenue,
          tone: 'success' as const,
          hint: 'Sales in period',
          formatter: (value: number) => `₹${value.toLocaleString()}`,
        },
      ];
    }
    return [
      { label: 'Total leads', value: ov.totalLeads, tone: 'accent' as const, hint: 'Created in selected period' },
      { label: 'Won / converted', value: ov.convertedLeads, tone: 'success' as const, hint: 'Converted or won in period' },
      { label: 'Open tickets', value: ov.openTickets, tone: 'warning' as const, hint: 'Still open (created in period)' },
      { label: 'SLA breaches', value: ov.slaBreaches, tone: ov.slaBreaches > 0 ? ('danger' as const) : ('default' as const), hint: 'Past SLA, not closed' },
    ];
  }, [ov, dashboardType, data?.teamStats?.length, data?.scopedUsers]);

  return (
    <CrmShell
      title="Command Center"
      subtitle="Sales, Support, and Team dashboards with advanced filters."
      actions={(
        <>
          <div className="mr-1 hidden md:block">
            <LiveIndicator onEvent={() => void load()} />
          </div>
          <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
        </>
      )}
    >
      {err ? (
        <Card className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
          {err} <Link href="/login" className="font-semibold text-brand underline">Login</Link>
        </Card>
      ) : null}

      {loading ? (
        <SkeletonKpiGrid />
      ) : data ? (
        <div className="space-y-6">
          {refreshing ? (
            <div aria-live="polite" className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Updating metrics…
            </div>
          ) : null}
          <FadeUp>
            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(['SALES', 'SUPPORT', 'TEAM'] as DashboardType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBoard(type)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      dashboardType === type ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'SALES' ? 'Sales Dashboard' : type === 'SUPPORT' ? 'Support Dashboard' : 'Team Dashboard'}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Select Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => applyPreset(e.target.value as DateRangePreset)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {DATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setDateRange('CUSTOM');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setDateRange('CUSTOM');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
                  <select
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value as 'SALES' | 'SUPPORT' | '');
                      setTeamId('ALL');
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="SALES">Sales</option>
                    <option value="SUPPORT">Support</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Team</label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Active window: {data.filters.from} to {data.filters.to} · Scoped users: {data.scopedUsers}
                </p>
                <Button variant="secondary" onClick={() => void load()}>Apply Filters</Button>
              </div>
            </Card>
          </FadeUp>

          <FadeUp>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((k) => (
                <KpiWidget
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  tone={k.tone}
                  hint={k.hint}
                  formatter={k.formatter}
                />
              ))}
              {dashboardType === 'SALES' && ov ? (
                <>
                  <KpiWidget
                    label="Conversion rate"
                    value={Math.round((ov.conversionRate ?? 0) * 1000) / 10}
                    tone="accent"
                    hint="Efficiency of qualified leads"
                    formatter={(value) => `${value}%`}
                  />
                  <KpiWidget
                    label="Revenue"
                    value={ov.revenue ?? 0}
                    tone="success"
                    hint="Tracked this cycle"
                    formatter={(value) => `₹${value.toLocaleString()}`}
                  />
                </>
              ) : null}
            </section>
          </FadeUp>

          <FadeUp delay={0.06}>
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <h2 className="mb-4 text-xl font-semibold">
                  {dashboardType === 'SUPPORT'
                    ? 'Ticket volume (daily)'
                    : dashboardType === 'TEAM'
                      ? 'Revenue (daily)'
                      : 'Revenue momentum'}
                </h2>
                {dashboardType === 'SUPPORT' ? (
                  <BarChart
                    data={(data.ticketsTimeline ?? []).map((r) => ({ label: r.date, value: r.count }))}
                    unit=""
                    color="#0ea5e9"
                  />
                ) : (
                  <BarChart data={data.revenueTimeline.map((r) => ({ label: r.month, value: r.revenue }))} unit="₹" color="#4f8cff" />
                )}
              </Card>
              <Card>
                <h2 className="mb-4 text-xl font-semibold">
                  {dashboardType === 'SUPPORT' ? 'Ticket trend' : 'Lead velocity'}
                </h2>
                {dashboardType === 'SUPPORT' ? (
                  <LineChart
                    data={(data.ticketsTimeline ?? []).map((d) => ({ label: d.date, value: d.count }))}
                    color="#0ea5e9"
                  />
                ) : (
                  <LineChart data={data.leadsTimeline.map((d) => ({ label: d.date, value: d.count }))} color="#4f8cff" />
                )}
              </Card>
            </section>
          </FadeUp>

          <FadeUp delay={0.1}>
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <h2 className="mb-4 text-xl font-semibold">Leads by status</h2>
                <DonutChart slices={Object.entries(ov!.leadsByStatus).map(([k, v]) => ({ label: k, value: v, color: STATUS_COLORS[k] ?? '#94a3b8' }))} />
              </Card>
              <Card>
                <h2 className="mb-4 text-xl font-semibold">Tickets by status</h2>
                <DonutChart slices={Object.entries(ov!.ticketsByStatus).map(([k, v]) => ({ label: k, value: v, color: STATUS_COLORS[k] ?? '#94a3b8' }))} />
              </Card>
            </section>
          </FadeUp>

          {dashboardType !== 'TEAM' && data.agentStats.length > 0 ? (
            <FadeUp delay={0.14}>
              <section>
                <h2 className="mb-3 text-2xl font-semibold">Team performance</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[...data.agentStats]
                    .sort((a, b) =>
                      dashboardType === 'SUPPORT' ? b.openTickets - a.openTickets : b.revenue - a.revenue,
                    )
                    .map((agent, index) => (
                    <Card key={agent.id} interactive className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">#{index + 1} {formatRoleLabel(agent.role, agent.department)}</p>
                          <h3 className="text-lg font-semibold">{agent.name}</h3>
                        </div>
                        <p className="rounded-full bg-brand-muted px-3 py-1 text-xs font-medium text-brand">
                          {agent.convRate}% conversion
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Leads</p>
                          <p className="mt-1 font-semibold tabular-nums">{agent.leads}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Closed</p>
                          <p className="mt-1 font-semibold tabular-nums text-emerald-600">{agent.converted}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Open tickets</p>
                          <p className="mt-1 font-semibold tabular-nums">{agent.openTickets}</p>
                        </div>
                      </div>
                      <p className="text-base font-semibold text-ink">₹{agent.revenue.toLocaleString()}</p>
                    </Card>
                  ))}
                </div>
              </section>
            </FadeUp>
          ) : null}

          {dashboardType === 'TEAM' ? (
            <FadeUp delay={0.14}>
              <section>
                <h2 className="mb-3 text-2xl font-semibold">Team Dashboard</h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.teamStats.map((team) => (
                    <Card key={`${team.teamId ?? 'NA'}-${team.teamName}`} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{team.teamName}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{team.members} members</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-slate-50 p-2">Leads: <b>{team.leads}</b></div>
                        <div className="rounded-lg bg-slate-50 p-2">Converted: <b>{team.converted}</b></div>
                        <div className="rounded-lg bg-slate-50 p-2">Open tickets: <b>{team.openTickets}</b></div>
                        <div className="rounded-lg bg-slate-50 p-2">Revenue: <b>₹{team.revenue.toLocaleString()}</b></div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            </FadeUp>
          ) : null}
        </div>
      ) : null}
    </CrmShell>
  );
}
