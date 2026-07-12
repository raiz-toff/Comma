import type { ReactNode } from 'react';

// Minimal markdown renderer for the standalone legal pages (/privacy,
// /delete-data). Supports exactly what those documents use: h1-h3, paragraphs,
// unordered lists, horizontal rules, bold, italics, inline code, and links.
// Doc pages proper go through fumadocs-mdx; this is only for pages that must
// live at stable root URLs outside the /docs tree.

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) nodes.push(<strong key={key++}>{m[1]}</strong>);
    else if (m[2]) nodes.push(<em key={key++}>{m[2]}</em>);
    else if (m[3]) nodes.push(<code key={key++} className="rounded bg-fd-muted px-1.5 py-0.5 text-[0.85em]">{m[3]}</code>);
    else if (m[4]) nodes.push(<a key={key++} href={m[5]} className="text-fd-primary underline underline-offset-2">{m[4]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function SimpleMarkdown({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '' ) { i++; continue; }
    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-8 border-fd-border" />);
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? 'text-3xl font-semibold tracking-tight text-fd-foreground'
          : level === 2
            ? 'mt-10 text-xl font-semibold tracking-tight text-fd-foreground'
            : 'mt-6 text-base font-semibold text-fd-foreground';
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={key++} className={cls}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-4 list-disc space-y-1.5 pl-6 text-fd-muted-foreground">
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </ul>,
      );
      continue;
    }
    // paragraph: gather until blank line
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|[-*]\s|---)/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="my-4 leading-relaxed text-fd-muted-foreground">{inline(buf.join(' '))}</p>,
    );
  }

  return <>{blocks}</>;
}
