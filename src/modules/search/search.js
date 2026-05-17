import '../../libs/fuse.min.js';
import { db, getAppState, setAppState } from '../../core/db.js';
import { showModal } from '../../ui/components.js';

const SAVED_FILTERS_KEY = 'search_saved_filters';
const GLOBAL_SHORTCUT_ATTR = 'data-comma-search-shortcuts';

/**
 * @typedef {'shift'|'expense'|'vehicle'|'platform'} SearchResultType
 */

/**
 * @typedef {Object} SearchResult
 * @property {SearchResultType} type
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} preview
 * @property {number} score
 */

/**
 * @typedef {Object} ShiftFilter
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [platformId]
 * @property {string} [vehicleId]
 * @property {number} [minGross]
 * @property {number} [maxGross]
 * @property {number} [minHours]
 * @property {number} [maxHours]
 * @property {number} [minOrders]
 * @property {number} [maxOrders]
 * @property {string} [notesQuery]
 */

/**
 * @typedef {Object} ExpenseFilter
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {string} [category]
 * @property {string} [platformId]
 * @property {number} [minAmount]
 * @property {number} [maxAmount]
 * @property {boolean} [receiptOnly]
 * @property {string} [notesQuery]
 */

/**
 * @typedef {{ key: string, dir?: 'asc'|'desc' }} SortRule
 */

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Empty or whitespace-only inputs must not become `0` (that breaks min/max filters). */
function optionalNumber(value) {
  const raw = str(value).trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(value) {
  return String(value ?? '');
}

function esc(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function norm(value) {
  return str(value).trim().toLowerCase();
}

function includesNorm(haystack, needle) {
  if (!needle) return true;
  return norm(haystack).includes(norm(needle));
}

function calcShiftHours(row) {
  const mins = num(row?.activeMinutes) || num(row?.onlineMinutes);
  return mins > 0 ? mins / 60 : 0;
}

function getVehicleLabel(row) {
  const preferred = str(row?.name || row?.nickname || row?.label).trim();
  if (preferred) return preferred;
  const makeModel = `${str(row?.make).trim()} ${str(row?.model).trim()}`.trim();
  if (makeModel) return makeModel;
  return `Vehicle ${str(row?.id) || ''}`.trim();
}

function getPlatformLabel(row) {
  return str(row?.name || row?.id || 'Platform').trim();
}

function cmp(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    return num(a) - num(b);
  }
  return str(a).localeCompare(str(b), undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Multi-key stable sort helper for records.
 * @param {Record<string, unknown>[]} rows
 * @param {SortRule[]} rules
 */
function multiSort(rows, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return rows.slice();
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const rule of rules) {
        const dir = rule?.dir === 'asc' ? 1 : -1;
        const diff = cmp(a.row?.[rule.key], b.row?.[rule.key]);
        if (diff !== 0) return diff * dir;
      }
      return a.index - b.index;
    })
    .map((x) => x.row);
}

/**
 * @param {ShiftFilter} filters
 */
export async function filterShifts(filters = {}) {
  const rows = await db.shifts.filter((s) => s.deletedAt == null).toArray();
  return rows.filter((row) => {
    if (filters.startDate && str(row.date) < str(filters.startDate)) return false;
    if (filters.endDate && str(row.date) > str(filters.endDate)) return false;
    if (filters.platformId && str(row.platformId) !== str(filters.platformId)) return false;
    if (filters.vehicleId && str(row.vehicleId) !== str(filters.vehicleId)) return false;
    const base = num(row.grossEarnings ?? row.gross);
    const tips = num(row.tips);
    const bonus = num(row.bonusEarnings ?? row.bonus);
    const gc = base + tips + bonus;
    if (filters.minGross != null && gc < num(filters.minGross) * 100) return false;
    if (filters.maxGross != null && gc > num(filters.maxGross) * 100) return false;
    if (filters.minHours != null && calcShiftHours(row) < num(filters.minHours)) return false;
    if (filters.maxHours != null && calcShiftHours(row) > num(filters.maxHours)) return false;
    if (filters.minOrders != null && num(row.deliveryCount ?? row.orders) < num(filters.minOrders)) return false;
    if (filters.maxOrders != null && num(row.deliveryCount ?? row.orders) > num(filters.maxOrders)) return false;
    if (filters.notesQuery && !includesNorm(row.notes, filters.notesQuery)) return false;
    return true;
  });
}

/**
 * @param {ExpenseFilter} filters
 */
