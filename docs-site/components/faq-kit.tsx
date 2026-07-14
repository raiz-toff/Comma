'use client';

/**
 * Bespoke component kit for the hand-authored FAQ page
 * (content/custom/faq.mdx — see AGENTS.md §4 and docs-site/scripts/sync-content.mjs).
 *
 * This page opted out of the "one visual from doc-visuals.tsx, rest is
 * markdown" house style, so it gets its own small kit instead of raw div
 * soup in the mdx body. Same brand palette as doc-visuals.tsx (no invented
 * colors) — a search box and accordions, nothing the shared kit covers.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const SURFACE = 'rounded-xl border border-[#E5E5EB] bg-[#FCFCFD] dark:border-[#26262C] dark:bg-[#0A0A0C]';
const MUTED = 'text-[#53535A] dark:text-[#9B9BA4]';
const STRONG = 'text-[#0E0E11] dark:text-[#F6F6F7]';
const DIVIDER = 'border-[#E5E5EB] dark:border-[#26262C]';
const ACCENT_VARS = { '--a': '#15803D' } as CSSProperties;
const ACCENT_CLASS = 'dark:[--a:#22c55e]';

export function FaqSearch() {
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    setShown(document.querySelectorAll('[data-faq-item]').length);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    const needle = value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll<HTMLElement>('[data-faq-item]').forEach((el) => {
      const match = needle === '' || (el.textContent ?? '').toLowerCase().includes(needle);
      el.style.display = match ? '' : 'none';
      if (match) visible += 1;
    });
    document.querySelectorAll<HTMLElement>('[data-faq-section]').forEach((section) => {
      const anyVisible = Array.from(section.querySelectorAll<HTMLElement>('[data-faq-item]')).some(
        (el) => el.style.display !== 'none',
      );
      section.style.display = anyVisible ? '' : 'none';
    });
    setShown(visible);
  }

  return (
    <div style={ACCENT_VARS} className={`not-prose mb-8 ${ACCENT_CLASS}`}>
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 ${MUTED}`}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search the FAQ…"
          aria-label="Search the FAQ"
          className={`w-full ${SURFACE} px-10 py-2.5 text-sm ${STRONG} outline-none transition-colors focus:border-[var(--a)]`}
        />
      </div>
      {query.trim() !== '' && (
        <p className={`mt-2 text-xs ${MUTED}`}>
          {shown === 0 ? 'No questions match — try a different word.' : `${shown} question${shown === 1 ? '' : 's'} match.`}
        </p>
      )}
    </div>
  );
}

export function FaqNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="Jump to section" style={ACCENT_VARS} className={`not-prose mb-10 flex flex-wrap gap-2 ${ACCENT_CLASS}`}>
      {items.map((it) => (
        <a
          key={it.id}
          href={`#${it.id}`}
          className={`rounded-full border ${DIVIDER} px-3.5 py-1.5 text-xs font-medium ${STRONG} transition-colors hover:border-[var(--a)] hover:text-[var(--a)]`}
        >
          {it.label}
        </a>
      ))}
    </nav>
  );
}

export function FaqSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} data-faq-section className="not-prose mb-10 scroll-mt-24">
      <h2 className={`mb-3 text-lg font-semibold ${STRONG}`}>{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details data-faq-item className={`group ${SURFACE} p-4 [&::-webkit-details-marker]:hidden`}>
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium ${STRONG}`}>
        {q}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 ${MUTED}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className={`mt-3 text-sm leading-relaxed ${MUTED}`}>{children}</div>
    </details>
  );
}

export function ModeCard({ title, tone, children }: { title: string; tone: 'default' | 'accent'; children: ReactNode }) {
  return (
    <div
      style={tone === 'accent' ? ACCENT_VARS : undefined}
      className={`rounded-lg border ${DIVIDER} p-3 ${tone === 'accent' ? ACCENT_CLASS : ''}`}
    >
      <div className={`text-xs font-semibold ${tone === 'accent' ? 'text-[var(--a)]' : STRONG}`}>{title}</div>
      {/* MDX auto-wraps block text children in their own <p> — a <p> here would nest. */}
      <div className={`mt-1 text-xs leading-relaxed ${MUTED}`}>{children}</div>
    </div>
  );
}

export function CompareTable({ rows }: { rows: { label: string; phone: string; web: string }[] }) {
  return (
    <div className={`not-prose my-6 overflow-hidden ${SURFACE}`}>
      <div className={`grid grid-cols-[1fr_auto_auto] gap-x-4 border-b ${DIVIDER} px-5 py-3 text-[0.65rem] font-semibold uppercase tracking-wide ${MUTED}`}>
        <span />
        <span className="w-28 text-center">Phone app</span>
        <span className="w-28 text-center">Web app</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-5 py-3 text-sm ${i !== rows.length - 1 ? `border-b ${DIVIDER}` : ''}`}
        >
          <span className={STRONG}>{r.label}</span>
          <span className={`w-28 text-center text-xs ${MUTED}`}>{r.phone}</span>
          <span className={`w-28 text-center text-xs ${MUTED}`}>{r.web}</span>
        </div>
      ))}
    </div>
  );
}

export function NextSteps({ items }: { items: { href: string; title: string; description: string }[] }) {
  return (
    <div style={ACCENT_VARS} className={`not-prose grid gap-3 sm:grid-cols-3 ${ACCENT_CLASS}`}>
      {items.map((it) => (
        <a key={it.href} href={it.href} className={`group ${SURFACE} p-4 transition-colors hover:border-[var(--a)]`}>
          <div className={`text-sm font-semibold ${STRONG} group-hover:text-[var(--a)]`}>{it.title}</div>
          <p className={`mt-1 text-xs leading-relaxed ${MUTED}`}>{it.description}</p>
        </a>
      ))}
    </div>
  );
}
