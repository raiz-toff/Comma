// Generates Fumadocs content from the repo's markdown so `docs/*.md` stays the
// single source of truth and renders on GitHub as-is.
//
// For each docs/<section>/<page>.md it writes content/docs/<section>/<page>.mdx:
//   - the leading "# Heading" becomes frontmatter `title` (Fumadocs renders it)
//   - the first paragraph becomes frontmatter `description`
//   - ".md" is stripped from relative links so extensionless routes resolve
//   - emoji are removed (house style: none)
// Section order and the sidebar come from _meta.json files generated from TREE.
//
// It also vendors ../CHANGELOG.md to lib/changelog.md so the /changelog page
// builds even when docs-site is deployed in isolation (no repo root available).
//
// HAND_AUTHORED pages below are the deliberate exception: their content/docs/*.mdx
// is not derived from docs/*.md at all. It is vendored as-is from a file under
// content/custom/ (which this script's `rm(OUT, ...)` never touches) because that
// page's design intentionally broke from the "docs/*.md is the single source,
// GitHub renders it as-is" contract — see AGENTS.md §4 and the FAQ page.
// docs/getting-started/faq.md still exists and still renders on GitHub; it is
// simply no longer what the live site's /docs/getting-started/faq page shows.

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DOCS_ROOT = path.resolve(__dirname, '../docs-src'); // vendored fallback
const SRC = existsSync(path.join(REPO_ROOT, 'docs')) ? path.join(REPO_ROOT, 'docs') : DOCS_ROOT;
const OUT = path.resolve(__dirname, '../content/docs');

// Sidebar structure. Order here is the order shown; titles label the sections.
const TREE = [
  {
    dir: 'getting-started',
    title: 'Getting Started',
    pages: ['introduction', 'quick-start', 'core-concepts', 'faq', 'troubleshooting'],
  },
  {
    dir: 'features',
    title: 'Features',
    pages: [
      'shift-tracking',
      'mileage-tracking',
      'expenses',
      'tax-center',
      'goals-and-gamification',
      'vehicles',
      'analytics-and-reports',
      'platforms',
      'web-app',
    ],
  },
  {
    dir: 'guides',
    title: 'How-to Guides',
    pages: ['install', 'demo-mode', 'moving-devices', 'import-csv'],
  },
  {
    dir: 'backup-and-sync',
    title: 'Backup & Sync',
    pages: ['overview', 'google-drive-backup', 'cloud-sync', 'encryption', 'moving-devices', 'fixing-google-drive-connection'],
  },
  {
    dir: 'reference',
    title: 'Reference',
    pages: ['settings', 'shift-fields', 'expense-fields', 'backup-format', 'feature-flags', 'platforms', 'countries', 'notifications', 'keyboard-shortcuts'],
  },
  {
    dir: 'architecture',
    title: 'Architecture',
    pages: ['overview', 'database', 'state-management', 'navigation', 'gps-engine'],
  },
  {
    dir: 'development',
    title: 'Development',
    pages: ['setup', 'project-structure', 'environment-variables', 'native-module', 'releasing', 'contributing', 'adding-a-country', 'adding-a-province'],
  },
];

// Remove emoji, pictographs, and flags. Deliberately KEEPS typographic marks that
// the docs use in prose: arrows (U+2190-21FF, e.g. "Settings -> Data" as an arrow)
// and technical symbols (U+2300-23FF, e.g. the Command key). Keeps text and $/%.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

function stripEmoji(s) {
  return s.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/ +$/gm, '');
}

