'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { SlideOver } from '../../../components/ui/slide-over';
import { apiFetch, MeUser } from '../../../lib/api';

const ROLES = ['DIRECTOR', 'MANAGER', 'SALES_HEAD', 'SUPPORT_HEAD', 'TEAM_LEADER', 'AGENT'] as const;
const DEPTS = ['SALES', 'SUPPORT'] as const;

type Team = { id: string; name: string; department: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<MeUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('AGENT');
  const [department, setDepartment] = useState<string>('SALES');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, t] = await Promise.all([
        apiFetch<MeUser[]>('/admin/users'),
        apiFetch<Team[]>('/admin/teams'),
      ]);
      setUsers(list);
      setTeams(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
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
      await apiFetch('/admin/users', {
        method: 'POST',
        json: { name, email, password, role, department },
      });
      setFormOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('AGENT');
      setDepartment('SALES');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function patch(u: MeUser, body: Record<string, unknown>) {
    setError(null);
    try {
      await apiFetch(`/admin/users/${u.id}`, { method: 'PATCH', json: body });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-ink">Users</h1>
          <p className="text-slate-500">Create and manage accounts in your administrative scope.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>Add user</Button>
      </div>

      {error ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <SlideOver open={formOpen} onOpenChange={setFormOpen} title="Create user">
        <form onSubmit={onCreate} className="grid gap-3">
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-2.5"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-2.5"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Password (min 8)"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="rounded-2xl border border-black/10 px-4 py-2.5"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={role}
              onChange={(ev) => setRole(ev.target.value)}
              className="rounded-2xl border border-black/10 px-4 py-2.5"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create user'}</Button>
        </form>
      </SlideOver>

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/10 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name / email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Dept</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const teamOptions = teams.filter((t) => t.department === u.department);
                return (
                  <tr key={u.id} className="align-top border-b border-black/5 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(ev) => void patch(u, { role: ev.target.value })}
                        className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs transition-premium hover:bg-slate-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.department}
                        onChange={(ev) => void patch(u, { department: ev.target.value })}
                        className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs transition-premium hover:bg-slate-50"
                      >
                        {DEPTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.teamId ?? ''}
                        onChange={(ev) =>
                          void patch(u, { teamId: ev.target.value || null })
                        }
                        className="rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs transition-premium hover:bg-slate-50"
                      >
                        <option value="">—</option>
                        {teamOptions.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.isActive === false
                            ? 'rounded-full bg-slate-200 px-2 py-0.5 text-xs'
                            : 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800'
                        }
                      >
                        {u.isActive === false ? 'No' : 'Yes'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void patch(u, { isActive: u.isActive === false })}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        {u.isActive === false ? 'Activate' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
