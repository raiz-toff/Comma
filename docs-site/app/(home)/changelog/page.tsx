import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DM_Serif_Display } from 'next/font/google';
import { getReleases, type Release } from '@/lib/changelog';
import { androidReleaseUrl } from '@/lib/shared';

const serif = DM_Serif_Display({ weight: '400', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Every released version of Comma, and what changed.',
};

// Minimal inline markdown: **bold**, `code`, [text](url). Enough for changelog copy.
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={key++} className="font-medium text-fd-foreground">{m[1]}</strong>);
    else if (m[2]) nodes.push(<code key={key++} className="rounded bg-fd-muted px-1.5 py-0.5 text-[0.85em]">{m[2]}</code>);
    else if (m[3]) nodes.push(<a key={key++} href={m[4]} className="text-fd-primary underline underline-offset-2">{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const GROUP_TONE: Record<string, string> = {
  Added: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  Changed: 'text-amber-600 dark:text-amber-400 border-amber-500/30',
  Fixed: 'text-rose-600 dark:text-rose-400 border-rose-500/30',
  Removed: 'text-fd-muted-foreground border-fd-border',
};

/* ------------------------------------------------------------------------ *
 * Release cards (AGENTS.md §7).
 *
 * Each release gets a card with a fixed anatomy (version pill, one serif
 * headline, 2-3 ticks, a faint oversized version numeral); only the accent
 * rotates, cycling per release through the app's KPI palette so consecutive
 * releases read as siblings, not copies. Headline and ticks auto-derive from
 * the release's **bold claims** in CHANGELOG.md; CURATED overrides win when a
 * release deserves better copy than its first bold line.
 *
 * The card follows the reader's theme: surfaces and text come from the LIGHT /
 * DARK palettes in src/theme/colors.ts. Each accent carries a light-mode twin,
 * because the dark-mode hues are tuned for a black canvas and fail contrast on
 * white — the same reason colors.ts drops to 600/700 tints in LIGHT. Both hues
 * ride on one CSS variable so a single class pair styles either theme.
 * ------------------------------------------------------------------------ */

// [dark-canvas hue, light-canvas hue (>= 4.5:1 on white)]
const ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ['#22c55e', '#15803D'], // emerald
  ['#14b8a6', '#0F766E'], // teal
  ['#F5A623', '#B45309'], // amber
  ['#3B82F6', '#2563EB'], // blue
  ['#06b6d4', '#0E7490'], // cyan
  ['#6366f1', '#4F46E5'], // indigo
];

const CURATED: Record<string, { headline: string; ticks?: string[] }> = {
  '1.4.0': {
    headline: 'Light mode. Tablet layouts. Vehicle filters.',
    ticks: [
      'The web app now feels native — sheets, swipes, real dialogs',
      'Multi-vehicle mileage write-offs are finally per-vehicle',
      'A restored phone asks for location again',
    ],
  },
  '1.3.1': {
    headline: 'Updates now arrive over the air.',
    ticks: ['JS fixes land on next launch — no reinstall', 'Fixed invisible text in 1.3.0 release builds'],
  },
  '1.3.0': {
    headline: 'Two steps to your first shift.',
    ticks: [
      'One calm welcome screen — demo and restore as quiet links',
      'One-tap cloud sync, end-to-end encryption optional',
      'Dark design system by default, faster long lists',
    ],
  },
  '1.2.1': {
    headline: 'Write-offs that know your vehicle.',
    ticks: [
      'Bikes and scooters no longer get car mileage rates',
      'Analytics: 21 widgets consolidated into 6 focused cards',
      'The mileage write-off reads as a tax note, not fake money',
    ],
  },
  '1.2.0': {
    headline: 'Sync grows up.',
    ticks: [
      'Profile settings now travel between your devices',
      'Older records join sync through a one-time backfill',
      'Local JSON backup and restore',
    ],
  },
  '1.1.0': {
    headline: 'Fixes across sync, sound, and demo mode.',
    ticks: ['Dead-mileage summary added', 'Notification sounds behave while a shift records'],
  },
};

// The **bold claim** opening each changelog item, in file order.
function boldClaims(release: Release): string[] {
  const claims: string[] = [];
  for (const g of release.groups) {
    for (const item of g.items) {
      const m = item.match(/^\*\*([^*]+)\*\*/);
      if (m) claims.push(m[1].replace(/[:.]\s*$/, ''));
    }
  }
  return claims;
}

function cardContent(release: Release): { headline: string; ticks: string[] } | null {
  const curated = CURATED[release.version];
  const claims = boldClaims(release);
  const headline = curated?.headline ?? claims[0];
  if (!headline) return null;
  const ticks = curated?.ticks ?? claims.slice(1, 4);
  return { headline, ticks };
}

function ReleaseCard({
  release,
  accent,
}: {
  release: Release;
  accent: readonly [string, string];
}) {
  const content = cardContent(release);
  if (!content) return null;
  const [onDark, onLight] = accent;
  // --a is the accent for the *current* theme: the light hue by default, swapped
  // to the dark hue under .dark (Tailwind v4 exposes that as the `dark:` variant).
  const vars = { '--a': onLight, '--a-dark': onDark } as React.CSSProperties;
  return (
    <div
      style={vars}
      className="relative mb-6 overflow-hidden rounded-xl border border-[#E5E5EB] bg-[#FCFCFD] p-6 dark:border-[#26262C] dark:bg-[#0A0A0C] sm:p-8 [&_*]:dark:[--a:var(--a-dark)] dark:[--a:var(--a-dark)]"
    >
      <span
        aria-hidden
        className={`${serif.className} pointer-events-none absolute -bottom-10 right-2 select-none text-[7.5rem] leading-none text-[var(--a)] opacity-[0.07] dark:opacity-[0.09] sm:text-[9rem]`}
      >
        {release.version}
      </span>
      <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="rounded-full border border-[color-mix(in_srgb,var(--a)_40%,transparent)] bg-[color-mix(in_srgb,var(--a)_10%,transparent)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--a)]">
          v{release.version}
        </span>
      </div>
      <h3
        className={`${serif.className} relative mt-4 max-w-xl text-2xl leading-snug text-[#0E0E11] dark:text-[#F6F6F7] sm:text-[1.9rem]`}
      >
        {content.headline}
      </h3>
      {content.ticks.length > 0 && (
        <ul className="relative mt-4 space-y-1.5">
          {content.ticks.map((t, i) => (
            <li
              key={i}
              className="flex items-baseline gap-2.5 text-sm leading-relaxed text-[#53535A] dark:text-[#9B9BA4]"
            >
              <span aria-hidden className="text-[var(--a)]">
                ✓
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "2026-07-12" -> "July 12, 2026" without a Date round-trip (UTC parsing can
// shift the day depending on the build machine's timezone).
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
function fmtDate(date: string | null): string | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

export default function ChangelogPage() {
  const releases = getReleases();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 md:py-24 lg:px-10">
      <header className="mb-16">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-fd-muted-foreground">
          Release history
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground">Changelog</h1>
        <p className="mt-4 max-w-xl text-fd-muted-foreground">
          Every released version of Comma. Android builds are on{' '}
          <a href={androidReleaseUrl} className="text-fd-primary underline underline-offset-2">
            GitHub Releases
          </a>
          ; installed apps also update over the air.
        </p>
      </header>

      <div className="relative">
        {releases.map((r, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <div key={r.version} className="flex flex-col md:flex-row">
              {/* Left rail — sticky date + version while the entry scrolls */}
              <div className="flex-shrink-0 md:w-44">
                <div className="pb-6 md:sticky md:top-24 md:pb-10">
                  {r.date && (
                    <time className="mb-3 block text-sm font-medium text-fd-muted-foreground">
                      {fmtDate(r.date)}
                    </time>
                  )}
                  <div className="inline-flex h-10 items-center rounded-lg border border-fd-border px-3 text-sm font-bold text-fd-foreground">
                    v{r.version}
                  </div>
                  {r.build && (
                    <div className="mt-2 text-xs text-fd-muted-foreground">{r.build}</div>
                  )}
                </div>
              </div>

              {/* Right — timeline line, release card, grouped notes */}
              <div className="relative flex-1 pb-16 md:pl-10">
                <div
                  className="absolute left-0 top-1 hidden h-full w-px bg-fd-border md:block"
                  style={{ '--a': accent[1], '--a-dark': accent[0] } as React.CSSProperties}
                  aria-hidden
                >
                  <div className="absolute size-3 -translate-x-1/2 rounded-full bg-[var(--a)] ring-4 ring-fd-background dark:[--a:var(--a-dark)]" />
                </div>

                <ReleaseCard release={r} accent={accent} />

                <div className="space-y-6">
                  {r.groups.map((g) => (
                    <section key={g.heading}>
                      <h3
                        className={`mb-2 inline-block border-b pb-0.5 text-xs font-semibold uppercase tracking-wider ${
                          GROUP_TONE[g.heading] ?? 'text-fd-muted-foreground border-fd-border'
                        }`}
                      >
                        {g.heading}
                      </h3>
                      <ul className="space-y-2">
                        {g.items.map((item, i) => (
                          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-fd-muted-foreground">
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-fd-muted-foreground/50" aria-hidden />
                            <span>{inline(item)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {releases.length === 0 && (
        <p className="text-fd-muted-foreground">No releases recorded yet.</p>
      )}
    </main>
  );
}
