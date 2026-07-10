/**
 * Pure merge decision rules (interop plan Workstream 3).
 * Ports mobile's `commaApp/src/services/sync/mergeRules.ts` verbatim — side-effect-free so the
 * core conflict logic is testable without a database. `applyChangeLog.js` consumes these to
 * decide what to do with each incoming row.
 */

/**
 * Financial tables whose overwrites must be audited (never silently dropped). Includes
 * shifts/shiftPlatforms because their revenue fields are money — and row-level LWW can't isolate
 * "just the revenue field", so we conservatively audit the whole row on overwrite. A shift whose
 * only change was its `notes` will occasionally produce an audit row; that's the safe direction
 * (over-audit, never under-audit a money change).
 */
export const FINANCIAL_TABLES = new Set(['expenses', 'taxHistory', 'shifts', 'shiftPlatforms']);

/** @typedef {'insert'|'overwrite'|'skip'} MergeDecision */

/**
 * Last-Write-Wins decision for one incoming row vs. the local copy.
 *   - no local row             → insert
 *   - incoming strictly newer  → overwrite
 *   - otherwise (local newer, or equal timestamp) → skip (keep local)
 *
 * Strict `>` means ties keep the local row. Independent edits colliding on the exact same
 * epoch-ms are vanishingly rare; we accept the resulting (rare) divergence rather than engineer
 * a vector clock.
 * @param {{ localExists: boolean, localUpdatedAt: number, incomingUpdatedAt: number }} opts
 * @returns {MergeDecision}
 */
export function decideMerge(opts) {
  if (!opts.localExists) return 'insert';
  if (opts.incomingUpdatedAt > opts.localUpdatedAt) return 'overwrite';
  return 'skip';
}

/**
 * Whether an overwrite of this row must be recorded to the audit log first. True only when
 * we're overwriting a FINANCIAL row that carried real local edits (syncUpdatedAt > 0). A
 * pre-sync row left at the default 0 never had a deliberate local edit to protect, so
 * overwriting it needs no audit.
 * @param {{ decision: MergeDecision, tableName: string, localUpdatedAt: number }} opts
 * @returns {boolean}
 */
export function shouldAuditOverwrite(opts) {
  return opts.decision === 'overwrite' && FINANCIAL_TABLES.has(opts.tableName) && opts.localUpdatedAt > 0;
}
