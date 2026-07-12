import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getReleases } from '@/lib/changelog';
import { androidReleaseUrl } from '@/lib/shared';

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

export default function ChangelogPage() {
  const releases = getReleases();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16 md:py-24">
      <header className="mb-14">
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
        {/* the spine */}
        <div className="absolute left-0 top-2 bottom-2 hidden w-px bg-fd-border sm:block" aria-hidden />

        <ol className="space-y-16">
          {releases.map((r) => (
            <li key={r.version} className="relative sm:pl-8">
              <span
                className="absolute left-[-4px] top-1.5 hidden size-2 rounded-full bg-fd-primary ring-4 ring-fd-background sm:block"
                aria-hidden
              />
              <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-fd-foreground">
                  {r.version}
                </h2>
                {r.date && <time className="text-sm text-fd-muted-foreground">{r.date}</time>}
                {r.build && (
                  <span className="rounded border border-fd-border px-2 py-0.5 text-xs text-fd-muted-foreground">
                    {r.build}
                  </span>
                )}
              </div>

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
            </li>
          ))}
        </ol>
      </div>

      {releases.length === 0 && (
        <p className="text-fd-muted-foreground">No releases recorded yet.</p>
      )}
    </main>
  );
}
