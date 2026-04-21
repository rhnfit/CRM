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

type Ticket = { id: string; customerName: string; phone: string; type: string; priority: string; status: string };
type PageResult = { data: Ticket[]; total: number; page: number; pages: number };
type Assignable = { id: string; name: string };

const TYPES = ['QUERY', 'ISSUE', 'CASE'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'CLOSED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-700',
};

export default function TicketsPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [assignable, setAssignable] = useState<Assignable[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('QUERY');
  const [priority, setPriority] = useState('NORMAL');
  const [assignedTo, setAssignedTo] = useState('');

  const load = useCallback(async (p = page, q = search, st = statusFilter, pr = priorityFilter) => {
    if (!getToken()) { setErr('Login required.'); setLoading(false); return; }
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (q) params.set('search', q);
      if (st) params.set('status', st);
      if (pr) params.set('priority', pr);
      const [r, a] = await Promise.all([
        apiFetch<PageResult>(`/tickets?${params}`),
        apiFetch<Assignable[]>('/users/assignable'),
      ]);
      setResult(r); setAssignable(a);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (assignable.length && !assignedTo) setAssignedTo(assignable[0]?.id ?? ''); }, [assignable, assignedTo]);

  function handleSearch(v: string) {
    setSearch(v); setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(1, v, statusFilter, priorityFilter), 400);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await apiFetch('/tickets', { method: 'POST', json: { customerName, phone, type, priority, assignedTo } });
      setShowForm(false); setCustomerName(''); setPhone('');
      void load(1, search, statusFilter, priorityFilter);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Create failed'); }
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
    const url = `${getApiBase()}/api/tickets/export/csv?${params}`;
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
      a.download = 'tickets.csv';
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Export failed');
    }
  }

  return (
    <CrmShell
      title="Support Tickets"
      subtitle="Fast triage with clear priorities, lightweight context, and focused issue resolution."
      actions={(
        <>
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <Button onClick={() => setShowForm(true)}>New ticket</Button>
        </>
      )}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <section className="mb-5 grid gap-3 rounded-2xl bg-slate-50/80 p-4 md:grid-cols-3">
          <input
            value={search}
            onChange={(ev) => handleSearch(ev.target.value)}
            placeholder="Search customer or phone"
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          />
          <select
            value={statusFilter}
            onChange={(ev) => { setStatusFilter(ev.target.value); setPage(1); void load(1, search, ev.target.value, priorityFilter); }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={priorityFilter}
            onChange={(ev) => { setPriorityFilter(ev.target.value); setPage(1); void load(1, search, statusFilter, ev.target.value); }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </section>
      </FadeUp>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-3 h-7 w-44" />
              <SkeletonBlock className="mt-3 h-4 w-36" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {result?.data.map((ticket, index) => (
              <FadeUp key={ticket.id} delay={Math.min(index * 0.04, 0.2)}>
                <Card interactive className="group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{ticket.type}</p>
                      <button
                        type="button"
                        onClick={() => setActiveTicket(ticket)}
                        className="mt-1 text-left text-xl font-semibold text-ink transition group-hover:text-brand"
                      >
                        {ticket.customerName}
                      </button>
                      <p className="mt-1 text-sm text-slate-500">{ticket.phone}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_BADGE[ticket.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
                      {ticket.status}
                    </span>
                    <div className="flex items-center gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                      <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setActiveTicket(ticket)}>
                        Quick view
                      </Button>
                      <Link href={`/tickets/${ticket.id}`} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Open
                      </Link>
                    </div>
                  </div>
                </Card>
              </FadeUp>
            ))}
          </div>
          {!result?.data.length ? <p className="py-10 text-center text-slate-500">No tickets found.</p> : null}
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} pages={result?.pages ?? 1} total={result?.total ?? 0} onPage={(p) => { setPage(p); void load(p, search, statusFilter, priorityFilter); }} />
      </div>

      <SlideOver
        open={showForm}
        onOpenChange={setShowForm}
        title="Create Ticket"
        description="Capture core details quickly and route ownership without context switching."
      >
        <form onSubmit={onCreate} className="space-y-3">
          <input required placeholder="Customer name" value={customerName} onChange={(ev) => setCustomerName(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring" />
          <input required placeholder="Phone" value={phone} onChange={(ev) => setPhone(ev.target.value)} className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring" />
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={type} onChange={(ev) => setType(ev.target.value)} className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={priority} onChange={(ev) => setPriority(ev.target.value)} className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={assignedTo} onChange={(ev) => setAssignedTo(ev.target.value)} className="rounded-2xl border border-black/10 px-4 py-2.5 text-sm outline-none ring-brand/20 transition focus:ring">
              {assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="pt-2">
            <Button type="submit">Create ticket</Button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={Boolean(activeTicket)}
        onOpenChange={(open) => { if (!open) setActiveTicket(null); }}
        title={activeTicket?.customerName ?? 'Ticket details'}
        description={activeTicket ? `Type: ${activeTicket.type}` : undefined}
      >
        {activeTicket ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
              <p className="mt-2 text-lg font-semibold text-ink">{activeTicket.phone}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Priority</p>
                <p className="mt-1 font-medium text-ink">{activeTicket.priority}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 font-medium text-ink">{activeTicket.status}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/tickets/${activeTicket.id}`} className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark">
                Open full ticket
              </Link>
              <Button variant="secondary" onClick={() => setActiveTicket(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </SlideOver>
    </CrmShell>
  );
}