// MDX reads "<" as a JSX tag. Prose like "<1%" or "<5 km/h" breaks compilation.
// Escape a "<" followed by a digit or space, but only outside fenced ``` blocks
// and inline `code` spans, where "<" is literal.
function escapeAngles(md) {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((block, i) => {
      if (i % 2 === 1) return block; // fenced code — untouched
      return block
        .split(/(`[^`]*`)/g)
        .map((seg, j) => (j % 2 === 1 ? seg : seg.replace(/<(?=[\s\d])/g, '&lt;')))
        .join('');
    })
    .join('');
}

// section/slug -> vendored file, copied verbatim instead of generated. See note above main().
const HAND_AUTHORED = {
  'getting-started/faq': path.resolve(__dirname, '../content/custom/faq.mdx'),
};

const GITHUB_BLOB = 'https://github.com/raiz-toff/Comma/blob/main';
// Images must resolve to raw file bytes — a /blob/ URL serves an HTML page and
// renders as a broken <img> on the site.
const GITHUB_RAW = 'https://raw.githubusercontent.com/raiz-toff/Comma/main';
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

// Map a docs-relative markdown path to its published route.
function routeFor(docPath) {
  const clean = docPath.replace(/\.md$/i, '');
  if (clean === 'index') return '/docs';
  if (clean === 'privacy') return '/privacy';
  if (clean === 'delete-data') return '/delete-data';
  return `/docs/${clean}`;
}

// Resolve every relative link to an ABSOLUTE url at build time. Relative hrefs
// resolve against the page URL in the browser, which does not mirror the file
// tree (the /docs index would send "./getting-started/x" to /getting-started/x),
// so relative links must not survive into the output.
//   - links to docs/*.md            -> absolute site route (+anchor)
//   - links that escape docs/ or hit a non-page file -> GitHub blob URL
// `dirRel` is the source file's directory relative to docs/ ('' for the root).
function resolveLinks(md, dirRel) {
  return md.replace(/\]\(([^)\s]+)\)/g, (m, target) => {
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('#') || target.startsWith('/')) return m;
    const [file, anchor] = target.split('#');
    const resolved = path.posix.normalize(path.posix.join(dirRel, file));

    // Escapes docs/ -> a repository file.
    if (resolved.startsWith('..')) {
      const repoPath = path.posix.normalize(path.posix.join('docs', dirRel, file));
      const host = IMAGE_RE.test(file) ? GITHUB_RAW : GITHUB_BLOB;
      return `](${host}/${repoPath.replace(/^(\.\.\/)+/, '')})`;
    }
    // A docs page.
    if (/\.md$/i.test(resolved)) {
      return `](${routeFor(resolved)}${anchor ? `#${anchor}` : ''})`;
    }
    // A non-page file. Prefer the repo root if it exists there (authors often
    // write src/... or package.json meaning the repository, not docs/).
    // docs/images/** is copied into the site's public/ by main(), so those
    // references stay local — remote URLs would 404 at build time until the
    // commit that adds them is pushed (remark-image fetches them for sizing).
    if (IMAGE_RE.test(file) && resolved.startsWith('images/')) {
      return `](/${resolved})`;
    }
    const fromRoot = path.posix.normalize(file);
    const host = IMAGE_RE.test(file) ? GITHUB_RAW : GITHUB_BLOB;
    if (existsSync(path.join(REPO_ROOT, fromRoot))) return `](${host}/${fromRoot})`;
    return `](${host}/docs/${resolved})`;
  });
}

function yamlEscape(s) {
  return s.replace(/"/g, '\\"');
}

// Page description = the first sentence of the intro paragraph. Never cut a
// word in half; if even one sentence is too long, trim at a word boundary.
function summarize(text, max = 200) {
  const clean = text.trim();
  const sentence = clean.match(/^.{20,}?[.!?](?=\s|$)/);
  let out = (sentence ? sentence[0] : clean).trim();
  if (out.length > max) {
    out = out.slice(0, max);
    const cut = out.lastIndexOf(' ');
    out = (cut > 0 ? out.slice(0, cut) : out) + '…';
  }
  return out;
}

// Split "# Title" + first paragraph out of the body -> { title, description, body }.
function parse(md) {
  const lines = md.split('\n');
  let title = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1].replace(/^Comma\s*[—-]\s*/i, '').trim();
      i++;
      break;
    }
    if (lines[i].trim() !== '') break; // content before any H1 -> no title extraction
  }
  // Skip blank lines, then take the first prose paragraph as the description.
  while (i < lines.length && lines[i].trim() === '') i++;
  let description = '';
  if (i < lines.length && !/^[#>\-*|`]/.test(lines[i]) && !lines[i].startsWith('---')) {
    const buf = [];
    for (; i < lines.length && lines[i].trim() !== ''; i++) buf.push(lines[i].trim());
    description = buf.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // drop link syntax
  }
  const body = lines.slice(i).join('\n').replace(/^\n+/, '');
  return { title, description, body };
}

