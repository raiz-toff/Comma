/**
 * F10 — Platform management: Dexie + store sync, switcher, reorder, CRUD hooks.
 */

import SortableMod from '../../libs/sortable.min.js';
import { db, saveUser, getUser } from '../../core/db.js';
import { store } from '../../core/store.js';
import { bus, PLATFORM_CHANGED } from '../../core/events.js';
import { t } from '../../utils/strings.js';
import { filterIds, filterLabel, pruneFilter, toggleFilter } from '../../utils/filters.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import { resolvePlatformLogoHtml, showModal, closeModal } from '../../ui/components.js';

const Sortable = /** @type {any} */ (SortableMod).default || SortableMod;

/** @typedef {{ id: string; name?: string; color?: string; priority?: number; active?: boolean }} PlatformRow */

function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * @returns {Promise<PlatformRow[]>}
 */
async function loadActiveRowsFromDb() {
  const rows = await db.platforms.filter((p) => p.active === true).toArray();
  rows.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
  return rows;
}

/**
 * @returns {Promise<PlatformRow[]>}
 */
async function loadAllRowsFromDb() {
  const rows = await db.platforms.toArray();
  rows.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
  return rows;
}

async function pushPlatformStateFromDb() {
  await store.refresh('platforms');
  await store.refresh('user');
}

/**
 * Call once after `initDatabase` + initial `store.loadFromDB`.
 */
export async function initPlatforms() {
  await store.refresh('platforms');
}

/* Media-query dropdown fallback removed — tabs mode now uses CSS max-width slide. */

/**
 * @param {'tabs'|'dropdown'} mode
 * @param {{ activeRows: PlatformRow[]; selectedId: string }} opts
 * @returns {string}
 */
export function renderPlatformSwitcher(mode, opts) {
  const { activeRows, selectedId } = opts;
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');

  if (mode === 'dropdown') {
    // The filter may name a subset, so the trigger reads "DoorDash + Uber Eats"; only a single
    // selection has one platform's logo and brand colour to show.
    const ids = filterIds(selectedId);
    const only = ids.length === 1 ? ids[0] : null;
    const active = only ? activeRows.find((p) => String(p.id) === only) : null;
    const label = filterLabel(
      selectedId,
      (id) => String(activeRows.find((p) => String(p.id) === id)?.name || id),
      String(t('app.platformAll')),
    );
    const col = only ? active?.color || getPlatformConfig(only).color : 'var(--color-text-muted)';

    let logo = only ? resolvePlatformLogoHtml(only) : null;
    if (!logo) {
      logo = `<span style="font-size:12px;font-weight:800;line-height:1;">${esc(
        String(label).charAt(0).toUpperCase(),
      )}</span>`;
    }

    return `<div class="platform-switcher platform-switcher--dropdown" style="--platform-color:${esc(col)}">
      <button type="button" class="platform-switcher-trigger" aria-haspopup="listbox" aria-label="${esc(
        t('platforms.switcher'),
      )}">
        <span class="platform-switcher-trigger-logo">${logo}</span>
        <span class="platform-switcher-trigger-text">${esc(label)}</span>
        <svg class="platform-switcher-trigger-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </div>`;
  }

  const allLabel = String(t('app.platformAll'));
  const allInitial = allLabel.charAt(0).toUpperCase();
  const allInner = `<span class="platform-tab-inner"><span class="platform-tab-logo" aria-hidden="true"><span style="font-size:13px;font-weight:800;line-height:1;">${esc(allInitial)}</span></span><span class="platform-tab-label">${esc(allLabel)}</span></span>`;

  const selectedSet = new Set(filterIds(selectedId));

  const tabs = [
    `<button type="button" class="platform-tab platform-tab--fixed platform-tab--has-logo" data-platform-id="all" data-draggable="false" aria-selected="${selectedSet.size === 0 ? 'true' : 'false'}" style="--platform-color:var(--color-text-muted)">${allInner}</button>`,
    ...activeRows.map((p) => {
      const id = String(p.id);
      const label = typeof p.name === 'string' && p.name ? p.name : id;
      const col = typeof p.color === 'string' && p.color ? p.color : getPlatformConfig(id).color;
      const sel = selectedSet.has(id) ? 'true' : 'false';
      
      let logo = resolvePlatformLogoHtml(id);
      if (!logo) {
        logo = `<span style="font-size:13px;font-weight:800;line-height:1;">${esc(label.charAt(0).toUpperCase())}</span>`;
      }
      
      const inner = `<span class="platform-tab-inner"><span class="platform-tab-logo" aria-hidden="true">${logo}</span><span class="platform-tab-label">${esc(label)}</span></span>`;
      return `<button type="button" class="platform-tab platform-tab--draggable platform-tab--has-logo" draggable="false" data-platform-id="${esc(
        id,
      )}" aria-selected="${sel}" style="--platform-color:${esc(col)}">${inner}</button>`;
    }),
  ];
  return `<div class="platform-switcher platform-switcher--tabs" role="tablist" aria-label="${esc(
    t('platforms.switcher'),
  )}">${tabs.join('')}</div>`;
}

