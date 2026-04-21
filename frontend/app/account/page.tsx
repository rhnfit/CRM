'use client';

import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { CrmShell } from '../../components/ui/crm-shell';
import { FadeUp } from '../../components/ui/motion';
import { apiFetch, getToken } from '../../lib/api';

export default function AccountPage() {
  const [old, setOld] = useState('');
  const [newP, setNewP] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newP !== confirm) { setErr('Passwords do not match'); return; }
    if (!getToken()) { setErr('Please log in first'); return; }
    setErr(null); setMsg(null); setLoading(true);
    try {
      await apiFetch('/users/change-password', { method: 'POST', json: { oldPassword: old, newPassword: newP } });
      setMsg('Password changed successfully!');
      setOld(''); setNewP(''); setConfirm('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <CrmShell
      title="My Account"
      subtitle="Security settings with clear feedback and low-friction updates."
    >
      <FadeUp>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,560px),minmax(0,1fr)]">
          <Card>
            <h2 className="mb-4 text-2xl font-semibold text-ink">Change password</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Current password</label>
                <input
                  type="password"
                  required
                  value={old}
                  onChange={(ev) => setOld(ev.target.value)}
                  className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">New password (min 8)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newP}
                  onChange={(ev) => setNewP(ev.target.value)}
                  className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(ev) => setConfirm(ev.target.value)}
                  className="w-full rounded-2xl border border-black/10 px-4 py-2.5 outline-none ring-brand/20 transition focus:ring"
                />
              </div>
              {err ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p> : null}
              {msg ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</p> : null}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving...' : 'Change password'}
              </Button>
            </form>
          </Card>

          <Card className="h-fit">
            <h3 className="text-lg font-semibold text-ink">Security tips</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Use at least 12 characters for stronger protection.</li>
              <li>Prefer unique passwords not reused in other systems.</li>
              <li>Rotate credentials periodically for shared environments.</li>
            </ul>
          </Card>
        </div>
      </FadeUp>
    </CrmShell>
  );
}
