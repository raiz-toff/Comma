/**
 * Mobile-only combined platform + vehicle filter (phone-app parity — see
 * `src/components/GlobalTopHeader.tsx`'s filter pill + dropdown panel). Below the desktop
 * breakpoint, `platforms.js`/`vehicles.js`'s own tab-bar switchers stay mounted but hidden
 * (see `.app-header-filters` in layout.css) and this takes their place:
 *
 *   - a header PILL summarizing the current platform + vehicle selection, and
 *   - a dropdown PANEL (opened from the pill) with a PLATFORM 2-column grid and a VEHICLE
 *     2-column grid, exactly matching the phone app's expandable filter panel.
 *
 * Reuses the same store keys / toggle rules / change events as the two switcher modules — this
 * is a second view onto the same selection state, not a parallel one.
 */

import { store } from '../../core/store.js';
import { bus, PLATFORM_CHANGED, VEHICLE_FILTER_CHANGED } from '../../core/events.js';
import { t } from '../../utils/strings.js';
import { filterIds, filterLabel, pruneFilter, toggleFilter } from '../../utils/filters.js';
import { resolvePlatformLogoHtml } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import { vehicleLabel } from '../vehicles/vehicles.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** @type {WeakMap<HTMLElement, () => void>} */
const teardowns = new WeakMap();

/**
 * @param {HTMLElement | null} slot
 */
