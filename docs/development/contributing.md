# Contributing

Thanks for contributing to Comma. This document covers the conventions, patterns, and process across both apps in the monorepo.

<Chips accent="emerald" items={["feat", "fix", "refactor", "docs", "test", "chore"]} caption="Conventional Commits, strict TypeScript, no any. Adding a country or a platform is data in two mirrored registries — phone and web — never new logic." />

---

## Code style

### TypeScript (phone app)

- **Strict mode.** No `any`. `tsconfig.json` sets `strict: true`. If a type is genuinely dynamic, use `unknown` and narrow it.
- **No type assertions without justification.** `as SomeType` is acceptable when feeding output from a runtime source (e.g. SQLite results); document why if it is non-obvious.
- **Prefer `type` over `interface`** for data shapes; use `interface` only when you need declaration merging.

### Database

- **All queries in `src/database/queries/`.** No raw SQL in screens or hooks.
- **No array-level filtering of DB results.** If it can be a `WHERE` or a `JOIN`, write it as one. Fetching 10,000 rows to keep 10 is a performance bug.
- **Mutations via `syncedInsert` / `syncedUpdate` / `syncedDelete`** (`src/database/syncedWrites.ts`). They stamp `syncUpdatedAt` automatically. Direct `db.insert()` / `db.update()` are only acceptable on tables that are not synced (`locationPoints`, `tempNativePoints`, `settings`, `syncOverwriteLog`).
- **Soft deletes on synced tables.** Call `syncedDelete()`; never a hard `DELETE` on a synced table, or the tombstone is lost and the row resurrects on the next sync.

### React components

- **Function components only.** No class components.
- **Hooks for logic, components for rendering.** Extract non-trivial logic to a custom hook before a component grows long.
- **NativeWind for styles.** Use Tailwind classes; avoid raw `StyleSheet.create` unless you have a reason (e.g. complex animation).
- **No inline `style={{}}`** except for dynamic values.

### State

- **React Query for async data**, Zustand for synchronous global state only, `useState` for local component state. The two stores are `useActiveShift` and `useSettingsStore` — add to them sparingly. See [State Management](../architecture/state-management.md).

### Naming

- **Files:** `PascalCase.tsx` for components, `camelCase.ts` otherwise.
- **Hooks:** `use` prefix — `useActiveShift`, `useGPSTracking`.
- **Query keys:** string arrays — `["shifts", "recent"]`, `["analytics", "today"]`.

---

## Comments

Default to **no comments**. Write self-documenting code and add a comment only when the *why* is non-obvious:

```ts
// GPS jitter: >150 km/h implies a spike, not real movement
if (impliedSpeedKmH > 150) continue
```

Do not add comments that restate what the code does.

---

## Adding a supported country

Comma ships **Canada only**. Earlier US, UK, and Nepal definitions were **removed** pending accurate, signed-off tax and mileage numbers — the app must never offer a country whose rules haven't been verified. Nothing in the app branches on the country id; every tax, mileage, currency, and onboarding path reads from the country definition, so adding a market is writing one new definition file per app, not new logic.

A country is **one registry file per app**, and both must agree.

1. **Write the phone definition** at `src/registry/countries/<CC>/index.ts` (a directory: `index.ts`, plus `provinces/` and `tax/` as needed). It must define:
   - `currency` and `symbol`
   - `distanceUnit` (`km` or `mi`)
   - `tax` rules (default withholding, region preset type, region label, and so on)
   - `mileage` — a rate table, or explicitly `null` for "no researched rates" (the key must be present, so a new country makes a deliberate choice)
   - `defaultAvailablePlatforms`
2. **Write the web definition** at `web/src/registry/countries/<CC>.country.js` with the same fields (see `web/src/registry/countries/_TEMPLATE.country.js`).
3. **Register it on both sides.** This is the step that actually turns a country on:
   - phone: add it to `COUNTRY_MAP` in `src/registry/countries/index.ts`, and add its regions to `ALL_REGIONS`
   - web: add it to the `COUNTRIES` array in `web/src/registry/countries/index.js`
4. **Keep the two in parity.** Run `node scripts/check-country-parity.mjs` — it verifies the phone and web registries define the same countries with matching shapes. A country registered on one app but not the other, or with mismatched fields, fails the check.

The registries fail loudly on a half-added country: `assertCountryRegistryValid()` throws if a registered country is missing a required field, and an unregistered country requested at runtime logs an error and falls back to Canada rather than silently serving the wrong tax rate.

---

## Adding a supported platform

Platforms are defined in `src/registry/platforms/` (phone) and `web/src/registry/` (web), grouped by country.

1. Add an entry to the appropriate country's platform list:
   ```ts
   {
     id: 'new_platform',
     label: 'New Platform',
     color: '#FF6B00',
     textColor: '#FFFFFF',
     country: 'CA',
     logoEmoji: '',            // optional
     defaultHourlyRate: '20',
     defaultMileageRate: '0.70',
     sortPriority: 10,
   }
   ```
2. Mirror it on the other app so both offer the same platforms in that country.
3. The platform then appears automatically in the activation list for drivers in that country — there is no separate wiring.

Drivers can also add their own custom platforms at runtime; a built-in definition is only needed to offer one out of the box.

---

## Feature flags

Features not ready for everyone should be gated:

1. Add the flag name to the type in `src/hooks/useFeatureEnabled.ts`.
2. Set its per-country default in `src/registry/countries/`.
3. Wrap the feature:
   ```tsx
   const isEnabled = useFeatureEnabled('my_feature')
   if (!isEnabled) return null
   ```
4. Expose it in the developer override list so it can be toggled while testing.

---

## Pull requests

1. **Open an issue first** for non-trivial changes.
2. **One logical change per PR.** Don't bundle unrelated fixes.
3. **TypeScript must pass:** `npx tsc --noEmit` with no errors.
4. **Lint must pass:** `npm run lint` with no errors.
5. **Test what you build.** If you add a query, run it on a device or emulator with real data — type checking verifies shape, not behavior.
6. **Touching a country?** Run `node scripts/check-country-parity.mjs`.

### PR description checklist

- What changed and why
- How to test it
- Screenshots or recordings for UI changes
- Any database migration, and what it does

---

## Database migrations

If a change needs a schema migration:

1. Add a migration entry in `src/database/client.ts` and increment the version.
2. Write idempotent SQL (guard `ADD COLUMN` with a `pragma_table_info` check).
3. Test on a fresh database and on an existing one with real data.
4. Note the migration in your PR.

---

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add expense receipt photo
fix: GPS jitter threshold too aggressive
refactor: extract mileage calc to a pure function
docs: update GPS engine doc
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

---

## Reporting bugs

Open an issue at [github.com/raiz-toff/Comma](https://github.com/raiz-toff/Comma) with:

- App version (from About)
- Which app (phone or web), device model, and OS version
- Steps to reproduce
- Expected versus actual behavior
- Logs if available

---

## License

Comma is MIT licensed. By contributing, you agree your contributions are under the same license.
