'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { RhnLogo } from '../../components/rhn-logo';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { FadeUp } from '../../components/ui/motion';
import { apiFetch, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string; user: { role: string } }>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      setToken(res.accessToken);
      const adminRoles = new Set(['DIRECTOR', 'MANAGER', 'SALES_HEAD', 'SUPPORT_HEAD']);
      const dest = adminRoles.has(res.user.role) ? '/admin' : '/dashboard';
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4">
      <FadeUp className="w-full max-w-md">
        <Card className="p-8">
          <div className="mb-6 flex justify-center">
            <RhnLogo size="lg" />
          </div>
          <h1 className="mb-1 text-center text-3xl font-semibold text-ink">Welcome back</h1>
          <p className="mb-6 text-center text-sm text-slate-500">Sign in to continue to RHN CRM</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-slate-900 outline-none ring-brand/20 transition focus:ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="w-full rounded-2xl border border-black/10 px-4 py-2.5 text-slate-900 outline-none ring-brand/20 transition focus:ring"
              />
            </div>
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 space-y-2 text-center text-sm text-slate-500">
            <Link href="/" className="block text-brand hover:underline">
              Back to home
            </Link>
            <a href="/admin-preview.html" className="block text-slate-600 hover:underline">
              Static admin preview
            </a>
          </p>
        </Card>
      </FadeUp>
    </main>
  );
}