let demoSwitcherShouldBeExpanded = true;
let activeCollapseCleanup = null;

/** @type {WeakMap<HTMLElement, () => void>} */
const switcherTeardown = new WeakMap();

/**
 * Mount header platform switcher into `slot` (re-renders on store/bus).
 * @param {HTMLElement | null} slot
 */
export function mountPlatformSwitcher(slot) {
  if (!slot) return;

  const prev = switcherTeardown.get(slot);
  if (typeof prev === 'function') prev();

  /** @type {{ destroy: () => void } | null} */
  let sortableInst = null;

  const onDocClick = (e) => {
    const tablist = slot.querySelector('.platform-switcher--tabs');
    if (!tablist || !tablist.classList.contains('is-expanded')) return;
    if (!tablist.contains(/** @type {Node} */ (e.target))) {
      tablist.classList.remove('is-expanded');
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocClick);
  }

  const render = async () => {
    if (sortableInst) {
      try {
        sortableInst.destroy();
      } catch {
        /* ignore */
      }
      sortableInst = null;
    }

    const user = store.get('user');
    const modeRaw = user && typeof user.platformSwitcherMode === 'string' ? user.platformSwitcherMode : 'tabs';
    const displayMode = modeRaw === 'dropdown' ? 'dropdown' : 'tabs';
    const activeRows = /** @type {PlatformRow[]} */ (store.get('platforms') || []);
    const count = activeRows.length;

    if (count <= 1) {
      slot.innerHTML = '';
      slot.hidden = true;
      slot.setAttribute('data-platform-switcher', 'hidden');
      return;
    }

    slot.hidden = false;
    slot.removeAttribute('data-platform-switcher');

    const ids = new Set(activeRows.map((r) => String(r.id)));
    // A platform that was archived since the filter was set must not linger in it and silently
    // hide every shift.
    const selectedId = pruneFilter(store.get('activePlatformId'), ids);

    slot.innerHTML = renderPlatformSwitcher(displayMode, { activeRows, selectedId });

    const applySelectionVisual = (filter) => {
      const set = new Set(filterIds(filter));
      slot.querySelectorAll('.platform-tab').forEach((el) => {
        const pid = String(el.getAttribute('data-platform-id'));
        const on = pid === 'all' ? set.size === 0 : set.has(pid);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    };

    /** Set the filter outright (swipe-to-cycle, the dropdown modal). */
    const commitFilter = (next) => {
      demoSwitcherShouldBeExpanded = false;
      // Apply visual state instantly for snappy UI
      applySelectionVisual(next);

      // Defer global state updates until AFTER the 300ms CSS collapse animation finishes
      // so the heavy re-renders don't block the main thread and drop animation frames.
      setTimeout(() => {
        store.set('activePlatformId', next);
        bus.emit(PLATFORM_CHANGED, { platformId: next, source: 'switcher' });
      }, 300);
    };

    /**
     * All / subset / one, exactly as the phone app does it (see utils/filters.js): tap to add,
     * tap again to remove, and you may hold at most `count - 1` at once — selecting every
     * platform is just 'all'.
     * @returns {string} the filter that was applied
     */
    const setFilter = (id) => {
      const current = String(store.get('activePlatformId') ?? 'all');
      if (id !== 'all' && !ids.has(id)) return current;
      const next = toggleFilter(current, id, count);
      commitFilter(next);
      return next;
    };

    if (displayMode === 'dropdown') {
      const trigger = slot.querySelector('.platform-switcher-trigger');
      if (trigger) {
        trigger.addEventListener('click', () => {
          showPlatformSelectionModal(activeRows, selectedId, setFilter);
        });
      }
      return;
    }

    /* ── Sliding pill: expand / select+collapse ── */
    const tablist = slot.querySelector('.platform-switcher--tabs');
    if (tablist) {
      const isDemo = store.get('demoMode');
      if (isDemo && demoSwitcherShouldBeExpanded) {
        tablist.classList.add('is-expanded');

        const collapseOnMove = () => {
          demoSwitcherShouldBeExpanded = false;
          if (tablist.classList.contains('is-expanded')) {
            tablist.classList.remove('is-expanded');
          }
          cleanupCollapseListeners();
        };

        const cleanupCollapseListeners = () => {
          window.removeEventListener('scroll', collapseOnMove, true);
          document.removeEventListener('touchmove', collapseOnMove, { passive: true });
          document.removeEventListener('wheel', collapseOnMove, { passive: true });
        };

        activeCollapseCleanup = cleanupCollapseListeners;

        window.addEventListener('scroll', collapseOnMove, true);
        document.addEventListener('touchmove', collapseOnMove, { passive: true });
        document.addEventListener('wheel', collapseOnMove, { passive: true });
      }

      let isScrolling = false;
      let startX = 0;
      let startY = 0;

      tablist.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isScrolling = false;
      }, { passive: true });

      tablist.addEventListener('touchmove', (e) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        if (dx > 10 || dy > 10) {
          isScrolling = true;
        }
      }, { passive: true });

      tablist.addEventListener('touchend', (e) => {
        // Swipe to cycle platforms when collapsed
        if (!tablist.classList.contains('is-expanded')) {
          const dx = e.changedTouches[0].clientX - startX;
          const dy = e.changedTouches[0].clientY - startY;
          if (Math.abs(dx) > 40 && Math.abs(dy) < 30) {
            const allIds = ['all', ...activeRows.map((r) => String(r.id))];
            // Swipe cycles one-at-a-time, so it SETS the filter rather than toggling it; from a
            // multi-selection it resumes from the first one picked.
            const chosen = filterIds(selectedId);
            const currentIndex = chosen.length === 0 ? 0 : Math.max(0, allIds.indexOf(chosen[0]));
            const nextIndex =
              dx < 0
                ? (currentIndex + 1) % allIds.length
                : (currentIndex - 1 + allIds.length) % allIds.length;

            // commitFilter sets outright (and includes the 300ms delay for stability)
            commitFilter(allIds[nextIndex]);
            isScrolling = true; // Prevent the 'click' event from expanding it
          }
        }
      });

      tablist.addEventListener('click', (e) => {
        // If we just finished a scroll/swipe, don't trigger selection
        if (isScrolling) {
          isScrolling = false;
          return;
        }

        const tEl = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-platform-id]'));

        // 1. Expand on tap if currently collapsed
        if (!tablist.classList.contains('is-expanded')) {
          tablist.classList.add('is-expanded');
          return;
        }

        // 2. If open, and a tab is clicked, toggle it. Stay open while a subset is still being
        //    assembled (phone parity) — collapsing on the first tap would make picking a second
        //    platform impossible. Close on 'All', or once the cap of `count - 1` is reached.
        if (tEl) {
          const id = tEl.getAttribute('data-platform-id');
          if (id) {
            const chosen = filterIds(setFilter(id));
            const maxAllowed = Math.max(1, count - 1);
            if (chosen.length === 0) {
              tablist.classList.remove('is-expanded');
            } else if (chosen.length >= maxAllowed) {
              setTimeout(() => tablist.classList.remove('is-expanded'), 500);
            }
          }
        } else {
          // 3. Close if clicked outside tabs but inside container
          tablist.classList.remove('is-expanded');
        }
      });
    }

    const sortRoot = slot.querySelector('.platform-switcher--tabs');
    if (sortRoot && activeRows.length > 1) {
      sortableInst = Sortable.create(sortRoot, {
        animation: 150,
        draggable: '.platform-tab--draggable',
        filter: '.platform-tab--fixed',
        preventOnFilter: true,
        delay: 150,
        delayOnTouchOnly: true,
        touchStartThreshold: 10,
        onEnd: async () => {
          const buttons = [...sortRoot.querySelectorAll('.platform-tab[data-platform-id]')].filter(
            (el) => el.getAttribute('data-platform-id') !== 'all',
          );
          const order = buttons.map((b) => String(b.getAttribute('data-platform-id')));
          try {
            await reorderPlatforms(order);
          } catch (err) {
            console.warn('[comma] reorderPlatforms failed', err);
          }
          await render();
        },
      });
    }
  };

  const run = (payload) => {
    if (payload && payload.source === 'switcher') return;
    void render();
  };

  run();
  store.subscribe('platforms', run);
  store.subscribe('user', run);
  const off = bus.on(PLATFORM_CHANGED, run);

  const teardown = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocClick);
    }
    if (activeCollapseCleanup) {
      activeCollapseCleanup();
      activeCollapseCleanup = null;
    }
    off();
    store.unsubscribe('platforms', run);
    store.unsubscribe('user', run);
    if (sortableInst) {
      try {
        sortableInst.destroy();
      } catch {
        /* ignore */
      }
      sortableInst = null;
    }
    slot.innerHTML = '';
  };
  switcherTeardown.set(slot, teardown);
}

