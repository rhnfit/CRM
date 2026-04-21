'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { KpiWidget } from '../../components/ui/kpi-widget';
import { apiFetch, getToken } from '../../lib/api';

type Overview = {
  totalLeads: number;
  revenue: number;
  conversionRate: number;
  openTickets: number;
  slaBreaches: number;
  totalTicketsInPeriod?: number;
  escalatedTickets?: number;
  closedTicketsInPeriod?: number;
};

type Comparison = {
  current: Overview;
  previous: Overview;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  deltas: {
    revenuePct: number | null;
    leadsPct: number | null;
    conversionRatePts: number;
    ticketsPct: number | null;
    slaBreachesDelta: number;
  } | null;
};

const PRESETS = [
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_90_DAYS', label: 'Last 90 days' },
] as const;

function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function fmtPts(v: number) {
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)} pts`;
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [dateRange, setDateRange] = useState<string>('LAST_30_DAYS');
  const [department, setDepartment] = useState<string>('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [computeMsg, setComputeMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set('dateRange', dateRange);
    if (department === 'SALES' || department === 'SUPPORT') q.set('department', department);
    return q.toString();
  }, [dateRange, department]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setErr('Login required.');
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const [ov, cmp] = await Promise.all([
        apiFetch<Overview>(`/reports/overview?${query}`),
        apiFetch<Comparison>(`/reports/comparison?${query}`),
      ]);
      setOverview(ov);
      setComparison(cmp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runIncentives() {
    setComputeMsg(null);
    try {
      const res = await apiFetch<{ count: number }>('/incentives/compute', {
        method: 'POST',
        json: { month },
      });
      setComputeMsg(`Updated ${res.count} incentive row(s) for ${month}.`);
    } catch (e) {
      setComputeMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

  const d = comparison?.deltas;

  return (
    <CrmShell
      title="Reports"
      subtitle="Filters apply to KPIs; comparison uses the previous window of equal length (Owners, Heads, and scoped admins see their hierarchy)."
      actions={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Period
              <select
                className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none ring-brand/20 focus:ring"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Department
              <select
                className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none ring-brand/20 focus:ring"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All (my scope)</option>
                <option value="SALES">Sales</option>
                <option value="SUPPORT">Support</option>
              </select>
            </label>
            <Button variant="secondary" onClick={() => void load()}>Apply</Button>
          </div>
          {comparison ? (
            <p className="mt-3 text-xs text-slate-500">
              Current: {new Date(comparison.period.from).toLocaleDateString()} – {new Date(comparison.period.to).toLocaleDateString()}
              {' · '}
              vs prior: {new Date(comparison.previousPeriod.from).toLocaleDateString()} – {new Date(comparison.previousPeriod.to).toLocaleDateString()}
            </p>
          ) : null}
        </Card>
      </FadeUp>

      {loading ? null : overview ? (
        <FadeUp>
          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiWidget label="Total leads" value={overview.totalLeads} tone="accent" />
            <KpiWidget label="Revenue" value={overview.revenue} tone="success" formatter={(value) => `₹${value.toLocaleString()}`} />
            <KpiWidget label="Conversion rate" value={Math.round(overview.conversionRate * 1000) / 10} tone="accent" formatter={(value) => `${value}%`} />
            <KpiWidget label="Open tickets" value={overview.openTickets} tone="warning" />
            <KpiWidget label="SLA breaches" value={overview.slaBreaches} tone={overview.slaBreaches > 0 ? 'danger' : 'default'} />
          </section>
        </FadeUp>
      ) : null}

      {!loading && d ? (
        <FadeUp delay={0.06}>
          <Card className="mb-8 p-5">
            <h2 className="text-lg font-semibold text-ink">Period-over-period</h2>
            <p className="mt-1 text-sm text-slate-600">Same filters; previous window is immediately before the selected range.</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Revenue vs prior</dt>
                <dd className="font-semibold text-ink">{fmtPct(d.revenuePct)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Leads vs prior</dt>
                <dd className="font-semibold text-ink">{fmtPct(d.leadsPct)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Conversion rate (Δ)</dt>
                <dd className="font-semibold text-ink">{fmtPts(d.conversionRatePts)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">Tickets in period vs prior</dt>
                <dd className="font-semibold text-ink">{fmtPct(d.ticketsPct)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">SLA breaches (Δ count)</dt>
                <dd className="font-semibold text-ink">{d.slaBreachesDelta > 0 ? '+' : ''}{d.slaBreachesDelta}</dd>
              </div>
            </dl>
          </Card>
        </FadeUp>
      ) : null}

      <FadeUp delay={0.08}>
        <Card className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-ink">Compute incentives</h2>
          <p className="mt-2 text-sm text-slate-600">
            Uses <code className="rounded bg-slate-100 px-1.5 py-0.5">INCENTIVE_PERCENT</code> from the API
            environment (default 5%).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className="min-w-[180px] flex-1 rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
              value={month}
              onChange={(ev) => setMonth(ev.target.value)}
              placeholder="YYYY-MM"
            />
            <Button onClick={() => void runIncentives()}>Run</Button>
          </div>
          {computeMsg ? <p className="mt-3 text-sm text-slate-700">{computeMsg}</p> : null}
        </Card>
      </FadeUp>
    </CrmShell>
  );
}
