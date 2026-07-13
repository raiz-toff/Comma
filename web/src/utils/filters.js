/**
 * Header filter values, in the phone app's format so the two apps agree.
 *
 * A filter is one of:
 *   'all'          — no filtering
 *   'id'           — exactly one
 *   'id1,id2'      — a subset, comma-joined, order = selection order (oldest first)
 *
 * The all/subset/one rules are mirrored from the phone's
 * `src/components/GlobalTopHeader.tsx` (`handleSelectFilter`): you may select at most
 * `total - 1` individually, because selecting every one of them just means 'all'.
 */

/**
 * Selected ids, or `[]` when the filter is 'all' (i.e. "everything matches").
 * @param {unknown} filter
 * @returns {string[]}
 */
export function filterIds(filter) {
  const raw = String(filter ?? 'all');
  if (raw === 'all' || raw === '') return [];
  return raw.split(',').filter(Boolean);
}

/**
 * Does `value` pass `filter`? An 'all' filter passes everything.
 * @param {unknown} value
 * @param {unknown} filter
 */
export function matchesFilter(value, filter) {
  const ids = filterIds(filter);
  if (ids.length === 0) return true;
  return ids.includes(String(value ?? ''));
}

/**
 * Drop any id that is no longer selectable (archived, deleted), collapsing to 'all' if that
 * empties the selection. Guards against a stale filter silently hiding every row.
 * @param {unknown} filter
 * @param {Iterable<string>} validIds
 * @returns {string} a filter string
 */
export function pruneFilter(filter, validIds) {
  const valid = new Set([...validIds].map(String));
  const kept = filterIds(filter).filter((id) => valid.has(id));
  return kept.length ? kept.join(',') : 'all';
}

/**
 * The phone's all/subset/one toggle. Tapping 'all' resets; tapping a selected id deselects it
 * (falling back to 'all' when it was the last one); tapping an unselected id adds it, bumping
 * the oldest selection once the cap of `total - 1` is reached.
 * @param {unknown} current current filter string
 * @param {string} id the id that was tapped, or 'all'
 * @param {number} total how many are selectable in total
 * @returns {string} the new filter string
 */
export function toggleFilter(current, id, total) {
  if (id === 'all') return 'all';

  const maxAllowed = Math.max(1, Number(total) - 1);
  const parts = filterIds(current);

  if (parts.length === 0) return id;

  if (parts.includes(id)) {
    const updated = parts.filter((p) => p !== id);
    return updated.length ? updated.join(',') : 'all';
  }

  const updated = [...parts, id];
  if (updated.length > maxAllowed) updated.shift();
  return updated.join(',');
}

/**
 * Human label for a filter: 'All', 'DoorDash', or 'DoorDash + Uber Eats'.
 * @param {unknown} filter
 * @param {(id: string) => string} resolve id -> display name
 * @param {string} allLabel
 */
export function filterLabel(filter, resolve, allLabel) {
  const ids = filterIds(filter);
  if (ids.length === 0) return allLabel;
  return ids.map(resolve).join(' + ');
}
