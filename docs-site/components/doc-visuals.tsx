/**
 * Doc visuals — the illustration kit for docs pages (AGENTS.md §4, §7).
 *
 * These are registered globally in components/mdx.tsx, so any page in `docs/`
 * can use them as JSX with no import:
 *
 *     <StatRow items={[{ value: "$36.04", label: "real hourly" }]} />
 *
 * Rules baked in here so a page can't drift:
 *   - Every visual is HTML/CSS, never an image: selectable, screen-readable,
 *     sharp on retina, and it follows the reader's theme.
 *   - Surfaces and text come from the LIGHT/DARK palettes in src/theme/colors.ts.
 *   - Accents carry a light-canvas twin (the dark hues fail contrast on white);
 *     both ride on `--a`, which flips under `dark:`.
 *   - No new colors. Pick an accent by name; that's the whole freedom.
 *
 * ONE visual per page, at the top, matching that page's single idea. Adjacent
 * pages must not reuse the same component — variety is the point.
 */
import type { CSSProperties, ReactNode } from 'react';

// [on-dark hue, on-light hue] — light twins are the 600/700 tints, >= 4.5:1 on white.
const ACCENTS = {
  emerald: ['#22c55e', '#15803D'],
  teal: ['#14b8a6', '#0F766E'],
  amber: ['#F5A623', '#B45309'],
  blue: ['#3B82F6', '#2563EB'],
  cyan: ['#06b6d4', '#0E7490'],
  indigo: ['#6366f1', '#4F46E5'],
} as const;

export type Accent = keyof typeof ACCENTS;

function vars(accent: Accent = 'emerald'): CSSProperties {
  const [dark, light] = ACCENTS[accent];
  return { '--a': light, '--a-dark': dark } as CSSProperties;
}

const SURFACE =
  'rounded-xl border border-[#E5E5EB] bg-[#FCFCFD] dark:border-[#26262C] dark:bg-[#0A0A0C] dark:[--a:var(--a-dark)]';
const MUTED = 'text-[#53535A] dark:text-[#9B9BA4]';
const STRONG = 'text-[#0E0E11] dark:text-[#F6F6F7]';

/** Shared shell: bordered surface + optional caption. Keeps every visual a sibling. */
function Frame({
  accent = 'emerald',
  caption,
  className = '',
  children,
}: {
  accent?: Accent;
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure style={vars(accent)} className={`not-prose my-6 ${SURFACE} p-5 sm:p-6 ${className}`}>
      {children}
      {caption && (
        <figcaption className={`mt-4 text-xs ${MUTED}`}>{caption}</figcaption>
      )}
    </figure>
  );
}

