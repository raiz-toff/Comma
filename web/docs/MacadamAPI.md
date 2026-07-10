# COMMAAPI Spec (P13)

## Debug Surface

The app exposes a development helper surface under `window.__comma.debug`:

- `inspectVault()` returns all IndexedDB tables as a plain object.
- `timedQuery(tableName, limit?)` runs a bounded query and reports elapsed milliseconds.
- `generateSyntheticData()` inserts seven synthetic shift rows for testing.
- `schemaDump()` returns table name + primary-key schema metadata.

## Runtime Notes

- These helpers are local-only and operate directly on IndexedDB.
- They are intended for debugging and QA workflows, not public integrations.