/**
 * @param {string} platformId
 */
export async function addPlatform(platformId) {
  const id = String(platformId || '').toLowerCase();
  const row = await db.platforms.get(id);
  if (!row) throw new Error(`Unknown platform "${id}"`);
  if (row.active) return;

  const ts = nowIso();
  const user = (await getUser()) || {};
  const platformsUser = Array.isArray(user.platforms) ? [.../** @type {string[]} */ (user.platforms)] : [];
  if (!platformsUser.includes(id)) platformsUser.push(id);

  const all = await loadAllRowsFromDb();
  const maxPri = all.reduce((m, p) => Math.max(m, Number(p.priority) || 0), 0);

  let name = typeof row.name === 'string' ? row.name : getPlatformConfig(id).name;
  let color = typeof row.color === 'string' ? row.color : getPlatformConfig(id).color;

  if (id === 'other') {
    const ok = await new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(v);
      };
      const wrap = document.createElement('div');
      wrap.className = 'platform-other-form';
      wrap.innerHTML = `
        <p class="text-secondary" style="margin:0 0 var(--space-3)">${t('platforms.otherExplain')}</p>
        <label class="input-group"><span class="input-label">${t('platforms.otherName')}</span>
          <input type="text" class="input" data-other-name value="${escapeAttr(name)}" /></label>
        <label class="input-group" style="margin-top:var(--space-3)"><span class="input-label">${t('platforms.otherColor')}</span>
          <input type="color" class="input" data-other-color value="${escapeAttr(color)}" /></label>
      `;
      showModal({
        title: t('platforms.activateOtherTitle'),
        content: wrap,
        size: 'sm',
        onClose: () => done(false),
        actions: [
          {
            label: t('common.cancel'),
            class: 'btn btn-secondary',
            onClick: () => done(false),
            close: true,
          },
          {
            label: t('common.save'),
            class: 'btn btn-primary',
            autofocus: true,
            onClick: () => {
              const n = wrap.querySelector('[data-other-name]');
              const c = wrap.querySelector('[data-other-color]');
              if (n && 'value' in n) name = String(/** @type {HTMLInputElement} */ (n).value || name).trim() || name;
              if (c && 'value' in c) color = String(/** @type {HTMLInputElement} */ (c).value || color);
              done(true);
            },
            close: true,
          },
        ],
      });
    });
    if (!ok) return;
  }

  await db.platforms.update(id, {
    active: true,
    deactivatedAt: null,
    addedAt: row.addedAt || ts,
    name,
    color,
    priority: maxPri + 1,
    // Mobile-canonical mirrors + LWW stamp (2026-07-03 interop audit): mobile reads
    // `label`/`isActive`/`sortPriority`, and an unstamped write never pushes — so platform
    // activation used to be invisible to the other device.
    label: name,
    isActive: true,
    sortPriority: maxPri + 1,
    syncUpdatedAt: Date.now(),
  });

  await saveUser({
    platforms: platformsUser,
    primaryPlatform: user.primaryPlatform || id,
  });

  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'addPlatform' });
}

