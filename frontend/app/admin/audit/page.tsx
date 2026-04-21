'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { apiFetch } from '../../../lib/api';

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<AuditRow[]>('/admin/audit');
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-4xl font-semibold text-ink">Audit log</h1>
      <p className="mb-6 text-slate-500">Latest 200 admin-level actions in your scope.</p>
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <span>
                {r.user.name} · {r.action}
              </span>
              <span>{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-slate-800">
              {r.entity} · <span className="font-mono text-xs">{r.entityId}</span>
            </p>
            {r.meta ? (
              <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-50 p-2 text-xs">
                {JSON.stringify(r.meta, null, 2)}
              </pre>
            ) : null}
          </Card>
        ))}
      </ul>
      {rows.length === 0 && !err ? (
        <p className="text-slate-600">No audit entries yet.</p>
      ) : null}
    </div>
  );
}
