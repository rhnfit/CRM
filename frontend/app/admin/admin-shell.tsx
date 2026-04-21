'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RhnLogo } from '../../components/rhn-logo';
import { ADMIN_ROLES, apiFetch, clearToken, getToken, logout as apiLogout, MeUser } from '../../lib/api';
import { formatRoleLabel } from '../../lib/roles';

const nav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/teams', label: 'Teams' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    let cancelled = false;
    (async () => {
      try {
        const user = await apiFetch<MeUser>('/users/me');
        if (cancelled) return;
        if (!ADMIN_ROLES.has(user.role)) { clearToken(); router.replace('/login'); return; }
        setMe(user);
      } catch {
        if (!cancelled) { clearToken(); router.replace('/login'); }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function logout() {
    await apiLogout();
    clearToken();
    router.push('/login');
  }

  if (!ready || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist text-slate-600">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="text-sm">Loading admin…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto flex w-full max-w-[1400px] flex-row items-start px-4 py-5 sm:px-6 lg:px-8">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 shrink-0 flex-col rounded-2xl border border-black/5 bg-white/85 p-4 shadow-soft backdrop-blur lg:flex">
          <div className="mb-6 rounded-2xl px-3 py-2">
            <RhnLogo size="sm" className="mb-3" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">RHN Admin</p>
            <p className="truncate text-lg font-semibold text-ink">{me.name}</p>
            <p className="truncate text-xs text-slate-500">{formatRoleLabel(me.role, me.department)} · {me.department}</p>
          </div>
          <nav className="space-y-1.5">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center rounded-2xl px-3 py-2.5 text-sm transition ${active ? 'bg-brand-muted text-brand' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 p-1">
            <Link href="/dashboard" className="block rounded-2xl bg-white py-2 text-center text-sm font-medium text-slate-700 shadow-soft ring-1 ring-black/5 transition hover:bg-slate-50">
              Open CRM
            </Link>
            <button type="button" onClick={logout} className="w-full rounded-2xl bg-slate-100 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
              Log out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pl-8">
          <header className="mb-4 flex items-center justify-between rounded-2xl border border-black/5 bg-white/80 px-4 py-3 shadow-soft backdrop-blur lg:hidden">
            <RhnLogo size="sm" className="max-h-7" />
            <button
              type="button"
              onClick={() => setMobileNav((value) => !value)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Toggle nav"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </header>
          {mobileNav ? (
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-white p-3 shadow-soft lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNav(false)}
                  className={`rounded-xl px-3 py-2 text-sm ${pathname === item.href ? 'bg-brand-muted text-brand' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {item.label}
                </Link>
              ))}
              <button type="button" onClick={logout} className="rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Log out</button>
            </div>
          ) : null}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-soft backdrop-blur md:p-8"
          >
            {children}
          </motion.section>
        </main>
      </div>
    </div>
  );
}