/**
 * @param {string} platformId
 */
export async function deactivatePlatform(platformId) {
  const id = String(platformId || '').toLowerCase();
  const active = await loadActiveRowsFromDb();
  if (active.length <= 1) {
    throw new Error('last_platform');
  }
  const row = await db.platforms.get(id);
  if (!row || !row.active) return;

  const ts = nowIso();
  await db.platforms.update(id, {
    active: false,
    deactivatedAt: ts,
    // Mobile mirror + LWW stamp (interop audit) — deactivation must sync too.
    isActive: false,
    syncUpdatedAt: Date.now(),
  });

  const user = (await getUser()) || {};
  const pl = Array.isArray(user.platforms) ? user.platforms.filter((x) => String(x) !== id) : [];
  let primary = user.primaryPlatform != null ? String(user.primaryPlatform) : null;
  if (primary === id) primary = pl[0] || null;

  await saveUser({ platforms: pl, primaryPlatform: primary });

  // Drop just this platform from the filter — a subset like "doordash,skip" must survive losing
  // one member, and only fall back to 'all' when nothing selectable is left.
  const remaining = filterIds(store.get('activePlatformId')).filter((x) => x !== id);
  store.set('activePlatformId', remaining.length ? remaining.join(',') : 'all');

  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'deactivatePlatform' });
}

