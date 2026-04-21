'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RecordingPlayer } from '../../../components/recording-player';
import { CallButton } from '../../../components/call-button';
import { LeadConversionFields } from '../../../components/lead-conversion-fields';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { CrmShell } from '../../../components/ui/crm-shell';
import { apiFetch, getToken } from '../../../lib/api';

type Lead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  campaign: string | null;
  productInterest: string | null;
  leadScore: number;
  assignedTo: string;
  nextFollowupAt: string | null;
  assignee?: { id: string; name: string };
};

type TimelineEvent = {
  category: 'activity' | 'ticket' | 'message' | 'call' | 'sale';
  type: string;
  date: string;
  data: Record<string, unknown>;
};

const STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'TRIAL',
  'FOLLOW_UP',
  'COLD',
  'WON',
  'CONVERTED',
  'LOST',
] as const;

function TimelineIcon({ category, type }: { category: string; type: string }) {
  const tone = category === 'sale'
    ? 'bg-amber-100 text-amber-700'
    : category === 'ticket'
      ? 'bg-rose-100 text-rose-700'
      : category === 'call'
        ? 'bg-indigo-100 text-indigo-700'
        : category === 'message'
          ? 'bg-emerald-100 text-emerald-700'
          : type === 'STATUS_CHANGE'
            ? 'bg-cyan-100 text-cyan-700'
            : 'bg-slate-100 text-slate-600';
  return (
    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tone}`}>
      {category[0]?.toUpperCase() ?? 'A'}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const id = String(params.id ?? '');
  const [lead, setLead] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [convOpen, setConvOpen] = useState(false);
  const [convAmount, setConvAmount] = useState('');
  const [convProduct, setConvProduct] = useState('Sale');
  const [convProof, setConvProof] = useState('');
  const [convTrn, setConvTrn] = useState('');
  const [convSaving, setConvSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getToken() || !id) return;
    setErr(null);
    try {
      const [l, tEvents] = await Promise.all([
        apiFetch<Lead>(`/leads/${id}`),
        apiFetch<TimelineEvent[]>(`/leads/${id}/timeline`),
      ]);
      setLead(l);
      setStatus(l.status);
      setTimeline(tEvents);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load profile');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener('crm:lead-refresh', onRefresh);
    return () => window.removeEventListener('crm:lead-refresh', onRefresh);
  }, [load]);

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/activities/reference/${id}/notes`, {
        method: 'POST',
        json: { body: note },
      });
      setNote('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!lead) return;
    setErr(null);
    if (status === 'WON' || status === 'CONVERTED') {
      setConvOpen(true);
      return;
    }
    try {
      await apiFetch(`/leads/${id}`, { method: 'PATCH', json: { status } });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function submitConversion() {
    if (!lead) return;
    const amt = Number(convAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid sale amount.');
      return;
    }
    if (!convProof.trim()) {
      setErr('Payment proof is required (upload or paste a link).');
      return;
    }
    setConvSaving(true);
    setErr(null);
    try {
      await apiFetch(`/leads/${id}`, {
        method: 'PATCH',
        json: {
          status,
          saleAmount: amt,
          paymentProofUrl: convProof.trim(),
          trnId: convTrn.trim() || undefined,
          saleProduct: convProduct.trim() || 'Sale',
        },
      });
      setConvOpen(false);
      setConvAmount('');
      setConvProof('');
      setConvTrn('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setConvSaving(false);
    }
  }

  return (
    <CrmShell title={lead?.name ?? 'Lead profile'} subtitle={lead ? `${lead.phone} · ${lead.source}` : 'Loading profile'}>
      <Link href="/leads" className="mb-4 inline-block text-sm font-medium text-brand hover:underline">← Back to leads</Link>
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}
      {convOpen && lead ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink">Complete sale</h2>
            <p className="mt-1 text-sm text-slate-500">
              Won/converted leads need sale amount and payment proof. TRN is optional.
            </p>
            <div className="mt-4 space-y-4">
              <LeadConversionFields
                leadId={lead.id}
                amount={convAmount}
                onAmountChange={setConvAmount}
                product={convProduct}
                onProductChange={setConvProduct}
                proofValue={convProof}
                onProofChange={setConvProof}
                trnId={convTrn}
                onTrnChange={setConvTrn}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setConvOpen(false);
                    setStatus(lead.status);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={convSaving} onClick={() => void submitConversion()}>
                  {convSaving ? 'Saving…' : 'Save sale'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
      {lead ? (
        <div className="grid gap-4 lg:grid-cols-[360px,minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Lead score</p>
                <p className="mt-1 text-3xl font-semibold text-emerald-600">{lead.leadScore}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Source</p>
                  <p className="mt-1 font-semibold text-ink">{lead.source}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="mt-1 font-semibold text-ink">{lead.status}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="flex-1 rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none ring-brand/20 transition focus:ring"
                >
                  {STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
                <Button variant="secondary" onClick={() => void saveStatus()} disabled={status === lead.status}>Save</Button>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                {lead.assignee ? <p>Assigned to <span className="font-semibold text-ink">{lead.assignee.name}</span></p> : null}
                {lead.productInterest ? <p>Interest <span className="font-semibold text-ink">{lead.productInterest}</span></p> : null}
              </div>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Quick actions</p>
              <CallButton phone={lead.phone} leadId={lead.id} fullWidth />
              <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center rounded-2xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20bd5a]">
                Send WhatsApp
              </a>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-xl font-semibold text-ink">Timeline</h2>
            <form onSubmit={saveNote} className="mb-6 rounded-2xl border border-black/10 bg-slate-50 p-2">
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full resize-none bg-transparent px-2 py-2 text-sm text-ink outline-none"
                placeholder="Write a note..."
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !note.trim()}>{saving ? 'Saving...' : 'Post note'}</Button>
              </div>
            </form>
            <div className="space-y-3">
              {timeline.map((event, index) => {
                const timestamp = new Date(event.date);
                const metadata = (event.data.metadata ?? event.data) as Record<string, unknown>;
                const noteBody = typeof metadata.body === 'string' ? metadata.body : null;
                const recordingUrl = typeof metadata.recordingUrl === 'string' ? metadata.recordingUrl : null;
                return (
                  <div key={`timeline-${index}`} className="flex gap-3 rounded-2xl border border-black/5 bg-slate-50/80 p-3">
                    <TimelineIcon category={event.category} type={event.type} />
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">{event.type}</p>
                      {noteBody ? <p className="mt-1 text-sm text-ink">{noteBody}</p> : null}
                      {recordingUrl ? <div className="mt-2"><RecordingPlayer s3Key={recordingUrl} /></div> : null}
                      {!noteBody && !recordingUrl ? (
                        <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-2 text-xs text-slate-500">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400">{timestamp.toLocaleString()}</p>
                  </div>
                );
              })}
              {timeline.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No timeline events yet.</p> : null}
            </div>
          </Card>
        </div>
      ) : !err ? <p className="text-slate-600">Loading...</p> : null}
    </CrmShell>
  );
}
