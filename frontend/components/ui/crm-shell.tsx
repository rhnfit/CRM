'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RhnLogo } from '../rhn-logo';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/pipeline', label: 'Pipeline', icon: 'kanban' },
  { href: '/leads', label: 'Leads', icon: 'users' },
  { href: '/tickets', label: 'Tickets', icon: 'ticket' },
  { href: '/sales', label: 'Sales', icon: 'chart' },
  { href: '/reports', label: 'Reports', icon: 'insight' },
];

function Icon({ name }: { name: string }) {
  if (name === 'users') {
    return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20a5 5 0 0 0-10 0m10 0h3m-3 0v0a5 5 0 0 1 3 0m-13 0H4m3 0v0a5 5 0 0 0-3 0m5-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />;
  }
  if (name === 'ticket') {
    return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7h14v4a2 2 0 0 0 0 4v2H5v-2a2 2 0 0 0 0-4V7Z" />;
  }
  if (name === 'chart') {
    return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19h16M7 15v-4m5 4V7m5 8v-6" />;
  }
  if (name === 'insight') {
    return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 18h16M7 14l3-3 3 2 4-4" />;
  }
  if (name === 'kanban') {
    return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h4v14H4V5Zm8-2h4v16h-4V3Zm8 4h4v12h-4V7Z" />;
  }
  return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10.5 12 4l9 6.5V20h-6v-6H9v6H3v-9.5Z" />;
}

export function CrmShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-mist">
      <div className="mx-auto flex w-full max-w-[1400px] flex-row items-start px-4 py-5 sm:px-6 lg:px-8">
        <aside className="sticky top-5 hidden h-[calc(100vh-2.5rem)] w-72 shrink-0 flex-col rounded-2xl border border-black/5 bg-white/85 p-4 shadow-soft backdrop-blur lg:flex">
          <Link href="/" className="mb-6 block rounded-2xl px-3 py-2">
            <RhnLogo size="md" className="mb-3" />
            <p className="text-lg font-semibold text-ink">Relationship Engine</p>
          </Link>
          <nav className="space-y-1.5">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${active ? 'bg-brand-muted text-brand' : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <Icon name={link.icon} />
                  </svg>
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Quick tip</p>
            <p className="mt-1 text-sm text-slate-700">Tap any lead card to open details in a focused side panel.</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 lg:pl-8">
          <section className="rounded-2xl border border-black/5 bg-white/80 p-6 shadow-soft backdrop-blur md:p-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
                {subtitle ? <p className="mt-2 max-w-2xl text-base text-slate-500">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
