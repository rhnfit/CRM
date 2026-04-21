'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Pagination } from '../../components/pagination';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { SkeletonBlock } from '../../components/ui/skeleton';
import { SlideOver } from '../../components/ui/slide-over';
import { apiFetch, getApiBase, getToken } from '../../lib/api';

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  assignedTo: string;
  lastActivity?: string;
};
type PageResult = { data: Lead[]; total: number; page: number; pages: number };
type Assignable = { id: string; name: string; email: string };
type Team = { id: string; name: string; department: string };

const SOURCES = ['WEBSITE', 'WHATSAPP', 'OFFLINE', 'CALL'];
const STATUSES = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'CONVERTED', 'LOST'];

export default function LeadsPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [assignable, setAssignable] = useState<Assignable[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('NEW');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkUser, setBulkUser] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('WEBSITE');
  const [assignedTo, setAssignedTo] = useState('');
  const [autoTeam, setAutoTeam] = useState('');

  const load = useCallback(async (p = page, q = search, st = statusFilter, src = sourceFilter) => {
    if (!getToken()) { setErr('Login required.'); setLoading(false); return; }
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (q) params.set('search', q);
      if (st) params.set('status', st);
      if (src) params.set('source', src);
      const [r, a, t] = await Promise.all([
        apiFetch<PageResult>(`/leads?${params}`),
        apiFetch<Assignable[]>('/users/assignable'),
        apiFetch<Team[]>('/teams'),
      ]);
      setResult(r); setAssignable(a);
      setTeams(t.filter((x) => x.department === 'SALES'));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, sourceFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (assignable.length && !assignedTo) setAssignedTo(assignable[0]?.id ?? ''); }, [assignable, assignedTo]);

  function handleSearch(v: string) {
    setSearch(v); setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(1, v, statusFilter, sourceFilter), 400);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      const body: Record<string, string> = { name, phone, source };
      if (autoTeam) body.autoAssignTeamId = autoTeam; else body.assignedTo = assignedTo;
      await apiFetch('/leads', { method: 'POST', json: body });
      setShowForm(false); setName(''); setPhone('');
      void load(1, search, statusFilter, sourceFilter);
    } catch (err) { setErr(err instanceof Error ? err.message : 'Create failed'); }
  }

  async function bulkReassign() {
    if (!bulkUser || selected.size === 0) return;
    try {
      const r = await apiFetch<{ reassigned: number }>('/leads/bulk-reassign', {
        method: 'POST', json: { leadIds: [...selected], assignedTo: bulkUser },
      });
      alert(`Reassigned ${r.reassigned} leads`);
      setSelected(new Set());
      void load(page, search, statusFilter, sourceFilter);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Bulk reassign failed'); }
  }

  async function exportCsv() {
    const token = getToken();
    if (!token) {
      setErr('Login required.');
      return;
    }
    setErr(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    const url = `${getApiBase()}/api/leads/export/csv?${params}`;
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Export failed');
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'leads.csv';
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <CrmShell
      title="Leads"
      subtitle="Focused cards, smart defaults, and instant actions to move opportunities faster."
      actions={(
        <>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <Link href="/leads/import" className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-soft ring-1 ring-black/5 transition hover:bg-slate-50">
            Import CSV
          </Link>
          <Button onClick={() => setShowForm(true)}>New lead</Button>
        </>
      )}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <section className="mb-5 grid gap-3 rounded-2xl bg-slate-50/80 p-4 md:grid-cols-3">
          <input
            value={search}
            onChange={(ev) => handleSearch(ev.target.value)}
            placeholder="Search name or phone"
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          />
          <select
            value={statusFilter}
            onChange={(ev) => { setStatusFilter(ev.target.value); setPage(1); void load(1, search, ev.target.value, sourceFilter); }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={(ev) => { setSourceFilter(ev.target.value); setPage(1); void load(1, search, statusFilter, ev.target.value); }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          >
            <option value="">All sources</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </section>
      </FadeUp>

      {selected.size > 0 ? (
        <FadeUp>
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-muted px-4 py-3 text-sm">
            <span className="font-medium text-brand">{selected.size} selected</span>
            <select value={bulkUser} onChange={(ev) => setBulkUser(ev.target.value)} className="rounded-2xl border border-black/10 bg-white px-3 py-2">
              <option value="">Assign to</option>
              {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Button onClick={() => void bulkReassign()} disabled={!bulkUser}>Reassign</Button>
            <Button variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </FadeUp>
      ) : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="mt-3 h-8 w-48" />
              <SkeletonBlock className="mt-3 h-4 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {result?.data.map((lead, index) => (
              <FadeUp key={lead.id} delay={Math.min(index * 0.04, 0.2)}>
                <Card interactive className="group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{lead.source}</p>
                      <button
                        type="button"
                        onClick={() => setActiveLead(lead)}
                        className="mt-1 text-left text-xl font-semibold text-ink transition group-hover:text-brand"
                      >
                        {lead.name}
                      </button>
                      <p className="mt-1 text-sm text-slate-500">{lead.phone}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="h-4 w-4 rounded border-black/20 accent-brand"
                      aria-label={`Select ${lead.name}`}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
                      {lead.status}
                    </span>
                    <div className="flex items-center gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                      <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setActiveLead(lead)}>
                        Quick view
                      </Button>
                      <Link href={`/leads/${lead.id}`} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition-premium hover:bg-slate-100">
                        Open
                      </Link>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Last activity: {lead.lastActivity ?? 'Awaiting first interaction'}
                  </p>
                </Card>
              </FadeUp>
            ))}
          </div>
          {!result?.data.length ? <p className="py-10 text-center text-slate-500">No leads found.</p> : null}
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} pages={result?.pages ?? 1} total={result?.total ?? 0} onPage={(p) => { setPage(p); void load(p, search, statusFilter, sourceFilter); }} />
      </div>

      <SlideOver
        open={showForm}
        onOpenChange={setShowForm}
        title="Create Lead"
        description="Use smart defaults and route ownership without leaving this view."
      >
        <form onSubmit={onCreate} className="space-y-3">
          <input required placeholder="Name" value={name} onChange={(ev) => setName(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring" />
          <input required placeholder="Phone (unique)" value={phone} onChange={(ev) => setPhone(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring" />
          <select value={source} onChange={(ev) => setSource(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">Assign to user</p>
              <select value={assignedTo} onChange={(ev) => { setAssignedTo(ev.target.value); setAutoTeam(''); }} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
                {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Auto assign team</p>
              <select value={autoTeam} onChange={(ev) => setAutoTeam(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
                <option value="">Manual</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit">Save lead</Button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={Boolean(activeLead)}
        onOpenChange={(open) => { if (!open) setActiveLead(null); }}
        title={activeLead?.name ?? 'Lead details'}
        description={activeLead ? `Status: ${activeLead.status}` : undefined}
      >
        {activeLead ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activeLead.phone}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Source</p>
                <p className="mt-1 font-medium text-ink">{activeLead.source}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Owner</p>
                <p className="mt-1 font-medium text-ink">{activeLead.assignedTo || 'Unassigned'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/leads/${activeLead.id}`} className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark">
                Open full profile
              </Link>
              <Button variant="secondary" onClick={() => setActiveLead(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </CrmShell>
  );
}
