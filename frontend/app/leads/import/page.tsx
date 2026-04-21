'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { CrmShell } from '../../../components/ui/crm-shell';
import { apiFetch, getToken } from '../../../lib/api';

type ImportResult = { imported: number; skipped: number; errors: string[] };

export default function LeadsImportPage() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!getToken()) { setErr('Login required.'); return; }
    setLoading(true); setErr(null); setResult(null);
    try {
      const csv = await file.text();
      const r = await apiFetch<ImportResult>('/leads/import/csv', { method: 'POST', json: { csv } });
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
    finally { setLoading(false); }
  }

  return (
    <CrmShell
      title="Import Leads"
      subtitle="Bulk upload clean lead data via CSV with safe validation and immediate feedback."
      actions={<Link href="/leads" className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-black/5">Back to leads</Link>}
    >
      <p className="mb-4 text-sm text-slate-600">
        Required columns: <code className="rounded bg-slate-100 px-1">name</code>, <code className="rounded bg-slate-100 px-1">phone</code>. Optional:
        {' '}<code className="rounded bg-slate-100 px-1">source</code>, <code className="rounded bg-slate-100 px-1">status</code>, <code className="rounded bg-slate-100 px-1">campaign</code>, <code className="rounded bg-slate-100 px-1">productinterest</code>, <code className="rounded bg-slate-100 px-1">assignedto</code>.
      </p>
      <Card>
        <p className="mb-2 text-sm font-medium text-slate-700">Example CSV format</p>
        <pre className="mb-4 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
{`name,phone,source,status,campaign
Priya Sharma,919800011111,WEBSITE,NEW,Jan2026
Rahul Verma,919800022222,CALL,CONTACTED,`}
        </pre>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="mb-4 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border file:border-black/10 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
        {err ? <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}
        <Button onClick={() => void onSubmit()} disabled={loading}>
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </Card>

      {result ? (
        <Card className="mt-6">
          <h2 className="mb-3 text-xl font-semibold text-ink">Import result</h2>
          <div className="flex gap-6 text-sm">
            <div><p className="text-slate-500">Imported</p><p className="text-2xl font-semibold text-emerald-700">{result.imported}</p></div>
            <div><p className="text-slate-500">Skipped</p><p className="text-2xl font-semibold text-amber-700">{result.skipped}</p></div>
          </div>
          {result.errors.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Errors</p>
              <ul className="space-y-1 text-xs text-red-700">
                {result.errors.map((entry, index) => <li key={index}>{entry}</li>)}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}
    </CrmShell>
  );
}
