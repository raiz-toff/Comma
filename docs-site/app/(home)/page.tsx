import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { androidReleaseUrl, webAppUrl, gitConfig } from '@/lib/shared';

const startHere = [
  {
    title: 'Introduction',
    href: '/docs/getting-started/introduction',
    body: 'What Comma is, who it is for, and why there is no account to create.',
  },
  {
    title: 'Quick start',
    href: '/docs/getting-started/quick-start',
    body: 'Install, answer two questions, and see what your last shift was really worth.',
  },
  {
    title: 'Core concepts',
    href: '/docs/getting-started/core-concepts',
    body: 'Active versus dead distance, reconciliation, and gross versus take-home.',
  },
  {
    title: 'Backup and sync',
    href: '/docs/backup-and-sync/overview',
    body: 'Keep a phone and a laptop in step through your own Google Drive.',
  },
];

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-4xl px-4">
      {/* Hero */}
      <section className="border-b border-fd-border py-20 md:py-28">
        <p className="mb-5 text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Local-first earnings tracker for gig drivers
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-fd-foreground md:text-5xl">
          Know what your driving is actually worth.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-fd-muted-foreground">
          The app pays you a number. It is not the number. Comma logs every dollar, every
          kilometre, and every write-off, then shows you what a shift really earned after tax
          and vehicle costs. No account, no server, nothing leaves your device.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/docs/getting-started/quick-start"
            className="inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Read the docs <ArrowRight className="size-4" />
          </Link>
          <a
            href={androidReleaseUrl}
            className="rounded-lg border border-fd-border px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Download for Android
          </a>
          <a
            href={webAppUrl}
            className="rounded-lg border border-fd-border px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-muted"
          >
            Open the web app
          </a>
        </div>
      </section>

      {/* Start here */}
      <section className="py-16">
        <h2 className="mb-8 text-sm font-semibold uppercase tracking-wider text-fd-muted-foreground">
          Start here
        </h2>
        <div className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border sm:grid-cols-2">
          {startHere.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col gap-2 bg-fd-card p-6 transition-colors hover:bg-fd-muted"
            >
              <span className="flex items-center justify-between font-medium text-fd-foreground">
                {c.title}
                <ArrowRight className="size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm leading-relaxed text-fd-muted-foreground">{c.body}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Two apps */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border pb-0 sm:grid-cols-2">
        <div className="bg-fd-card p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
            Android
          </p>
          <h3 className="mt-2 font-medium text-fd-foreground">For the road</h3>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-fd-muted-foreground">
            <li>Background GPS records the route with the screen off</li>
            <li>Splits delivery kilometres from dead kilometres automatically</li>
            <li>Live console: pause, first order, swipe to end</li>
            <li>Works with no signal — the database is on the phone</li>
          </ul>
        </div>
        <div className="bg-fd-card p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground">
            Web (PWA)
          </p>
          <h3 className="mt-2 font-medium text-fd-foreground">For the desk</h3>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-fd-muted-foreground">
            <li>Dashboard, analytics, tax centre, reports, CSV import</li>
            <li>Type a week of shifts with a keyboard</li>
            <li>Installs to the desktop and runs offline</li>
            <li>Tracks only while the tab is open — no background service</li>
          </ul>
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-fd-border py-10 text-sm text-fd-muted-foreground">
        <a href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`} className="hover:text-fd-foreground">
          GitHub
        </a>
        <Link href="/changelog" className="hover:text-fd-foreground">
          Changelog
        </Link>
        <Link href="/docs/getting-started/faq" className="hover:text-fd-foreground">
          FAQ
        </Link>
        <span className="ml-auto">MIT licensed</span>
      </footer>
    </main>
  );
}
