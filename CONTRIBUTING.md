# Contributing

## Setup

```bash
npm install
npx expo start
```

## Rules

- No `any` types
- All DB aggregations in Drizzle SQL — no `.reduce()` or `.filter()` on full arrays in JS
- Use `expo-image`, not React Native's `<Image>`
- No `console.log` in commits

## PRs

One thing per PR. Open an issue first if it's a big change so we can discuss before you build it.

Run `npx tsc --noEmit` before opening a PR.
