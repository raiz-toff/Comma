import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { androidReleaseUrl, webAppUrl, gitConfig } from '@/lib/shared';
import { PLATFORM_MARKS } from '@/lib/platform-logos';
import { LogosCarousel } from '@/components/logos-carousel';
import { ReceiptSpotlight } from '@/components/receipt-spotlight';
import { SpinningCircularText } from '@/components/spinning-circular-text';
import { TextFlip } from '@/components/text-flip';

// What a work session is called depends on the app you drive for — Comma
// speaks each platform's language, and so does the headline.
const SESSION_WORDS = ['shift', 'dash', 'block', 'batch', 'week'];

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

function PlatformMark({ name, color, svg }: { name: string; color: string; svg: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground">
      <span style={{ color }} className="[&_svg]:size-5" dangerouslySetInnerHTML={{ __html: svg }} />
      {name}
    </span>
  );
}

// The product's aha moment, printing itself like a till receipt.
const RECEIPT_LINES = [
  { label: 'Gross paid out', value: '$142.00' },
  { label: 'Tax to set aside · 28%', value: '− $39.76' },
  { label: 'Fuel and expenses', value: '− $18.40' },
  { label: 'Mileage write-off · 47 km', value: '+ $34.31' },
];

function Receipt() {
  return (
    <div className="rise w-full max-w-sm" style={{ ['--rise-delay' as string]: '0.35s' }}>
      {/* The paper. Torn at the bottom like a till receipt. */}
      <div
        className="relative overflow-hidden rounded-t-xl border border-b-0 border-fd-border bg-fd-card px-6 pb-7 pt-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-24px_rgba(0,0,0,0.5)]"
        style={{
          maskImage:
            'linear-gradient(#000 0 calc(100% - 8px), transparent calc(100% - 8px)), conic-gradient(from 135deg at 50% 100%, #000 90deg, transparent 90deg)',
          maskSize: '100% 100%, 14px 16px',
          maskPosition: '0 0, 0 100%',
          maskRepeat: 'no-repeat, repeat-x',
          maskComposite: 'add',
          WebkitMaskComposite: 'source-over',
        }}
      >
        <ReceiptSpotlight />

        <div className="relative mb-4 flex items-center justify-between border-b border-dashed border-fd-border pb-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fd-muted-foreground">
          <span className="text-fd-foreground">Comma</span>
          {/* A meter, not a console. The dot breathes like a taxi meter that's still running. */}
          <span className="inline-flex items-center gap-1.5">
            <span className="meter-dot size-1.5 rounded-full bg-emerald-500" />
            meter running
          </span>
        </div>

        <p className="relative mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-fd-muted-foreground">
          Shift · 6h 40m · 47 km
        </p>

        <div className="relative space-y-3 font-mono text-[13.5px] tabular-nums">
          {RECEIPT_LINES.map((l, i) => (
            <div
              key={l.label}
              className="receipt-line flex items-baseline gap-2"
              style={{ ['--print-delay' as string]: `${0.7 + i * 0.35}s` }}
            >
              <span className="text-fd-muted-foreground">{l.label}</span>
              <span className="grow border-b border-dotted border-fd-border" aria-hidden />
              <span className="text-fd-foreground">{l.value}</span>
            </div>
          ))}

          {/* The number the whole product exists for. */}
          <div
            className="rate-pop relative mt-5 overflow-hidden rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3"
            style={{ ['--print-delay' as string]: `${0.7 + RECEIPT_LINES.length * 0.35 + 0.25}s` }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-emerald-500/25 blur-2xl"
              aria-hidden
            />
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                Real rate
              </span>
              <span className="text-[26px] font-semibold leading-none text-emerald-500">
                $17.72<span className="ml-0.5 text-sm font-normal text-fd-muted-foreground">/hr</span>
              </span>
            </div>
            <p className="mt-1.5 text-right font-mono text-[11px] text-fd-muted-foreground">
              the app said <span className="line-through">$21.30</span>
            </p>
          </div>

          {/* Barcode footer — every receipt has one. */}
          <div
            className="receipt-line pt-3"
            style={{ ['--print-delay' as string]: `${0.7 + RECEIPT_LINES.length * 0.35 + 0.7}s` }}
          >
            <div
              className="h-7 w-full text-fd-foreground/70"
              style={{
                background:
                  'repeating-linear-gradient(90deg, currentColor 0 1.5px, transparent 1.5px 4px, currentColor 4px 7px, transparent 7px 9px, currentColor 9px 10px, transparent 10px 14px)',
              }}
              aria-hidden
            />
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-fd-muted-foreground">
              before you configure anything
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="container mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="grid items-center gap-12 border-b border-fd-border py-20 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div>
          <div className="rise relative mb-6 size-[116px]" style={{ ['--rise-delay' as string]: '0s' }}>
            <SpinningCircularText
              text="every dollar · every kilometre · every write-off · "
              size={116}
              className="absolute inset-0 text-fd-muted-foreground"
            />
            <Image
              src="/logo.png"
              alt="Comma"
              width={52}
              height={52}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              priority
            />
          </div>
          <p
            className="rise mb-5 text-xs font-medium uppercase tracking-widest text-fd-muted-foreground"
            style={{ ['--rise-delay' as string]: '0.08s' }}
          >
            Local-first earnings tracker for gig drivers
          </p>
          <h1
            className="rise max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-fd-foreground md:text-5xl"
            style={{ ['--rise-delay' as string]: '0.16s' }}
          >
            Know what your{' '}
            <span className="inline-grid align-bottom">
              <span className="invisible col-start-1 row-start-1" aria-hidden>
                {SESSION_WORDS.reduce((a, b) => (a.length >= b.length ? a : b))}
              </span>
              <TextFlip className="col-start-1 row-start-1 text-emerald-500">
                {SESSION_WORDS.map((word) => (
                  <span key={word}>{word}</span>
                ))}
              </TextFlip>
            </span>{' '}
            is actually worth.
          </h1>
          <p
            className="rise mt-6 max-w-lg text-lg leading-relaxed text-fd-muted-foreground"
            style={{ ['--rise-delay' as string]: '0.24s' }}
          >
            The app pays you a number. It is not the number. Comma logs every dollar, every
            kilometre, and every write-off — on your device, with no account and no server.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ ['--rise-delay' as string]: '0.32s' }}>
            <Link
              href="/docs/getting-started/quick-start"
              className="group inline-flex items-center gap-2 rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-all hover:opacity-90"
            >
              Read the docs
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={androidReleaseUrl}
              className="rounded-lg border border-fd-border px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:border-fd-foreground/40 hover:bg-fd-muted"
            >
              Android APK
            </a>
            <a
              href={webAppUrl}
              className="rounded-lg border border-fd-border px-4 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:border-fd-foreground/40 hover:bg-fd-muted"
            >
              Web app
            </a>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <Receipt />
        </div>
      </section>

      {/* Platform marquee */}
      <section className="border-b border-fd-border py-9">
        <LogosCarousel className="w-full py-4">
          {PLATFORM_MARKS.map((p) => (
            <PlatformMark key={p.name} {...p} />
          ))}
        </LogosCarousel>
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
                <ArrowRight className="size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-fd-foreground" />
              </span>
              <span className="text-sm leading-relaxed text-fd-muted-foreground">{c.body}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Two apps */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border pb-0 sm:grid-cols-2">
        <div className="bg-fd-card p-7 transition-colors hover:bg-fd-muted">
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
        <div className="bg-fd-card p-7 transition-colors hover:bg-fd-muted">
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
