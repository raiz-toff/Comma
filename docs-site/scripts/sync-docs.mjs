// Generates docs-site/pages/ from ../docs so the markdown stays the single
// source of truth. Run automatically before `dev` and `build`.
//
// What it does:
//   1. Copies every .md file from ../docs into ./pages (as .mdx).
//   2. Strips ".md" from relative links so Nextra's extensionless routes resolve.
//   3. Writes _meta.json files so the sidebar order + titles are intentional
//      (matching docs/index.md) rather than alphabetical.

import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Docs live at the repo root (../../docs) for local dev, but isolated deploys
// (e.g. Vercel with docs-site as the root) only have the docs-site/ tree. In
// that case fall back to a vendored copy at docs-site/docs-src, kept in sync by
// `npm run vendor-docs`. Prefer the repo-root copy when it exists.
const REPO_DOCS = path.resolve(__dirname, "../../docs");
const VENDORED_DOCS = path.resolve(__dirname, "../docs-src");
const DOCS_SRC = existsSync(REPO_DOCS) ? REPO_DOCS : VENDORED_DOCS;
const PAGES_OUT = path.resolve(__dirname, "../pages");

// Section order + display names, mirroring docs/index.md. Page order within a
// section is taken from here; titles are read from each file's first heading.
const TREE = [
  { dir: "getting-started", title: "Getting Started", pages: ["introduction", "quick-start", "core-concepts"] },
  { dir: "features",        title: "Features",        pages: ["shift-tracking", "mileage-tracking", "expenses", "tax-center", "goals-and-gamification", "vehicles", "analytics-and-reports", "platforms"] },
  { dir: "backup-and-sync", title: "Backup & Sync",   pages: ["overview", "google-drive-backup", "cloud-sync", "encryption"] },
  { dir: "architecture",    title: "Architecture",    pages: ["overview", "database", "state-management", "navigation", "gps-engine"] },
  { dir: "development",     title: "Development",      pages: ["setup", "project-structure", "environment-variables", "native-module", "contributing"] },
];

// Top-level pages that live at docs/<slug>.md and publish to /<slug> (not in a
// section). Kept out of the sidebar via `display: "hidden"` in the root meta —
// they're linked directly (e.g. the Play Store privacy policy URL).
const ROOT_PAGES = [
  { slug: "privacy", title: "Privacy Policy" },
  { slug: "delete-data", title: "Data Deletion Request" },
];

// Strip ".md" from relative markdown links: [x](./a/b.md) → [x](./a/b),
// and keep anchors: [x](./a.md#sec) → [x](./a#sec).
function rewriteLinks(md) {
  return md.replace(/\]\(([^)]+)\)/g, (match, target) => {
    if (/^[a-z]+:\/\//i.test(target)) return match; // external URL
    const cleaned = target.replace(/\.md(#|$)/i, "$1");
    return `](${cleaned})`;
  });
}

// MDX parses "<" as the start of a JSX tag. Prose like "<1%" or "<1 second"
// breaks compilation. Escape a "<" that's followed by a digit or space, but
// only outside fenced ``` blocks and inline `code` spans (where "<" is literal).
function escapeAngles(md) {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((block, i) => {
      if (i % 2 === 1) return block; // fenced code block — untouched
      return block
        .split(/(`[^`]*`)/g)
        .map((seg, j) => (j % 2 === 1 ? seg : seg.replace(/<(?=[\s\d])/g, "&lt;")))
        .join("");
    })
    .join("");
}

function processMd(raw) {
  return escapeAngles(rewriteLinks(raw));
}

// Nextra v3 (pages router) requires a custom App that imports the theme stylesheet.
const APP_TSX = `import type { AppProps } from "next/app";
import "nextra-theme-docs/style.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`;

function titleFromMarkdown(md, fallback) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  if (!m) return fallback;
  // Drop any "Comma — " prefix and trailing " — subtitle" so sidebar labels stay short.
  return m[1].replace(/^Comma\s*[—-]\s*/i, "").split(/\s+[—-]\s+/)[0].trim();
}

function titleize(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Nextra 3.3+ expects _meta.{js,ts} exporting the config as default.
function metaModule(obj) {
  return `export default ${JSON.stringify(obj, null, 2)};\n`;
}

async function read(file) {
  return fs.readFile(file, "utf8");
}

async function writeFileMkdir(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function main() {
  // Fresh output each run.
  await fs.rm(PAGES_OUT, { recursive: true, force: true });
  await fs.mkdir(PAGES_OUT, { recursive: true });

  // Nextra v3 requires a custom App component in pages/.
  await writeFileMkdir(path.join(PAGES_OUT, "_app.tsx"), APP_TSX);

  // Root landing page from docs/index.md.
  const indexMd = await read(path.join(DOCS_SRC, "index.md"));
  await writeFileMkdir(path.join(PAGES_OUT, "index.mdx"), processMd(indexMd));

  // Top-level sidebar order.
  const rootMeta = { index: "Home" };
  for (const section of TREE) rootMeta[section.dir] = section.title;
  // Root-level standalone pages: published but hidden from the sidebar.
  for (const { slug, title } of ROOT_PAGES) {
    rootMeta[slug] = { title, display: "hidden" };
  }
  await writeFileMkdir(path.join(PAGES_OUT, "_meta.js"), metaModule(rootMeta));

  // Emit each root-level standalone page.
  for (const { slug } of ROOT_PAGES) {
    const srcFile = path.join(DOCS_SRC, `${slug}.md`);
    try {
      const raw = await read(srcFile);
      await writeFileMkdir(path.join(PAGES_OUT, `${slug}.mdx`), processMd(raw));
    } catch {
      console.warn(`⚠ missing: docs/${slug}.md — skipping`);
    }
  }

  let count = 1;
  for (const section of TREE) {
    const sectionMeta = {};
    for (const slug of section.pages) {
      const srcFile = path.join(DOCS_SRC, section.dir, `${slug}.md`);
      let raw;
      try {
        raw = await read(srcFile);
      } catch {
        console.warn(`⚠ missing: docs/${section.dir}/${slug}.md — skipping`);
        continue;
      }
      const title = titleFromMarkdown(raw, titleize(slug));
      sectionMeta[slug] = title;
      await writeFileMkdir(path.join(PAGES_OUT, section.dir, `${slug}.mdx`), processMd(raw));
      count++;
    }
    await writeFileMkdir(path.join(PAGES_OUT, section.dir, "_meta.js"), metaModule(sectionMeta));
  }

  console.log(`✓ synced ${count} pages from docs/ → docs-site/pages/`);
}

main().catch((e) => {
  console.error("sync-docs failed:", e);
  process.exit(1);
});
