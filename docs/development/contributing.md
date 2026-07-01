# Contributing

Thanks for contributing to Comma. This document covers the conventions, patterns, and process.

---

## Code style

### TypeScript

- **Strict mode.** No `any`. TypeScript is set to `strict: true` in `tsconfig.json`. If you can't avoid a dynamic type, use `unknown` and narrow it.
- **No type assertions without justification.** `as SomeType` is acceptable when you're feeding output from a runtime source (e.g. SQLite results). Document why if it's non-obvious.
- **Prefer `type` over `interface`** for data shapes. Use `interface` only when you need declaration merging.

### Database

- **All queries in `src/database/queries/`.** No raw SQL in screen components or hooks.
- **No array-level filtering on DB results.** If you can write it as a `WHERE` clause or `JOIN`, do that instead. Fetching 10,000 rows and filtering to 10 in JS is a performance bug.
- **Mutations via `syncedInsert/syncedUpdate/syncedDelete`.** These are in `src/database/syncedWrites.ts`. They stamp `syncUpdatedAt` automatically. Direct `db.insert()` / `db.update()` are only acceptable for tables that are explicitly not synced (e.g. `locationPoints`, `tempNativePoints`).
- **Soft deletes for synced tables.** Call `syncedDelete()` — never a hard `DELETE` on a synced table, as that loses the tombstone.

### React components

- **Function components only.** No class components.
- **Hooks for logic, components for rendering.** Extract non-trivial business logic to a custom hook before a component grows long.
- **NativeWind for styles.** Use Tailwind classes. Avoid raw `StyleSheet.create` unless you have a reason (e.g. complex animations where StyleSheet is required).
- **No inline `style={{}}` props** except for dynamic values (e.g. `style={{ width: animated.value }}`).

### State

- **React Query for async data.** If data comes from a DB query, put it in a React Query hook. Don't put fetched data in Zustand.
- **Zustand for synchronous global state only.** The two stores are `useActiveShift` and `useSettingsStore`. Add to them sparingly — most features don't need global state.
- **`useState` for local component state.** Modal open/close, text input values, etc.

### Naming

- **Files:** `PascalCase.tsx` for components, `camelCase.ts` for everything else.
- **Hooks:** `use` prefix, camelCase — e.g. `useActiveShift`, `useGPSTracking`.
- **Query keys:** arrays of strings — `['shifts', 'recent']`, `['analytics', 'today']`.

---

## Comments

Default to **no comments**. Write self-documenting code (clear names, small functions). Add a comment only when the *why* is non-obvious:

```ts
// GPS jitter: >150 km/h implies a spike, not a real movement
if (impliedSpeedKmH > 150) continue
```

Do not add comments that describe what the code does (the code already does that):
```ts
// BAD: increment the counter
count++

// BAD: loop through shifts
shifts.forEach(shift => { ... })
```

---

## Pull requests

1. **Open an issue first** for non-trivial changes. Alignment on design before a large PR saves everyone time.
2. **One logical change per PR.** Avoid bundling unrelated fixes or refactors.
3. **TypeScript must pass.** `npx tsc --noEmit` must exit with no errors.
4. **Lint must pass.** `npm run lint` must exit with no errors.
5. **Test what you build.** If you add a query function, test it on a device or emulator with real data. Type checking verifies shape, not behavior.

### PR description checklist

- What changed and why
- How to test it
- Screenshots / recordings for UI changes
- Any database migration included (describe what it does)

---

## Database migrations

If your change requires a schema migration:

1. Add a new migration entry in `src/database/client.ts`.
2. Increment the version number.
3. Write idempotent SQL:
   ```sql
   ALTER TABLE shifts ADD COLUMN foo TEXT;
   -- Safe: SQLite allows re-running ADD COLUMN if the column already exists in some versions,
   -- or use: SELECT COUNT(*) FROM pragma_table_info('shifts') WHERE name='foo'
   ```
4. Test the migration on a fresh database AND on an existing database with real data.
5. Note the migration in your PR description.

---

## Adding a supported platform

Platforms are defined in `src/registry/platforms/`. Each country has its own file.

1. Add an entry to the appropriate country file (or create a new one):
   ```ts
   {
     id: 'new_platform',
     label: 'New Platform',
     color: '#FF6B00',
     textColor: '#FFFFFF',
     country: 'US',
     logoEmoji: '🚚',
     defaultHourlyRate: '20',
     defaultMileageRate: '0.67',
     sortPriority: 10,
   }
   ```
2. The platform will automatically appear in the activation list for users in that country.

---

## Feature flags

New features that aren't ready for all users should be gated:

1. Add the flag name to the type in `src/hooks/useFeatureEnabled.ts`.
2. Set its default value in `src/registry/countries/` (per country default).
3. Wrap the feature:
   ```tsx
   const isEnabled = useFeatureEnabled('my_feature')
   if (!isEnabled) return null
   ```
4. Add it to the developer feature override list in `app/settings/developer.tsx`.

---

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add expense receipt photo
fix: GPS jitter filter threshold too aggressive
refactor: extract mileage calculation to pure function
docs: update GPS engine architecture doc
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

---

## Reporting bugs

Open a GitHub issue with:
- App version (visible in **About**)
- Device model and OS version
- Steps to reproduce
- Expected vs. actual behavior
- Logs if available (Android: `adb logcat`, iOS: Xcode console)

---

## License

Comma is MIT licensed. By contributing, you agree your contributions are under the same license.