export async function filterExpenses(filters = {}) {
  const rows = await db.expenses.filter((e) => e.deletedAt == null).toArray();
  return rows.filter((row) => {
    if (filters.startDate && str(row.date) < str(filters.startDate)) return false;
    if (filters.endDate && str(row.date) > str(filters.endDate)) return false;
    if (filters.category && str(row.category) !== str(filters.category)) return false;
    if (filters.platformId && str(row.platformId) !== str(filters.platformId)) return false;
    if (filters.minAmount != null && num(row.amount) < num(filters.minAmount) * 100) return false;
    if (filters.maxAmount != null && num(row.amount) > num(filters.maxAmount) * 100) return false;
    if (filters.receiptOnly && !row.receiptData) return false;
    if (filters.notesQuery && !includesNorm(row.notes, filters.notesQuery)) return false;
    return true;
  });
}

/**
 * @param {'shift'|'expense'} entity
 * @param {SortRule[]} rules
 * @param {ShiftFilter | ExpenseFilter} [filters]
 */
export async function queryWithSort(entity, rules, filters = {}) {
  if (entity === 'shift') {
    const rows = await filterShifts(/** @type {ShiftFilter} */ (filters));
    return multiSort(rows, rules);
  }
  const rows = await filterExpenses(/** @type {ExpenseFilter} */ (filters));
  return multiSort(rows, rules);
}

/**
 * @returns {Promise<Array<{id:string, name:string, scope:string, value:unknown, updatedAt:string}>>}
 */
