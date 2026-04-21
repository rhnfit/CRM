'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/card';
import { KpiWidget } from '../../components/ui/kpi-widget';
import { apiFetch } from '../../lib/api';

type Stats = { users: number; teams: number; leads: number; tickets: number };
type ServiceHealth = { healthy: boolean; status: string };
type Health = {
  status: string;
  redis: ServiceHealth;
  db: ServiceHealth;
  queue: ServiceHealth;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, h] = await Promise.all([
          apiFetch<Stats>('/admin/stats'),
          apiFetch<Health>('/health'),
        ]);
        if (!cancelled) {
          setStats(s);
          setHealth(h);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stats');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!stats) {
    return <p className="text-slate-600">Loading overview…</p>;
  }

  const cards = [
    { label: 'Users (in scope)', value: stats.users },
    { label: 'Teams', value: stats.teams },
    { label: 'Leads (assignee in scope)', value: stats.leads },
    { label: 'Tickets (assignee in scope)', value: stats.tickets },
  ];

  return (
    <div>
      <h1 className="mb-2 text-4xl font-semibold text-ink">Overview</h1>
      <p className="mb-8 max-w-2xl text-slate-500">
        Counts respect your role: Directors see everything; Managers and Heads see their
        department only.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <KpiWidget key={c.label} label={c.label} value={c.value} tone="accent" />
        ))}
      </div>
      {health ? (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">System Health</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Redis', value: health.redis.status },
              { label: 'Database', value: health.db.status },
              { label: 'Queues', value: health.queue.status },
            ].map((h) => (
              <div
                key={h.label}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  h.value === 'UP'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <p className="font-semibold">{h.label}</p>
                <p>{h.value}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <Card className="mt-6">
        <p className="text-sm text-slate-600">Use the left navigation to manage users, teams, and audit records in your scope.</p>
      </Card>
    </div>
  );
}
