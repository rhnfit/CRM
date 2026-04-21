'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { SkeletonBlock } from '../../components/ui/skeleton';
import { apiFetch, getToken } from '../../lib/api';

type LeadInfo = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  leadScore: number;
  productInterest: string | null;
  assignedTo: string;
};

export default function AdvancedSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeadInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function performSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!getToken()) {
      setErr('Login required.');
      return;
    }
    setLoading(true);
    setSearched(true);
    setErr(null);
    try {
      const resp = await apiFetch<{ data: LeadInfo[] }>(`/leads?search=${encodeURIComponent(query)}&limit=100`);
      setResults(resp.data);
    } catch (searchError) {
      setErr(searchError instanceof Error ? searchError.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrmShell
      title="Global Search"
      subtitle="One focused query across customers, phones, and lead context with instant, high-signal results."
      actions={<Button variant="secondary" onClick={() => void performSearch()} disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>}
    >
      {err ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}

      <FadeUp>
        <form onSubmit={performSearch} className="mb-6 rounded-2xl border border-black/10 bg-white p-2 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-[260px] flex-1 items-center rounded-2xl bg-slate-50 px-4">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="w-full bg-transparent px-3 py-3 text-base text-slate-900 placeholder-slate-400 outline-none"
                placeholder="Type a name, phone, or product keyword"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="px-6">{loading ? 'Searching...' : 'Search'}</Button>
          </div>
        </form>
      </FadeUp>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="mt-3 h-7 w-40" />
              <SkeletonBlock className="mt-3 h-4 w-28" />
            </Card>
          ))}
        </div>
      ) : null}

      {searched && !loading && results.length === 0 ? (
        <FadeUp>
          <div className="py-16 text-center">
            <h3 className="text-2xl font-semibold text-ink">No results found</h3>
            <p className="mx-auto mt-2 max-w-md text-slate-500">
              No records matched this query ({query}). Try broader terms, alternate phone formats, or status keywords.
            </p>
          </div>
        </FadeUp>
      ) : null}

      {results.length > 0 ? (
        <FadeUp>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">{results.length} matching leads</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((lead, index) => (
              <FadeUp key={lead.id} delay={Math.min(index * 0.04, 0.2)}>
                <Link href={`/leads/${lead.id}`} className="block">
                  <Card interactive className="group h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-ink transition group-hover:text-brand">{lead.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{lead.phone}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {lead.leadScore} score
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p className="capitalize">{lead.status.toLowerCase().replace('_', ' ')}</p>
                      {lead.productInterest ? <p className="line-clamp-1">{lead.productInterest}</p> : null}
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-xs">
                      <span className="text-slate-500">Source: <span className="font-semibold text-slate-700">{lead.source}</span></span>
                      <span className="font-semibold text-brand">View profile</span>
                    </div>
                  </Card>
                </Link>
              </FadeUp>
            ))}
          </div>
        </FadeUp>
      ) : null}
    </CrmShell>
  );
}
