'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { SlideOver } from '../../../components/ui/slide-over';
import { apiFetch } from '../../../lib/api';

const DEPTS = ['SALES', 'SUPPORT'] as const;

type TeamRow = {
  id: string;
  name: string;
  department: string;
  managerId: string | null;
  _count: { members: number };
  manager: { id: string; name: string; email: string } | null;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<string>('SALES');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<TeamRow[]>('/admin/teams');
      setTeams(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/admin/teams', {
        method: 'POST',
        json: { name, department },
      });
      setFormOpen(false);
      setName('');
      setDepartment('SALES');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-ink">Teams</h1>
          <p className="text-slate-500">Organize sales and support under focused team structures.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>Add team</Button>
      </div>

      {error ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <SlideOver open={formOpen} onOpenChange={setFormOpen} title="Create team">
        <form onSubmit={onCreate} className="flex max-w-md flex-col gap-3">
          <input
            required
            placeholder="Team name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-2.5"
          />
          <select
            value={department}
            onChange={(ev) => setDepartment(ev.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-2.5"
          >
            {DEPTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create team'}</Button>
        </form>
      </SlideOver>

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {teams.map((t) => (
            <Card key={t.id} interactive className="flex flex-col gap-2">
              <div>
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-600">
                  {t.department} · {t._count.members} member{t._count.members === 1 ? '' : 's'}
                </p>
                {t.manager ? (
                  <p className="text-xs text-slate-500">Manager: {t.manager.name}</p>
                ) : null}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