export function mountFilterTrigger(slot) {
  if (!slot) return;

  const prev = teardowns.get(slot);
  if (typeof prev === 'function') prev();

  /** @type {HTMLElement | null} */
  let panelEl = null;
  /** @type {HTMLElement | null} */
  let backdropEl = null;

  const isOpen = () => panelEl != null;

  const closePanel = () => {
    panelEl?.remove();
    backdropEl?.remove();
    panelEl = null;
    backdropEl = null;
    slot.querySelector('.filter-trigger')?.setAttribute('aria-expanded', 'false');
    slot.querySelector('.filter-trigger')?.classList.remove('is-open');
  };

  // ── Header pill ──
  const render = () => {
    const platforms = /** @type {any[]} */ (store.get('platforms') || []);
    const vehicles = /** @type {any[]} */ (store.get('vehicles') || []);
    const platformCount = platforms.length;
    const vehicleCount = vehicles.length;

    // Fully hide only when there's nothing configured at all (pre-onboarding). With one of each
    // the pill still shows as a read-only summary — phone-app parity.
    if (platformCount === 0 && vehicleCount === 0) {
      slot.innerHTML = '';
      slot.hidden = true;
      closePanel();
      return;
    }
    slot.hidden = false;

    const platformIds = new Set(platforms.map((p) => String(p.id)));
    const vehicleIds = new Set(vehicles.map((v) => String(v.id)));
    const activePlatformId = pruneFilter(store.get('activePlatformId'), platformIds);
    const activeVehicleId = pruneFilter(store.get('activeVehicleId'), vehicleIds);

    const platformLabel =
      platformCount === 1
        ? String(platforms[0].name || platforms[0].id)
        : platformCount > 1
          ? filterLabel(
              activePlatformId,
              (id) => String(platforms.find((p) => String(p.id) === id)?.name || id),
              String(t('app.platformAll')),
            )
          : null;
    const vehicleLbl =
      vehicleCount === 1
        ? vehicleLabel(vehicles[0])
        : vehicleCount > 1
          ? filterLabel(
              activeVehicleId,
              (id) => {
                const v = vehicles.find((x) => String(x.id) === id);
                return v ? vehicleLabel(v) : id;
              },
              String(t('app.vehicleAll')),
            )
          : null;
    const combinedLabel = [platformLabel, vehicleLbl].filter(Boolean).join(' · ');

    const onlyId =
      platformCount === 1
        ? String(platforms[0].id)
        : filterIds(activePlatformId).length === 1
          ? filterIds(activePlatformId)[0]
          : null;
    const onlyPlatform = onlyId ? platforms.find((p) => String(p.id) === onlyId) : null;
    const col = onlyPlatform ? onlyPlatform.color || getPlatformConfig(onlyId).color : 'var(--color-text-secondary)';
    const logo = (onlyId && resolvePlatformLogoHtml(onlyId)) || getIcon('filter', 14, 'filter-trigger-icon');

    // Interactive only when there's an actual choice to make.
    const isInteractive = platformCount > 1 || vehicleCount > 1;
    const dotColor = onlyPlatform ? col : 'var(--color-text-secondary)';

    slot.innerHTML = `
      <button type="button" class="filter-trigger${isInteractive ? '' : ' filter-trigger--readonly'}"
        ${isInteractive ? 'aria-haspopup="dialog" aria-expanded="false"' : 'aria-disabled="true"'}
        aria-label="${esc(t('platforms.switcher'))}" style="--platform-color:${esc(col)}">
        <span class="filter-trigger-dot" style="background:${esc(dotColor)}"></span>
        <span class="filter-trigger-label">${esc(combinedLabel)}</span>
        <span class="filter-trigger-logo">${logo}</span>
        ${isInteractive ? getIcon('chevron-down', 16, 'filter-trigger-chevron') : ''}
      </button>
    `;

    if (isInteractive) {
      slot.querySelector('.filter-trigger')?.addEventListener('click', () => {
        if (isOpen()) closePanel();
        else openPanel();
      });
    }
  };

  // ── One 2-column pill grid (PLATFORM or VEHICLE) ──
  /**
   * @param {{ label: string; items: Array<{id:string,name:string,color?:string,logo:string}>; activeFilter: string; onToggle: (id: string) => void }} cfg
   */
  function renderSection(cfg) {
    const { label, items, activeFilter, onToggle } = cfg;
    const selected = new Set(filterIds(activeFilter));
    const isOn = (id) => (id === 'all' ? selected.size === 0 : selected.has(id));

    const section = document.createElement('div');
    section.className = 'filter-panel-section';
    section.innerHTML = `<p class="filter-panel-label">${esc(label)}</p>`;

    const grid = document.createElement('div');
    grid.className = 'filter-panel-grid';

    for (const item of items) {
      const id = String(item.id);
      const on = isOn(id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-grid-pill';
      btn.dataset.itemId = id;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.style.setProperty('--platform-color', item.color || 'var(--color-text-primary)');
      btn.innerHTML = `
        <span class="filter-grid-pill-icon">${item.logo}</span>
        <span class="filter-grid-pill-label">${esc(item.name)}</span>
        <span class="filter-grid-pill-dot"></span>
      `;
      btn.addEventListener('click', () => onToggle(id));
      grid.appendChild(btn);
    }

    section.appendChild(grid);
    return section;
  }

  // ── Dropdown panel ──
  function openPanel() {
    const trigger = slot.querySelector('.filter-trigger');
    if (!trigger) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'filter-panel-backdrop';
    backdropEl.addEventListener('click', closePanel);

    panelEl = document.createElement('div');
    panelEl.className = 'filter-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', String(t('platforms.switcher')));

    const buildBody = () => {
      const platforms = /** @type {any[]} */ (store.get('platforms') || []);
      const vehicles = /** @type {any[]} */ (store.get('vehicles') || []);
      const platformIds = new Set(platforms.map((p) => String(p.id)));
      const vehicleIds = new Set(vehicles.map((v) => String(v.id)));
      panelEl.innerHTML = '';

      if (platforms.length > 1) {
        const activeFilter = pruneFilter(store.get('activePlatformId'), platformIds);
        panelEl.appendChild(
          renderSection({
            label: String(t('platforms.sectionLabel')),
            activeFilter,
            items: [
              { id: 'all', name: String(t('app.platformAll')), logo: '<span class="filter-grid-pill-glyph" aria-hidden="true">∞</span>' },
              ...platforms.map((p) => ({
                id: String(p.id),
                name: String(p.name || p.id),
                color: p.color || getPlatformConfig(String(p.id)).color,
                logo:
                  resolvePlatformLogoHtml(String(p.id)) ||
                  `<span class="filter-grid-pill-glyph">${esc(String(p.name || p.id).charAt(0).toUpperCase())}</span>`,
              })),
            ],
            onToggle: (id) => {
              if (id !== 'all' && !platformIds.has(id)) return;
              const next = toggleFilter(String(store.get('activePlatformId') ?? 'all'), id, platforms.length);
              store.set('activePlatformId', next);
              bus.emit(PLATFORM_CHANGED, { platformId: next, source: 'switcher' });
              buildBody();
              render();
            },
          }),
        );
      }

      if (vehicles.length > 1) {
        if (platforms.length > 1) {
          const hr = document.createElement('div');
          hr.className = 'filter-panel-divider';
          panelEl.appendChild(hr);
        }
        const activeFilter = pruneFilter(store.get('activeVehicleId'), vehicleIds);
        const carIcon = getIcon('truck', 15, 'filter-grid-pill-glyph');
        panelEl.appendChild(
          renderSection({
            label: String(t('vehicles.sectionLabel')),
            activeFilter,
            items: [
              { id: 'all', name: String(t('app.vehicleAll')), logo: carIcon },
              ...vehicles.map((v) => ({ id: String(v.id), name: vehicleLabel(v), logo: carIcon })),
            ],
            onToggle: (id) => {
              if (id !== 'all' && !vehicleIds.has(id)) return;
              const next = toggleFilter(String(store.get('activeVehicleId') ?? 'all'), id, vehicles.length);
              store.set('activeVehicleId', next);
              bus.emit(VEHICLE_FILTER_CHANGED, { vehicleId: next, source: 'switcher' });
              buildBody();
              render();
            },
          }),
        );
      }
    };

    buildBody();

    // Anchor the panel just below the trigger — robust against the demo-mode bar / header
    // height changing the vertical offset (getBoundingClientRect is post-layout truth).
    const rect = trigger.getBoundingClientRect();
    panelEl.style.top = `${Math.round(rect.bottom + 8)}px`;

    document.body.appendChild(backdropEl);
    document.body.appendChild(panelEl);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
  }

  const run = (payload) => {
    if (payload && payload.source === 'switcher') return;
    render();
    if (isOpen()) {
      // A platform/vehicle was added/removed elsewhere while open — reflect it.
      closePanel();
    }
  };

  render();
  store.subscribe('platforms', run);
  store.subscribe('vehicles', run);
  const offPlatform = bus.on(PLATFORM_CHANGED, run);
  const offVehicle = bus.on(VEHICLE_FILTER_CHANGED, run);

  const teardown = () => {
    store.unsubscribe('platforms', run);
    store.unsubscribe('vehicles', run);
    offPlatform();
    offVehicle();
    closePanel();
    slot.innerHTML = '';
  };
  teardowns.set(slot, teardown);
}