/**
 * @param {string} platformId
 */
export async function reactivatePlatform(platformId) {
  const id = String(platformId || '').toLowerCase();
  const row = await db.platforms.get(id);
  if (!row) return;
  if (row.active) return;

  const ts = nowIso();
  const all = await loadAllRowsFromDb();
  const maxPri = all.reduce((m, p) => Math.max(m, Number(p.priority) || 0), 0);

  await db.platforms.update(id, {
    active: true,
    deactivatedAt: null,
    addedAt: row.addedAt || ts,
    priority: maxPri + 1,
    // Mobile mirrors + LWW stamp (interop audit) — reactivation must sync too.
    isActive: true,
    sortPriority: maxPri + 1,
    syncUpdatedAt: Date.now(),
  });

  const user = (await getUser()) || {};
  const pl = Array.isArray(user.platforms) ? [...user.platforms.map(String)] : [];
  if (!pl.includes(id)) pl.push(id);

  await saveUser({
    platforms: pl,
    primaryPlatform: user.primaryPlatform || id,
  });

  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'reactivatePlatform' });
}

/**
 * @param {string} platformId
 * @param {number} weekly
 * @param {number} monthly
 */
export async function updatePlatformGoal(platformId, weekly, monthly) {
  const id = String(platformId || '').toLowerCase();
  await db.platforms.update(id, {
    weeklyGoal: Number(weekly) || 0,
    monthlyGoal: Number(monthly) || 0,
    syncUpdatedAt: Date.now(), // LWW stamp (interop audit) — unstamped edits never push
  });
  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'updatePlatformGoal' });
}

