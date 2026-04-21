'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { KpiWidget } from '../../components/ui/kpi-widget';
import { SkeletonBlock } from '../../components/ui/skeleton';
import { apiFetch, getToken } from '../../lib/api';

type Sale = {
  id: string;
  amount: string;
  product: string;
  paymentStatus: string;
  paymentProofUrl?: string | null;
  trnId?: string | null;
  createdAt: string;
  lead: { name: string; phone: string };
  user: { name: string };
};

export default function SalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);
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
      setRows(await apiFetch<Sale[]>('/sales'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const avgDeal = rows.length ? Math.round(totalRevenue / rows.length) : 0;

  return (
    <CrmShell
      title="Sales Pulse"
      subtitle="Revenue momentum and deal quality in one elegant, high-signal flow."
      actions={<Button variant="secondary" onClick={() => void load()}>Refresh</Button>}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiWidget label="Total deals" value={rows.length} tone="accent" hint="Closed records in scope" />
          <KpiWidget label="Revenue" value={totalRevenue} tone="success" hint="Captured pipeline value" formatter={(value) => `₹${value.toLocaleString()}`} />
          <KpiWidget label="Avg. deal size" value={avgDeal} tone="default" hint="Revenue per closed sale" formatter={(value) => `₹${value.toLocaleString()}`} />
          <KpiWidget label="Settled payments" value={rows.filter((row) => row.paymentStatus === 'PAID').length} tone="success" hint="Paid vs pending" />
        </section>
      </FadeUp>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="mt-3 h-7 w-40" />
              <SkeletonBlock className="mt-3 h-4 w-28" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((sale, index) => (
            <FadeUp key={sale.id} delay={Math.min(index * 0.04, 0.2)}>
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-ink">{sale.lead.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{sale.lead.phone}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sale.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sale.paymentStatus}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Product</p>
                    <p className="mt-1 font-medium text-ink">{sale.product}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Owner</p>
                    <p className="mt-1 font-medium text-ink">{sale.user.name}</p>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold text-ink">₹{Number(sale.amount).toLocaleString()}</p>
                {sale.trnId ? (
                  <p className="mt-2 text-xs text-slate-500">TRN: <span className="font-mono text-ink">{sale.trnId}</span></p>
                ) : null}
                {sale.paymentProofUrl ? (
                  <p className="mt-1 text-xs">
                    Proof:{' '}
                    {sale.paymentProofUrl.startsWith('http') ? (
                      <a href={sale.paymentProofUrl} target="_blank" rel="noreferrer" className="text-brand underline">
                        View link
                      </a>
                    ) : (
                      <span className="font-mono text-slate-600">{sale.paymentProofUrl.slice(0, 48)}…</span>
                    )}
                  </p>
                ) : null}
              </Card>
            </FadeUp>
          ))}
          {!rows.length ? <p className="py-10 text-center text-slate-500 md:col-span-2">No sales found.</p> : null}
        </div>
      )}
    </CrmShell>
  );
}
