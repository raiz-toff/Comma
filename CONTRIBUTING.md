# Contributing

## Setup

```bash
npm install
npx expo start
```

## Read AGENTS.md first

[`AGENTS.md`](./AGENTS.md) is the contract for this repository — for people and for AI coding
agents alike. It is short. The three rules that matter most:

1. **Comma is two apps sharing one vault.** The phone app (`src/`, `app/`) and the web PWA
   (`web/src/`) read and write each other's files, and *nothing checks that they agree at
   compile time*. If you change sync, database schema, the crypto envelope, or the country
   registry, the twin file in the other app has to be handled too — otherwise it breaks at
   the user's data rather than at the build.
2. **Version numbers come from `node scripts/version.mjs`.** Never hand-edit them.
3. **Every user-visible change gets a `CHANGELOG.md` entry in the same commit.** That file is
   published as the `/changelog` page on the docs site.

## Rules

- No `any` types
- All DB aggregations in Drizzle SQL — no `.reduce()` or `.filter()` on full arrays in JS
- Use `expo-image`, not React Native's `<Image>`
- Use the design tokens — never invent a hex value, shadow, or spacing number
- No `console.log` in commits
- Docs live in `docs/`; `docs-site/content/` is generated, so don't edit it

## PRs

One thing per PR. Open an issue first if it's a big change so we can discuss before you
build it.

Run the same checks CI does before opening a PR:

```bash
npm run verify   # typecheck + version sites agree + phone/web country registries agree
```