/**
 * @param {string} platformId
 * @param {number} ratePct
 */
export async function updatePlatformTaxRate(platformId, ratePct) {
  const id = String(platformId || '').toLowerCase();
  await db.platforms.update(id, { taxRatePct: Number(ratePct) || 0, syncUpdatedAt: Date.now() });
  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'updatePlatformTaxRate' });
}

/**
 * @param {string} platformId
 * @param {string} notes
 */
export async function updatePlatformNotes(platformId, notes) {
  const id = String(platformId || '').toLowerCase();
  await db.platforms.update(id, { notes: String(notes ?? ''), syncUpdatedAt: Date.now() });
  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { platformId: id, source: 'updatePlatformNotes' });
}

/**
 * @param {string[]} newOrder platform ids in display order (no "all")
 */
export async function reorderPlatforms(newOrder) {
  const ids = newOrder.map(String).filter(Boolean);
  let i = 1;
  for (const id of ids) {
    // sortPriority = mobile mirror of priority; stamp so the new order syncs (interop audit).
    await db.platforms.update(id, { priority: i, sortPriority: i, syncUpdatedAt: Date.now() });
    i += 1;
  }
  const user = await getUser();
  if (user) {
    const set = new Set(ids);
    const rest = Array.isArray(user.platforms) ? user.platforms.map(String).filter((x) => !set.has(x)) : [];
    await saveUser({ platforms: [...ids, ...rest] });
  }
  await pushPlatformStateFromDb();
  bus.emit(PLATFORM_CHANGED, { source: 'reorderPlatforms', order: ids });
}
/**
 * @param {PlatformRow[]} activeRows
 * @param {string} currentId
 * @param {(id: string) => void} onSelect
 */
function showPlatformSelectionModal(activeRows, currentId, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'platform-selection-list';

  const items = [
    { id: 'all', name: t('app.platformAll'), color: 'var(--color-text-muted)' },
    ...activeRows,
  ];

  // `currentId` is a filter (possibly a comma-joined subset), so a row is ticked when it is a
  // member of it — and the 'All' row when nothing is selected.
  const selected = new Set(filterIds(currentId));
  const isOn = (id) => (id === 'all' ? selected.size === 0 : selected.has(id));

  for (const p of items) {
    const id = String(p.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'platform-selection-item';
    btn.dataset.platformId = id;
    btn.setAttribute('aria-selected', isOn(id) ? 'true' : 'false');

    const col = p.color || getPlatformConfig(id).color;
    btn.style.setProperty('--platform-color', col);

    let logo = id === 'all' ? null : resolvePlatformLogoHtml(id);
    if (!logo && id !== 'all') {
      logo = `<span style="font-size:13px;font-weight:800;line-height:1;">${String(p.name || id).charAt(0).toUpperCase()}</span>`;
    } else if (id === 'all') {
      logo = `<span style="font-size:13px;font-weight:800;line-height:1;">${String(t('app.platformAll')).charAt(0).toUpperCase()}</span>`;
    }

    btn.innerHTML = `
      <span class="platform-selection-item-logo">${logo}</span>
      <span class="platform-selection-item-name">${String(p.name || id)}</span>
      ${isOn(id) ? '<svg class="platform-selection-item-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
    `;

    btn.addEventListener('click', () => {
      onSelect(id);
      closeModal();
    });
    wrap.appendChild(btn);
  }

  showModal({
    title: t('platforms.switcher'),
    content: wrap,
    size: 'sm',
  });
}
