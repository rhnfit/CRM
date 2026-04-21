'use client';

import { useState } from 'react';
import { apiFetch } from '../lib/api';

export function RecordingPlayer({ s3Key }: { s3Key: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function fetchUrl() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<{ url: string }>('/storage/recordings/download-url', {
        method: 'POST',
        json: { key: s3Key },
      });
      setUrl(res.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {url ? (
        <audio
          controls
          src={url}
          className="h-8 w-full max-w-sm"
          aria-label="Call recording"
        />
      ) : (
        <button
          type="button"
          onClick={() => void fetchUrl()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-premium hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Loading...' : '▶ Play recording'}
        </button>
      )}
      {err ? <p className="mt-1 text-xs text-red-600">{err}</p> : null}
    </div>
  );
}
