# comma-docs

The documentation site for Comma, published at [comma-docs.vercel.app](https://comma-docs.vercel.app). Built with [Fumadocs](https://fumadocs.dev) on Next.js.

## Source of truth

Page content lives in the repo's top-level [`docs/`](../docs) directory as plain Markdown, so it also renders on GitHub. `scripts/sync-content.mjs` generates the Fumadocs content tree from it before every `dev` and `build`:

- `docs/<section>/<page>.md` → `content/docs/<section>/<page>.mdx`
- the leading `# Heading` becomes the page title; the first paragraph becomes its description
- `_meta.json` files are generated from the `TREE` array in the sync script, which defines section order and the sidebar
- emoji are stripped (house style: none)

To add or reorder pages, edit the Markdown in `docs/` and the `TREE` in `scripts/sync-content.mjs`.

## Changelog

`/changelog` is generated from the repo's [`CHANGELOG.md`](../CHANGELOG.md), which the sync step vendors to `lib/changelog.md` and `lib/changelog.ts` parses.

## Develop

```bash
npm install
npm run dev     # runs sync, then next dev
npm run build   # runs sync, then next build
```
