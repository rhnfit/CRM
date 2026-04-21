'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';

type Props = {
  leadId: string;
  /** Called with payment proof value: S3 key, https URL, or `s3key:...` */
  onProofChange: (value: string) => void;
  proofValue: string;
  amount: string;
  onAmountChange: (v: string) => void;
  trnId: string;
  onTrnChange: (v: string) => void;
  product: string;
  onProductChange: (v: string) => void;
};

export function LeadConversionFields({
  leadId,
  onProofChange,
  proofValue,
  amount,
  onAmountChange,
  trnId,
  onTrnChange,
  product,
  onProductChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const presign = await apiFetch<{ url: string; key: string }>('/storage/payments/upload-url', {
        method: 'POST',
        json: {
          leadId,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        },
      });
      const put = await fetch(presign.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!put.ok) throw new Error('Upload failed');
      onProofChange(`s3key:${presign.key}`);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload unavailable — paste a link to your proof instead.');
    } finally {
      setUploading(false);
      ev.target.value = '';
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <p className="text-sm font-semibold text-amber-900">Sale & payment</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Sale amount (₹) *</label>
        <input
          type="number"
          min={0}
          step="0.01"
          required
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Product</label>
        <input
          type="text"
          value={product}
          onChange={(e) => onProductChange(e.target.value)}
          placeholder="e.g. Starter kit"
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Payment proof *</label>
        <p className="mb-2 text-xs text-slate-500">Upload a screenshot/PDF, or paste a secure https link.</p>
        <input type="file" accept="image/*,.pdf,application/pdf" onChange={(e) => void onFile(e)} disabled={uploading} className="mb-2 block w-full text-sm" />
        {uploading ? <p className="text-xs text-slate-500">Uploading…</p> : null}
        {uploadErr ? <p className="mb-2 text-xs text-amber-800">{uploadErr}</p> : null}
        <input
          type="url"
          value={proofValue.startsWith('s3key:') ? '' : proofValue}
          onChange={(e) => onProofChange(e.target.value)}
          placeholder="https://… (link to payment proof)"
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
        {proofValue.startsWith('s3key:') ? (
          <p className="mt-1 text-xs text-emerald-700">File uploaded — stored securely.</p>
        ) : null}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">TRN / reference ID (optional)</label>
        <input
          type="text"
          value={trnId}
          onChange={(e) => onTrnChange(e.target.value)}
          className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