export async function listSavedFilters() {
  const raw = await getAppState(SAVED_FILTERS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string');
}

/**
 * @param {{name:string, scope:string, value:unknown}} payload
 */
export async function saveFilter(payload) {
  const list = await listSavedFilters();
  const id = `sf_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;
  const next = [
    {
      id,
      name: str(payload?.name || '').trim() || 'Saved filter',
      scope: str(payload?.scope || 'global'),
      value: payload?.value ?? null,
      updatedAt: new Date().toISOString(),
    },
    ...list,
  ].slice(0, 50);
  await setAppState(SAVED_FILTERS_KEY, next);
  return id;
}

/**
 * @param {string} id
 */
export async function deleteSavedFilter(id) {
  const list = await listSavedFilters();
  const next = list.filter((x) => x.id !== id);
  await setAppState(SAVED_FILTERS_KEY, next);
}

/**
 * @param {{ shifts?: Record<string, unknown>[], expenses?: Record<string, unknown>[] }} [opts]
 */
async function buildSearchDocuments(opts = {}) {
  const [vehicles, platforms] = await Promise.all([db.vehicles.toArray(), db.platforms.toArray()]);
  const shifts = Array.isArray(opts.shifts) ? opts.shifts : await db.shifts.filter((s) => s.deletedAt == null).toArray();
  const expenses = Array.isArray(opts.expenses) ? opts.expenses : await db.expenses.filter((e) => e.deletedAt == null).toArray();
  const platformById = new Map(platforms.map((p) => [str(p.id), p]));
  const vehicleById = new Map(vehicles.map((v) => [str(v.id), v]));

  /** @type {Array<Record<string, unknown>>} */
  const docs = [];

  for (const shift of shifts) {
    const platform = platformById.get(str(shift.platformId));
    const vehicle = vehicleById.get(str(shift.vehicleId));
    docs.push({
      entityType: 'shift',
      entityId: str(shift.id),
      title: `Shift ${str(shift.date)}`,
      subtitle: getPlatformLabel(platform),
      preview: str(shift.notes || ''),
      date: str(shift.date || ''),
      notes: str(shift.notes || ''),
      platformName: getPlatformLabel(platform),
      vehicleName: getVehicleLabel(vehicle),
    });
  }

  for (const expense of expenses) {
    const platform = platformById.get(str(expense.platformId));
    docs.push({
      entityType: 'expense',
      entityId: str(expense.id),
      title: `Expense ${str(expense.date)}`,
      subtitle: str(expense.category || 'other'),
      preview: str(expense.notes || ''),
      date: str(expense.date || ''),
      notes: str(expense.notes || ''),
      platformName: getPlatformLabel(platform),
      vehicleName: '',
    });
  }

  for (const vehicle of vehicles) {
    docs.push({
      entityType: 'vehicle',
      entityId: str(vehicle.id),
      title: getVehicleLabel(vehicle),
      subtitle: str(vehicle.type || 'vehicle'),
      preview: str(vehicle.notes || ''),
      date: '',
      notes: str(vehicle.notes || ''),
      platformName: '',
      vehicleName: getVehicleLabel(vehicle),
    });
  }

  for (const platform of platforms) {
    docs.push({
      entityType: 'platform',
      entityId: str(platform.id),
      title: getPlatformLabel(platform),
      subtitle: str(platform.id || ''),
      preview: str(platform.notes || ''),
      date: '',
      notes: str(platform.notes || ''),
      platformName: getPlatformLabel(platform),
      vehicleName: '',
    });
  }

  return docs;
}

/**
 * Full-text + fuzzy search over shifts, expenses, vehicles, and platforms.
 * @param {string} query
 */
/**
 * @param {string} query
 * @param {{ shiftFilters?: ShiftFilter, expenseFilters?: ExpenseFilter, sortRules?: SortRule[] }} [opts]
 */
export async function runGlobalSearch(query, opts = {}) {
  const q = str(query).trim();
  if (!q) return [];
  const [shiftRows, expenseRows] = await Promise.all([
    filterShifts(opts.shiftFilters || {}),
    filterExpenses(opts.expenseFilters || {}),
  ]);
  const docs = await buildSearchDocuments({ shifts: shiftRows, expenses: expenseRows });
  const FuseCtor = /** @type {any} */ (globalThis).Fuse;
  if (typeof FuseCtor !== 'function') {
    throw new Error('search:fuse_unavailable');
  }
  const fuse = new FuseCtor(docs, {
    includeScore: true,
    includeMatches: false,
    threshold: 0.34,
    ignoreLocation: true,
    keys: [
      { name: 'title', weight: 0.36 },
      { name: 'vehicleName', weight: 0.12 },
      { name: 'platformName', weight: 0.26 },
    ],
  });
  const raw = fuse.search(q, { limit: 120 });
  const scored = raw.map((hit) => {
    const item = hit.item || {};
    return {
      type: /** @type {SearchResultType} */ (item.entityType || 'shift'),
      id: str(item.entityId),
      title: str(item.title || ''),
      subtitle: str(item.subtitle || ''),
      preview: str(item.preview || ''),
      date: str(item.date || ''),
      score: num(hit.score, 1),
    };
  });
  const sortRules = Array.isArray(opts.sortRules) && opts.sortRules.length ? opts.sortRules : [{ key: 'score', dir: 'asc' }];
  return multiSort(/** @type {Record<string, unknown>[]} */ (scored), sortRules);
}

/**
 * @param {SearchResult[]} rows
 */
function groupResults(rows) {
  /** @type {Record<string, SearchResult[]>} */
  const groups = {};
  for (const row of rows) {
    const key = row.type || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return groups;
}

function renderGroupCards(groups) {
  const typeOrder = ['shift', 'expense', 'vehicle', 'platform'];
  const labels = {
    shift: 'Shifts',
    expense: 'Expenses',
    vehicle: 'Vehicles',
    platform: 'Platforms',
  };
  return typeOrder
    .filter((key) => groups[key]?.length)
    .map((key) => {
      const cards = groups[key]
        .slice(0, 8)
        .map(
          (row) => `
            <article class="search-result-card" data-result-type="${esc(row.type)}" data-result-id="${esc(row.id)}">
              <h4>${esc(row.title)}</h4>
              <p>${esc(row.subtitle)}</p>
              <small>${esc(row.preview || 'No preview')}</small>
            </article>
          `,
        )
        .join('');
      return `<section class="search-result-group"><h3>${labels[key]} (${groups[key].length})</h3>${cards}</section>`;
    })
    .join('');
}

function isTextInputTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName !== 'INPUT') return false;
  const input = /** @type {HTMLInputElement} */ (target);
  const nonText = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color']);
  return !nonText.has(input.type);
}

function buildOverlayNode() {
  const wrap = document.createElement('div');
  wrap.className = 'search-overlay';
  wrap.innerHTML = `
    <div class="search-overlay-layout">
      <header class="search-overlay-header">
        <p class="search-overlay-lead">Search shifts and expenses by notes, vehicles, and platforms.</p>
      </header>

      <section class="search-overlay-section" aria-label="Search query">
        <label class="field search-query-field">
          <span class="input-label">Query</span>
          <input type="search" class="input" name="query" placeholder="Type to search…" autocomplete="off" />
        </label>
      </section>

      <section class="search-overlay-section" aria-label="Sort results">
        <h3 class="search-overlay-section-title">Sort</h3>
        <div class="search-sort-grid">
          <select class="select" name="sortPrimary" aria-label="Primary sort">
            <option value="score_asc">Relevance</option>
            <option value="date_desc">Date (newest)</option>
            <option value="date_asc">Date (oldest)</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
          </select>
          <select class="select" name="sortSecondary" aria-label="Secondary sort">
            <option value="">No secondary sort</option>
            <option value="type_asc">Type A–Z</option>
            <option value="type_desc">Type Z–A</option>
            <option value="score_asc">Relevance</option>
          </select>
        </div>
      </section>

      <section class="search-overlay-section" aria-label="Optional filters">
        <h3 class="search-overlay-section-title">Narrow scope</h3>
        <div class="search-filters-pair">
          <details class="search-panel">
            <summary>Shift filters</summary>
            <div class="search-panel-grid">
              <input class="input" type="date" name="shiftStartDate" aria-label="Shift start date" />
              <input class="input" type="date" name="shiftEndDate" aria-label="Shift end date" />
              <select class="select" name="shiftPlatform" aria-label="Shift platform"><option value="">All platforms</option></select>
              <input class="input" type="number" name="shiftMinGross" min="0" step="0.01" placeholder="Min gross" />
              <input class="input" type="number" name="shiftMaxGross" min="0" step="0.01" placeholder="Max gross" />
              <input class="input search-panel-fullrow" type="text" name="shiftNotesQuery" placeholder="Notes contain…" />
            </div>
          </details>
          <details class="search-panel">
            <summary>Expense filters</summary>
            <div class="search-panel-grid">
              <input class="input" type="date" name="expenseStartDate" aria-label="Expense start date" />
              <input class="input" type="date" name="expenseEndDate" aria-label="Expense end date" />
              <input class="input" type="text" name="expenseCategory" placeholder="Category" />
              <select class="select" name="expensePlatform" aria-label="Expense platform"><option value="">All platforms</option></select>
              <input class="input" type="number" name="expenseMinAmount" min="0" step="0.01" placeholder="Min amount" />
              <input class="input" type="number" name="expenseMaxAmount" min="0" step="0.01" placeholder="Max amount" />
              <input class="input search-panel-fullrow" type="text" name="expenseNotesQuery" placeholder="Notes contain…" />
              <label class="search-panel-checkbox"><input type="checkbox" name="expenseReceiptOnly" /> Receipt only</label>
            </div>
          </details>
        </div>
      </section>

      <section class="search-overlay-section search-overlay-section--results" aria-label="Results">
        <h3 class="search-overlay-section-title">Results</h3>
        <div class="search-overlay-results" data-slot="results"></div>
      </section>

      <section class="search-overlay-section" aria-label="Saved filters">
        <h3 class="search-overlay-section-title">Saved filters</h3>
        <div class="search-overlay-saved" data-slot="saved"></div>
        <div class="search-save-section">
          <label class="field search-save-field">
            <span class="input-label">Save current query</span>
            <div class="search-save-row">
              <input type="text" class="input" name="savedName" placeholder="e.g. weekend downtown" />
              <button type="button" class="btn btn-secondary" data-action="save-filter">Save</button>
            </div>
          </label>
        </div>
      </section>
    </div>
  `;
  return wrap;
}

function wireSavedFilterActions(root, queryInput) {
  const savedSlot = root.querySelector('[data-slot="saved"]');
  const nameInput = /** @type {HTMLInputElement | null} */ (root.querySelector('[name="savedName"]'));

  async function renderSaved() {
    if (!savedSlot) return;
    const list = await listSavedFilters();
    if (!list.length) {
      savedSlot.innerHTML = '<p>No saved filters yet.</p>';
      return;
    }
    savedSlot.innerHTML = `
      <ul class="search-saved-list">
        ${list
          .map(
            (item) => `<li>
              <button type="button" class="btn btn-ghost btn-sm" data-action="apply-filter" data-id="${esc(item.id)}">${esc(item.name)}</button>
              <button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="delete-filter" data-id="${esc(item.id)}">Delete</button>
            </li>`,
          )
          .join('')}
      </ul>
    `;
  }

  root.addEventListener('click', async (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'save-filter') {
      const name = str(nameInput?.value || '').trim();
      const value = str(queryInput?.value || '').trim();
      if (!value) return;
      await saveFilter({ name, scope: 'global', value: { query: value } });
      if (nameInput) nameInput.value = '';
      await renderSaved();
      return;
    }
    if (action === 'delete-filter') {
      const id = str(target.getAttribute('data-id'));
      if (!id) return;
      await deleteSavedFilter(id);
      await renderSaved();
      return;
    }
    if (action === 'apply-filter') {
      const id = str(target.getAttribute('data-id'));
      const list = await listSavedFilters();
      const item = list.find((x) => x.id === id);
      const savedQuery = str(item?.value && item.value.query ? item.value.query : '');
      if (savedQuery && queryInput) {
        queryInput.value = savedQuery;
        queryInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  return renderSaved();
}

export async function openGlobalSearchOverlay() {
  const node = buildOverlayNode();
  const queryInput = /** @type {HTMLInputElement | null} */ (node.querySelector('[name="query"]'));
  const resultsSlot = node.querySelector('[data-slot="results"]');
  const [platformRows] = await Promise.all([db.platforms.toArray()]);

  const platformOptions = `<option value="">All platforms</option>${platformRows
    .map((p) => `<option value="${esc(p.id)}">${esc(getPlatformLabel(p))}</option>`)
    .join('')}`;
  const shiftPlatformSel = /** @type {HTMLSelectElement | null} */ (node.querySelector('[name="shiftPlatform"]'));
  const expensePlatformSel = /** @type {HTMLSelectElement | null} */ (node.querySelector('[name="expensePlatform"]'));
  if (shiftPlatformSel) shiftPlatformSel.innerHTML = platformOptions;
  if (expensePlatformSel) expensePlatformSel.innerHTML = platformOptions;

  async function refreshResults() {
    if (!resultsSlot || !queryInput) return;
    const q = str(queryInput.value).trim();
    if (!q) {
      resultsSlot.innerHTML = '<p>Start typing to search.</p>';
      return;
    }
    const readSort = (name) => {
      const val = str((/** @type {HTMLSelectElement | null} */ (node.querySelector(`[name="${name}"]`)))?.value || '');
      if (!val) return null;
      const [key, dir] = val.split('_');
      return { key, dir: dir === 'desc' ? 'desc' : 'asc' };
    };
    const primary = readSort('sortPrimary');
    const secondary = readSort('sortSecondary');
    const sortRules = [primary, secondary].filter(Boolean);
    const rows = await runGlobalSearch(q, {
      shiftFilters: {
        startDate: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="shiftStartDate"]')))?.value || ''),
        endDate: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="shiftEndDate"]')))?.value || ''),
        platformId: str((/** @type {HTMLSelectElement | null} */ (node.querySelector('[name="shiftPlatform"]')))?.value || ''),
        minGross: optionalNumber((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="shiftMinGross"]')))?.value),
        maxGross: optionalNumber((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="shiftMaxGross"]')))?.value),
        notesQuery: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="shiftNotesQuery"]')))?.value || ''),
      },
      expenseFilters: {
        startDate: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseStartDate"]')))?.value || ''),
        endDate: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseEndDate"]')))?.value || ''),
        platformId: str((/** @type {HTMLSelectElement | null} */ (node.querySelector('[name="expensePlatform"]')))?.value || ''),
        category: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseCategory"]')))?.value || ''),
        minAmount: optionalNumber((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseMinAmount"]')))?.value),
        maxAmount: optionalNumber((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseMaxAmount"]')))?.value),
        notesQuery: str((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseNotesQuery"]')))?.value || ''),
        receiptOnly: Boolean((/** @type {HTMLInputElement | null} */ (node.querySelector('[name="expenseReceiptOnly"]')))?.checked),
      },
      sortRules: /** @type {SortRule[]} */ (sortRules),
    });
    if (!rows.length) {
      resultsSlot.innerHTML = '<p>No matches.</p>';
      return;
    }
    const grouped = groupResults(rows);
    resultsSlot.innerHTML = renderGroupCards(grouped);
  }

  queryInput?.addEventListener('input', () => {
    void refreshResults();
  });
  node.addEventListener('change', () => {
    void refreshResults();
  });

  await wireSavedFilterActions(node, queryInput);
  await refreshResults();

  const modal = showModal({
    title: 'Search',
    content: node,
    size: 'lg',
    actions: [],
  });

  setTimeout(() => {
    if (queryInput) queryInput.focus();
  }, 0);

  return modal;
}

/**
 * Registers Ctrl/Cmd+K and "/" global shortcuts.
 */
export function initSearchModule() {
  if (document.body.hasAttribute(GLOBAL_SHORTCUT_ATTR)) return;
  document.body.setAttribute(GLOBAL_SHORTCUT_ATTR, 'true');
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    const inTextInput = target instanceof HTMLElement && isTextInputTarget(target);
    const isSlash = event.key === '/';
    const isCmdK = (event.ctrlKey || event.metaKey) && str(event.key).toLowerCase() === 'k';
    if (!isCmdK && !(isSlash && !inTextInput)) return;
    event.preventDefault();
    void openGlobalSearchOverlay();
  });
}