async function writeFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  // Vendor docs/images into the site's public dir (git-ignored, regenerated
  // every sync) so image references in the docs resolve locally at build time.
  const IMG_SRC = path.join(SRC, 'images');
  const IMG_OUT = path.resolve(__dirname, '../public/images');
  await fs.rm(IMG_OUT, { recursive: true, force: true });
  if (existsSync(IMG_SRC)) await fs.cp(IMG_SRC, IMG_OUT, { recursive: true });

  // Root landing of the /docs tree.
  const rootMeta = { title: 'Documentation', pages: [] };

  for (const section of TREE) {
    const inDir = path.join(SRC, section.dir);
    if (!existsSync(inDir)) continue;

    const present = [];
    for (const slug of section.pages) {
      const handAuthored = HAND_AUTHORED[`${section.dir}/${slug}`];
      if (handAuthored) {
        await writeFile(path.join(OUT, section.dir, `${slug}.mdx`), await fs.readFile(handAuthored, 'utf8'));
        present.push(slug);
        continue;
      }
      const srcFile = path.join(inDir, `${slug}.md`);
      if (!existsSync(srcFile)) continue;
      const raw = stripEmoji(await fs.readFile(srcFile, 'utf8'));
      const { title, description, body } = parse(raw);
      const fm = ['---', `title: "${yamlEscape(title || slug)}"`];
      if (description) fm.push(`description: "${yamlEscape(summarize(description))}"`);
      fm.push('---', '');
      await writeFile(path.join(OUT, section.dir, `${slug}.mdx`), fm.join('\n') + escapeAngles(resolveLinks(body, section.dir)) + '\n');
      present.push(slug);
    }
    if (present.length === 0) continue;

    await writeFile(
      path.join(OUT, section.dir, 'meta.json'),
      JSON.stringify({ title: section.title, pages: present }, null, 2) + '\n',
    );
    rootMeta.pages.push(section.dir);
  }

  // Root index page for /docs.
  const indexBody = existsSync(path.join(SRC, 'index.md'))
    ? parse(stripEmoji(await fs.readFile(path.join(SRC, 'index.md'), 'utf8')))
    : { title: 'Documentation', description: '', body: '' };
  await writeFile(
    path.join(OUT, 'index.mdx'),
    ['---', 'title: "Documentation"', `description: "${yamlEscape(indexBody.description || 'Comma documentation')}"`, '---', '', escapeAngles(resolveLinks(indexBody.body, ''))].join('\n') + '\n',
  );
  rootMeta.pages.unshift('index');
  await writeFile(path.join(OUT, 'meta.json'), JSON.stringify(rootMeta, null, 2) + '\n');

  // Vendor the legal pages for the /privacy and /delete-data routes. These URLs
  // are load-bearing: the Play Store listing and both apps link to them.
  for (const slug of ['privacy', 'delete-data']) {
    const f = path.join(SRC, `${slug}.md`);
    if (existsSync(f)) {
      const raw = stripEmoji(await fs.readFile(f, 'utf8'));
      await writeFile(path.resolve(__dirname, `../lib/legal/${slug}.md`), resolveLinks(raw, ''));
    }
  }

  // Vendor the changelog for the /changelog route.
  const clSrc = existsSync(path.join(REPO_ROOT, 'CHANGELOG.md'))
    ? path.join(REPO_ROOT, 'CHANGELOG.md')
    : path.resolve(__dirname, '../changelog-src.md');
  if (existsSync(clSrc)) {
    await writeFile(path.resolve(__dirname, '../lib/changelog.md'), stripEmoji(await fs.readFile(clSrc, 'utf8')));
  }

  console.log(`[comma-docs] synced ${rootMeta.pages.length - 1} sections -> content/docs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
