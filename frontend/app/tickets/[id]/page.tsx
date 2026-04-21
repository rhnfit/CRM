'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { CrmShell } from '../../../components/ui/crm-shell';
import { apiFetch, getToken } from '../../../lib/api';

type Ticket = {
  id: string;
  customerName: string;
  phone: string;
  type: string;
  priority: string;
  status: string;
  resolutionNotes: string | null;
  slaDeadline: string | null;
};

type Activity = {
  id: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  user: { name: string };
};

const STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'CLOSED'];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-600',
};

export default function TicketDetailPage() {
  const params = useParams();
  const id = String(params.id ?? '');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getToken() || !id) return;
    setErr(null);
    try {
      const [t, a] = await Promise.all([
        apiFetch<Ticket>(`/tickets/${id}`),
        apiFetch<Activity[]>(`/activities/reference/${id}`),
      ]);
      setTicket(t);
      setStatus(t.status);
      setResolution(t.resolutionNotes ?? '');
      setActivities(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/activities/reference/${id}/notes`, {
        method: 'POST',
        json: { body: note },
      });
      setNote('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    try {
      await apiFetch(`/tickets/${id}`, {
        method: 'PATCH',
        json: { status, resolutionNotes: resolution || undefined },
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <CrmShell title={ticket?.customerName ?? 'Ticket details'} subtitle={ticket ? `${ticket.phone} · ${ticket.type}` : 'Loading ticket'}>
      <Link href="/tickets" className="mb-4 inline-block text-sm font-medium text-brand hover:underline">← Back to tickets</Link>
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      {ticket ? (
        <div className="grid gap-4 lg:grid-cols-[360px,minmax(0,1fr)]">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Priority</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] ?? 'bg-slate-100 text-slate-700'}`}>
                {ticket.priority}
              </span>
            </div>
            {ticket.slaDeadline ? (
              <p className={`text-sm ${new Date(ticket.slaDeadline) < new Date() ? 'text-red-600' : 'text-slate-500'}`}>
                SLA deadline: {new Date(ticket.slaDeadline).toLocaleString()}
              </p>
            ) : null}
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="flex-1 rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none ring-brand/20 transition focus:ring"
              >
                {STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
              <Button variant="secondary" onClick={() => void save()}>Save</Button>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Resolution notes</label>
              <textarea
                rows={4}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                placeholder="Add resolution details..."
                className="w-full rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none ring-brand/20 transition focus:ring"
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-xl font-semibold text-ink">Activity</h2>
            <form onSubmit={addNote} className="mb-4 flex gap-2">
              <input
                className="flex-1 rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none ring-brand/20 transition focus:ring"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note..."
              />
              <Button type="submit" disabled={saving}>{saving ? 'Adding...' : 'Add'}</Button>
            </form>
            <ul className="space-y-2">
              {activities.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-black/5 bg-slate-50/80 p-3 text-sm">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{entry.user.name} · {entry.type}</span>
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  {typeof entry.metadata.body === 'string' ? (
                    <p className="mt-2 text-slate-800">{entry.metadata.body}</p>
                  ) : (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-sans text-xs text-slate-600">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : !err ? <p className="text-slate-600">Loading...</p> : null}
    </CrmShell>
  );
}
