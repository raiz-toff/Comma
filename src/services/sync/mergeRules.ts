/**
 * Pure merge decision rules (cloud-sync P3 — see sync-design.md §5).
 *
 * Extracted as side-effect-free functions so the core conflict logic is unit-testable
 * WITHOUT a database (applyChangeLog.ts, which imports the DB client, can't run outside
 * the app). applyChangeLog consumes these to decide what to do with each incoming row.
 */

/**
 * Financial tables whose overwrites must be audited (never silently dropped). Includes
 * shifts/shiftPlatforms because their revenue fields are money — and row-level LWW can't
 * isolate "just the revenue field", so we conservatively audit the whole row on overwrite.
 * A shift whose only change was its `notes` will occasionally produce an audit row; that's
 * the safe direction (over-audit, never under-audit a money change).
 */
export const FINANCIAL_TABLES: ReadonlySet<string> = new Set([
  "expenses",
  "taxHistory",
  "shifts",
  "shiftPlatforms",
]);

export type MergeDecision = "insert" | "overwrite" | "skip";

/**
 * Last-Write-Wins decision for one incoming row vs. the local copy.
 *   - no local row            → insert
 *   - incoming strictly newer  → overwrite
 *   - otherwise (local newer, or equal timestamp) → skip (keep local)
 *
 * Strict `>` means ties keep the local row — matching the §4 pseudocode. Independent
 * edits colliding on the exact same epoch-ms are vanishingly rare; we accept the
 * resulting (rare) divergence rather than engineer a vector clock (§5 clock-skew note).
 */
export function decideMerge(opts: {
  localExists: boolean;
  localUpdatedAt: number;
  incomingUpdatedAt: number;
}): MergeDecision {
  if (!opts.localExists) return "insert";
  if (opts.incomingUpdatedAt > opts.localUpdatedAt) return "overwrite";
  return "skip";
}

/**
 * Whether an overwrite of this row must be recorded to the audit log first. True only
 * when we're overwriting a FINANCIAL row that carried real local edits (syncUpdatedAt
 * > 0). A pre-sync row left at the default 0 never had a deliberate local edit to
 * protect, so overwriting it needs no audit.
 */
export function shouldAuditOverwrite(opts: {
  decision: MergeDecision;
  tableName: string;
  localUpdatedAt: number;
}): boolean {
  return (
    opts.decision === "overwrite" &&
    FINANCIAL_TABLES.has(opts.tableName) &&
    opts.localUpdatedAt > 0
  );
}
