# Contributing to COMMA

Thanks for your interest in contributing to COMMA! This guide will help you get set up and understand the project's conventions.

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (only needed for the build tool)
- A modern browser (Chrome, Firefox, Safari, Edge)

### Setup

```bash
git clone https://github.com/raiz-toff/comma.git
cd comma
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or use `npm run preview` after a production build).

### Build COMMAnds

| COMMAnd | Description |
|---------|-------------|
| `npm run dev` | Watch mode — rebuilds on every file change |
| `npm run build` | Production build (minified, fingerprinted) |
| `npm run preview` | Serve the `dist/` folder locally |
| `npm run rebuild:provinces` | Regenerate `src/registry/provinces/index.js` after adding province files |

---

## Project Conventions

### Architecture

COMMA is a **vanilla JS** single-page app — no React, no Vue, no framework. Everything is ES2022 modules bundled by esbuild into a single IIFE.

The key architectural pattern is the **Registry Pattern**: platforms, countries, provinces, widgets, and other extensible features are defined as data files that the engine reads. The engine never hardcodes specific platform or country names.

> **Read first:** [`docs/Registry_arch.md`](docs/Registry_arch.md) and [`docs/feature_modularity.md`](docs/feature_modularity.md)

### Code Style

- **Vanilla JS** — no TypeScript, no JSX, no framework abstractions
- **ES2022 modules** — `import` / `export`, no CommonJS in `src/`
- **Vanilla CSS** with custom properties — no Tailwind, no preprocessors
- **Local-first** — all data lives in IndexedDB via Dexie.js. Zero server calls.
- **Vendored libraries** — all runtime dependencies live in `src/libs/`. No CDN at runtime.

### File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Platform definition | `{id}.platform.js` | `doordash.platform.js` |
| Country definition | `{ISO}.country.js` | `CA.country.js` |
| Province definition | `{CODE}.province.js` | `ON.province.js` |
| Widget definition | `{name}.widget.js` | `streak.widget.js` |
| View (route page) | `{name}-view.js` | `shifts-view.js` |
| CSS per-view | `{name}.css` in `src/css/views/` | `dashboard.css` |

---

## How to Add Things

These guides walk you through extending COMMA without modifying the engine:

- **[Add a platform](docs/adding-a-platform.md)** — one definition file + one import line
- **[Add a country](docs/adding-a-country.md)** — one definition file + one import line
- **[Add a province/state](docs/adding-a-province.md)** — one definition file + `npm run rebuild:provinces`

---

## Pull Requests

1. **Fork** the repo and create a feature branch from `main`
2. Make your changes — keep commits focused and descriptive
3. Run `npm run build` and make sure it succeeds with no errors
4. Open a PR with a clear description of what changed and why

### Commit Messages

Use conventional-style prefixes:

```
feat: add British Columbia province definition
fix: correct HST rate calculation for Ontario
refactor: simplify widget render lifecycle
docs: update adding-a-platform guide
style: align shift card padding
```

---

## Reporting Bugs

Open an issue with:

1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Browser and OS info

Since COMMA is local-first, no server logs exist — include screenshots or browser console output when possible.

---

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Questions?

Open a [Discussion](https://github.com/raiz-toff/comma/discussions) or an issue — happy to help.
