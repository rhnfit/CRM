'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { KpiWidget } from '../../components/ui/kpi-widget';
import { SkeletonBlock } from '../../components/ui/skeleton';
import { apiFetch, getToken } from '../../lib/api';

type Target = {
  id: string;
  userId: string;
  month: string;
  targetAmount: number;
  achievedAmount: number;
  user: { id: string; name: string; email: string };
};

type Assignable = { id: string; name: string };

export default function TargetsPage() {
  const [rows, setRows] = useState<Target[]>([]);
  const [assignable, setAssignable] = useState<Assignable[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [targetAmount, setTargetAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      setErr('Login required.');
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const [t, a] = await Promise.all([
        apiFetch<Target[]>('/targets'),
        apiFetch<Assignable[]>('/users/assignable'),
      ]);
      setRows(t);
      setAssignable(a);
      if (!userId && a.length) setUserId(a[0].id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await apiFetch('/targets', {
        method: 'POST',
        json: { userId, month, targetAmount: Number(targetAmount) },
      });
      setTargetAmount('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const totalTarget = rows.reduce((sum, row) => sum + Number(row.targetAmount), 0);
  const totalAchieved = rows.reduce((sum, row) => sum + Number(row.achievedAmount), 0);
  const avgProgress = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;

  return (
    <CrmShell
      title="Targets"
      subtitle="Set monthly revenue goals, monitor progress, and keep teams aligned around outcomes."
      actions={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiWidget label="Total goals" value={rows.length} tone="accent" hint="Monthly entries in scope" />
          <KpiWidget label="Target amount" value={totalTarget} tone="accent" formatter={(value) => `₹${value.toLocaleString()}`} />
          <KpiWidget label="Achieved amount" value={totalAchieved} tone="success" formatter={(value) => `₹${value.toLocaleString()}`} />
          <KpiWidget label="Overall progress" value={avgProgress} tone={avgProgress >= 75 ? 'success' : 'warning'} formatter={(value) => `${value}%`} />
        </section>
      </FadeUp>

      <FadeUp delay={0.05}>
        <Card className="mb-6">
          <h2 className="text-xl font-semibold">Set monthly target</h2>
          <form onSubmit={onSave} className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">User</span>
              <select
                value={userId}
                onChange={(ev) => setUserId(ev.target.value)}
                className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
              >
                {assignable.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Month</span>
              <input
                value={month}
                onChange={(ev) => setMonth(ev.target.value)}
                placeholder="YYYY-MM"
                className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Target (₹)</span>
              <input
                value={targetAmount}
                onChange={(ev) => setTargetAmount(ev.target.value)}
                type="number"
                min={0}
                className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
                required
              />
            </label>
            <div className="sm:col-span-4 pt-1">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save target'}</Button>
            </div>
          </form>
        </Card>
      </FadeUp>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="mt-3 h-7 w-40" />
              <SkeletonBlock className="mt-3 h-4 w-28" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row, index) => {
            const pct = row.targetAmount > 0 ? Math.min(100, Math.round((row.achievedAmount / row.targetAmount) * 100)) : 0;
            return (
              <FadeUp key={row.id} delay={Math.min(index * 0.04, 0.2)}>
                <Card interactive>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500">{row.month}</p>
                      <h3 className="mt-1 text-xl font-semibold text-ink">{row.user.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{row.user.email}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="mt-1 font-semibold text-ink">₹{Number(row.targetAmount).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Achieved</p>
                      <p className="mt-1 font-semibold text-ink">₹{Number(row.achievedAmount).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand transition-premium" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              </FadeUp>
            );
          })}
          {rows.length === 0 && !err ? <p className="py-10 text-center text-slate-500 md:col-span-2">No targets yet.</p> : null}
        </div>
      )}
    </CrmShell>
  );
}
