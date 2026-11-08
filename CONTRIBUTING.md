# Contributing

## Setup

```bash
npm install
npx expo start
```

## Read AGENTS.md first

[`AGENTS.md`](./AGENTS.md) is the contract for this repository — for people and for AI coding
agents alike. It is short. The three rules that matter most:

1. **Old vaults must keep opening.** Drivers' Google Drive files were written by older app
   versions. If you change sync, the database schema, the crypto envelope, or the country
   registry, make sure older files and older app versions still work — otherwise it breaks
   at the user's data rather than at the build.
2. **Version numbers come from `node scripts/version.mjs`.** Never hand-edit them.
3. **Every user-visible change gets a `CHANGELOG.md` entry in the same commit.**

## Rules

- No `any` types
- All DB aggregations in Drizzle SQL — no `.reduce()` or `.filter()` on full arrays in JS
- Use `expo-image`, not React Native's `<Image>`
- Use the design tokens — never invent a hex value, shadow, or spacing number
- No `console.log` in commits
- Developer docs live in `docs/development/`

## PRs

One thing per PR. Open an issue first if it's a big change so we can discuss before you
build it.

Run the same checks CI does before opening a PR:

```bash
npm run verify   # typecheck + version sites agree
```
