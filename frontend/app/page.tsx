import Link from 'next/link';
import { RhnLogo } from '../components/rhn-logo';
import { Card } from '../components/ui/card';

const features = [
  { title: 'Live Dashboard', desc: 'Revenue, leads, and ticket flow with live system visibility.' },
  { title: 'Lead Management', desc: 'Card-based pipeline with quick actions and progressive detail.' },
  { title: 'Support Queue', desc: 'Unified case handling with SLA awareness and fast triage.' },
  { title: 'Sales & Targets', desc: 'Revenue tracking with monthly goals and progress clarity.' },
  { title: 'Reports', desc: 'Insight-focused KPIs and lightweight incentive computation.' },
  { title: 'Admin Control', desc: 'Scoped governance for users, teams, and audit records.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mist">
      <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-8 shadow-soft backdrop-blur md:p-12">
          <RhnLogo size="lg" className="mb-4" />
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-ink md:text-6xl">
            Premium Experience
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-500 md:text-lg">
            Purpose-built for clarity, speed, and confident decision making across every customer interaction.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark">
              Open workspace
            </Link>
            <Link href="/login" className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-ink shadow-soft ring-1 ring-black/5 transition hover:bg-slate-50">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} interactive>
              <h2 className="text-xl font-semibold text-ink">{feature.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
