'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { apiFetch } from '../lib/api';
import { LeadConversionFields } from './lead-conversion-fields';

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

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: string;
  phone: string;
  onLogged?: () => void;
};

export function PostCallModal({ open, onClose, leadId, phone, onLogged }: Props) {
  const formId = useId();
  const [callId, setCallId] = useState('');
  useEffect(() => {
    if (open) {
      setCallId(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call-${Date.now()}`);
    }
  }, [open]);
  const [duration, setDuration] = useState('60');
  const [status, setStatus] = useState<string>('CONTACTED');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [product, setProduct] = useState('Sale');
  const [paymentProof, setPaymentProof] = useState('');
  const [trnId, setTrnId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsConversion = status === 'WON' || status === 'CONVERTED';

  const reset = useCallback(() => {
    setDuration('60');
    setStatus('CONTACTED');
    setNote('');
    setAmount('');
    setProduct('Sale');
    setPaymentProof('');
    setTrnId('');
    setErr(null);
  }, []);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (needsConversion) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setErr('Enter a valid sale amount.');
        return;
      }
      const proof = paymentProof.trim();
      if (!proof) {
        setErr('Payment proof is required (upload a file or paste a link).');
        return;
      }
    }
    const cid = callId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call-${Date.now()}`);
    setSaving(true);
    try {
      await apiFetch(`/leads/${leadId}/post-call`, {
        method: 'POST',
        json: {
          callId: cid,
          duration: Math.max(0, parseInt(duration, 10) || 0),
          callType: 'OUTGOING',
          status,
          note: note.trim() || undefined,
          ...(needsConversion
            ? {
                saleAmount: Number(amount),
                paymentProofUrl: paymentProof.trim(),
                trnId: trnId.trim() || undefined,
                saleProduct: product.trim() || 'Sale',
              }
            : {}),
        },
      });
      onLogged?.();
      reset();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Failed to log call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby={formId}>
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl">
        <h2 id={formId} className="text-lg font-semibold text-ink">Log call outcome</h2>
        <p className="mt-1 text-sm text-slate-500">After speaking with {phone}, update the lead status. Won/converted requires amount and payment proof.</p>
        <a href={`tel:${phone}`} className="mt-3 inline-block text-sm font-medium text-brand underline">
          Open phone dialer
        </a>
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          {err ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p> : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Duration (seconds)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lead status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {needsConversion ? (
            <LeadConversionFields
              leadId={leadId}
              amount={amount}
              onAmountChange={setAmount}
              product={product}
              onProductChange={setProduct}
              proofValue={paymentProof}
              onProofChange={setPaymentProof}
              trnId={trnId}
              onTrnChange={setTrnId}
            />
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Call note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
