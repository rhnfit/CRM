'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function ReportsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [computeMsg, setComputeMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      setErr('Login required.');
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      setOverview(await apiFetch<Overview>('/reports/overview'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <CrmShell
      title="Reports & Incentives"
      subtitle="High-level business health plus one-click monthly incentive computation."
      actions={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

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