/* ── 1. StatRow — big tabular numbers. For pages about what a driver sees. ── */
export function StatRow({
  items,
  caption,
  accent = 'emerald',
}: {
  items: { value: string; label: string }[];
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <div className={`font-mono text-xl tabular-nums sm:text-2xl ${STRONG}`}>{it.value}</div>
            <div className={`mt-1 text-xs ${MUTED}`}>{it.label}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ── 2. RouteSplit — one road, two kinds of kilometre. Mileage pages. ── */
export function RouteSplit({ caption, accent = 'emerald' }: { caption?: string; accent?: Accent }) {
  return (
    <Frame accent={accent} caption={caption}>
      <svg viewBox="0 0 600 120" className="w-full" role="img" aria-label="A route alternating between active kilometres, driven with an order, and dead kilometres, driven empty">
        <path d="M20 90 H140" stroke="var(--a)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M140 90 C 200 90, 200 30, 260 30" stroke="currentColor" className="text-[#AEAEB7] dark:text-[#45454C]" strokeWidth="5" strokeDasharray="9 9" strokeLinecap="round" fill="none" />
        <path d="M260 30 H380" stroke="var(--a)" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M380 30 C 440 30, 440 90, 500 90" stroke="currentColor" className="text-[#AEAEB7] dark:text-[#45454C]" strokeWidth="5" strokeDasharray="9 9" strokeLinecap="round" fill="none" />
        <path d="M500 90 H580" stroke="var(--a)" strokeWidth="7" strokeLinecap="round" fill="none" />
        {[20, 260, 500].map((x, i) => (
          <circle key={i} cx={x} cy={i === 1 ? 30 : 90} r="6" fill="var(--a)" />
        ))}
      </svg>
      <div className={`mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs ${MUTED}`}>
        <span className="flex items-center gap-2">
          <span className="h-1 w-6 rounded-full bg-[var(--a)]" /> active — an order is on
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1 w-6 rounded-full border-t-2 border-dashed border-[#AEAEB7] dark:border-[#45454C]" /> dead — driving empty
        </span>
      </div>
    </Frame>
  );
}

/* ── 3. MoneySplit — a stacked bar of where the money goes. Tax/expenses. ── */
export function MoneySplit({
  total,
  parts,
  caption,
}: {
  total: string;
  parts: { label: string; pct: number; accent: Accent }[];
  caption?: string;
}) {
  return (
    <Frame caption={caption}>
      <div className={`mb-3 font-mono text-2xl tabular-nums ${STRONG}`}>{total}</div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#E8E8ED] dark:bg-[#1C1C21]">
        {parts.map((p) => (
          <div
            key={p.label}
            style={{ ...vars(p.accent), width: `${p.pct}%` }}
            className="h-full bg-[var(--a)] dark:[--a:var(--a-dark)]"
          />
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.label} style={vars(p.accent)} className="flex items-baseline gap-2 dark:[--a:var(--a-dark)]">
            <span className="size-2 shrink-0 rounded-full bg-[var(--a)]" />
            <span className={`text-xs ${MUTED}`}>
              <span className={`font-mono tabular-nums ${STRONG}`}>{p.pct}%</span> {p.label}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ── 4. StepFlow — a numbered chain. How-to pages. ── */
export function StepFlow({
  steps,
  caption,
  accent = 'blue',
}: {
  steps: { title: string; body?: string }[];
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="mb-2 inline-flex size-7 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--a)_40%,transparent)] bg-[color-mix(in_srgb,var(--a)_10%,transparent)] font-mono text-xs text-[var(--a)]">
              {i + 1}
            </span>
            <div className={`text-sm font-medium ${STRONG}`}>{s.title}</div>
            {s.body && <div className={`mt-0.5 text-xs leading-relaxed ${MUTED}`}>{s.body}</div>}
          </li>
        ))}
      </ol>
    </Frame>
  );
}

/* ── 5. VaultFlow — where the data lives. Sync, backup, privacy, architecture. ── */
export function VaultFlow({
  nodes,
  hub,
  caption,
  accent = 'cyan',
}: {
  nodes: [string, string];
  hub: string;
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <Node label={nodes[0]} />
        <Link />
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--a)_45%,transparent)] bg-[color-mix(in_srgb,var(--a)_10%,transparent)] px-4 py-3 text-center">
          <div className="text-xs font-medium text-[var(--a)]">{hub}</div>
          <div className={`mt-0.5 text-[10px] ${MUTED}`}>yours, optional</div>
        </div>
        <Link />
        <Node label={nodes[1]} />
      </div>
    </Frame>
  );
}

function Node({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-[#E5E5EB] bg-white px-4 py-3 text-center dark:border-[#2E2E36] dark:bg-[#16161A]">
      <div className={`text-xs font-medium ${STRONG}`}>{label}</div>
      <div className={`mt-0.5 text-[10px] ${MUTED}`}>on your device</div>
    </div>
  );
}

function Link() {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      <span className="h-px w-6 bg-[var(--a)] opacity-50 sm:w-10" />
      <span className="size-1.5 rounded-full bg-[var(--a)]" />
      <span className="h-px w-6 bg-[var(--a)] opacity-50 sm:w-10" />
    </div>
  );
}

/* ── 6. ShiftStrip — a shift as a bar of time. Shift-tracking, concepts. ── */
export function ShiftStrip({
  blocks,
  caption,
  accent = 'teal',
}: {
  blocks: { label: string; pct: number; kind?: 'active' | 'idle' }[];
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <div className="flex h-11 w-full overflow-hidden rounded-lg border border-[#E5E5EB] dark:border-[#26262C]">
        {blocks.map((b) => (
          <div
            key={b.label}
            style={{ width: `${b.pct}%` }}
            className={
              b.kind === 'idle'
                ? 'flex items-center justify-center bg-[#F0F0F4] text-[10px] dark:bg-[#16161A]'
                : 'flex items-center justify-center bg-[color-mix(in_srgb,var(--a)_16%,transparent)] text-[10px]'
            }
          >
            <span className={b.kind === 'idle' ? MUTED : 'font-medium text-[var(--a)]'}>{b.label}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ── 7. LayerStack — stacked layers. Architecture pages. ── */
export function LayerStack({
  layers,
  caption,
  accent = 'indigo',
}: {
  layers: { name: string; note?: string }[];
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <div className="space-y-2">
        {layers.map((l, i) => (
          <div
            key={l.name}
            style={{ marginLeft: `${i * 14}px` }}
            className="flex items-center justify-between gap-4 rounded-lg border border-[#E5E5EB] bg-white px-4 py-2.5 dark:border-[#2E2E36] dark:bg-[#16161A]"
          >
            <span className={`font-mono text-xs ${STRONG}`}>{l.name}</span>
            {l.note && <span className={`text-xs ${MUTED}`}>{l.note}</span>}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* ── 8. Chips — a bounded set of options: vehicle types, categories, states. ── */
export function Chips({
  items,
  caption,
  accent = 'amber',
}: {
  items: string[];
  caption?: string;
  accent?: Accent;
}) {
  return (
    <Frame accent={accent} caption={caption}>
      <div className="flex flex-wrap gap-2">
        {items.map((label) => (
          <span
            key={label}
            className={`inline-flex items-center gap-2 rounded-full border border-[#E5E5EB] bg-white px-3 py-1.5 text-xs dark:border-[#2E2E36] dark:bg-[#16161A] ${STRONG}`}
          >
            <span className="size-1.5 rounded-full bg-[var(--a)]" />
            {label}
          </span>
        ))}
      </div>
    </Frame>
  );
}

/* ── 9. PlatformGrid — the apps a driver runs. Platforms/reference. ── */
const PLATFORM_COLORS: Record<string, string> = {
  DoorDash: '#ff3008',
  'Uber Eats': '#142328',
  Foodora: '#e2006a',
  SkipTheDishes: '#f96302',
  Instacart: '#43b02a',
  'Amazon Flex': '#ff9900',
  Other: '#6b7280',
};

export function PlatformGrid({ caption }: { caption?: string }) {
  return (
    <Frame caption={caption}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(PLATFORM_COLORS).map(([name, color]) => (
          <span
            key={name}
            className="inline-flex items-center gap-2 rounded-full border border-[#E5E5EB] bg-white px-3 py-1.5 text-xs dark:border-[#2E2E36] dark:bg-[#16161A]"
          >
            <span className="size-2 rounded-full ring-1 ring-black/10 dark:ring-white/20" style={{ background: color }} />
            <span className={STRONG}>{name}</span>
          </span>
        ))}
      </div>
    </Frame>
  );
}
