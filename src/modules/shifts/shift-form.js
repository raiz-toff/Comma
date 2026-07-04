/**
 * F11 — shift form renderer (Feature 33–46 + basic/advanced toggle + live calc bar).
 * Global field metadata: `ShiftFieldRegistry` in `src/registry/shift-fields/` (Category C).
 */

import { t } from '../../utils/strings.js';
import { store } from '../../core/store.js';
import { showNumericKeypad } from '../../ui/components.js';
import { calcHourlyRate } from '../../utils/calculations.js';
import { enumerateWeekDates } from '../../utils/date-range-presets.js';
import { getPlatformConfig } from '../../registry/platforms/terminology.js';
import { PlatformRegistry } from '../../registry/platforms/index.js';
import { ShiftFieldRegistry } from '../../registry/shift-fields/index.js';

function escapeAttr(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @param {unknown} input */
function cloneJsonObject(input) {
  if (!input || typeof input !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return { .../** @type {Record<string, unknown>} */ (input) };
  }
}

function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hmNow() {
  return new Date().toTimeString().slice(0, 5);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normStrLocal(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** Schema-alignment pass: shift money fields are plain dollars now, not cents — just stringify. */
function moneyStr(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function minutesFromTimes(date, startHm, endHm) {
  if (!date || !startHm || !endHm) return 0;
  const start = new Date(`${date}T${startHm}:00`);
  const end = new Date(`${date}T${endHm}:00`);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / 60000));
}

function currencySymbol() {
  const user = store.get('user');
  const sym = user && user.locale && typeof user.locale.currencySymbol === 'string' ? user.locale.currencySymbol : '$';
  return sym || '$';
}

function distanceUnit() {
  const user = store.get('user');
  const u = user && user.locale && typeof user.locale.distanceUnit === 'string' ? user.locale.distanceUnit : 'km';
  return u === 'mi' ? 'mi' : 'km';
}

/**
 * @typedef {Object} ShiftFormOptions
 * @property {'full'|'quick'} [mode]
 * @property {Record<string, unknown>} [initial]
 * @property {string} [submitLabel]
 * @property {() => void} [onCancel]
 * @property {boolean} [allowWeeklyEntry] When false, hides multi-day entry (e.g. edit mode).
 */

/**
 * @returns {{ el: HTMLElement, getValue: () => Record<string, unknown>, setValue: (patch: Record<string, unknown>) => void }}
 * */
export function renderShiftForm(opts = {}) {
  const { mode = 'full', initial = {}, submitLabel = t('common.save'), onCancel, allowWeeklyEntry = true } = opts;

  const user = store.get('user');
  const weekStartDay = Number(user?.locale?.weekStartDay ?? 0);
  const activePlatforms = /** @type {Array<{ id: string, name?: string, active?: boolean }>} */ (store.get('platforms') || []);
  
  // For safety during editing: if editing a shift with a platform that is not in the active list, add it to display
  const initialPlatformId = typeof initial.platformId === 'string' ? initial.platformId : '';
  const displayPlatforms = [...activePlatforms];
  if (initialPlatformId && !displayPlatforms.some(p => p.id === initialPlatformId)) {
    const pConfig = PlatformRegistry.getById(initialPlatformId);
    if (pConfig) {
      displayPlatforms.push({ id: pConfig.id, name: pConfig.name, active: false });
    } else {
      displayPlatforms.push({ id: initialPlatformId, name: initialPlatformId, active: false });
    }
  }

  const primary = user && typeof user.primaryPlatform === 'string' ? user.primaryPlatform : null;
  const defaultPlatformId =
    typeof initial.platformId === 'string' && initial.platformId
      ? String(initial.platformId)
      : primary && displayPlatforms.find((p) => p.id === primary)
        ? primary
        : displayPlatforms[0]?.id || 'other';

  const dateVal = typeof initial.date === 'string' && initial.date ? String(initial.date) : ymdToday();
  const weekAnchorSeed = dateVal;
  const startTimeVal = typeof initial.startTime === 'string' ? String(initial.startTime) : '';
  const endTimeVal = typeof initial.endTime === 'string' ? String(initial.endTime) : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'shifts-form';
  wrapper.dataset.shiftFieldRegistryCount = String(ShiftFieldRegistry.getAll().length);
  wrapper.innerHTML = `
    <form class="shifts-form-container" novalidate>
      <div class="shifts-form-fields">
        ${
          allowWeeklyEntry && mode === 'full'
            ? `<div class="field">
                <span class="field-label">${escapeHtml(t('shifts.entryScopeLabel'))}</span>
                <div class="btn-group w-full" role="group">
                  <button type="button" class="btn btn-ghost btn-sm is-active" data-scope="day">${escapeHtml(
                    t('shifts.entryOneDay'),
                  )}</button>
                  <button type="button" class="btn btn-ghost btn-sm" data-scope="week">${escapeHtml(
                    t('shifts.entryWeekDays'),
                  )}</button>
                </div>
                <input type="hidden" name="entryScope" value="day" />
              </div>
              
              <div class="shifts-week-panel is-hidden" data-week-panel>
                <label class="field">
                  <span class="field-label">${escapeHtml(t('shifts.weekContaining'))}</span>
                  <input class="input" name="weekAnchor" type="date" value="${escapeAttr(weekAnchorSeed)}" />
                </label>
                <div class="shifts-weekday-row" data-week-day-row role="group" aria-label="${escapeAttr(t('shifts.weekDaysHint'))}"></div>
                <p class="field-hint">${escapeHtml(t('shifts.weekSaveHint'))}</p>
              </div>`
            : ''
        }

        <label class="field" data-day-date-wrap>
          <span class="field-label">${escapeHtml(t('shifts.platform'))}</span>
          <select class="input" name="platformId" required>
            ${displayPlatforms.length > 0
              ? displayPlatforms
                  .map((p) => {
                    const id = String(p.id);
                    const label = typeof p.name === 'string' && p.name ? p.name : id;
                    const sel = id === defaultPlatformId ? ' selected' : '';
                    return `<option value="${escapeAttr(id)}"${sel}>${escapeHtml(label)}</option>`;
                  })
                  .join('')
              : `<option value="" disabled selected>No platforms detected</option>`
            }
          </select>
          ${displayPlatforms.length === 0 ? `
            <span class="field-hint" style="color: var(--color-danger); margin-top: var(--space-1);">
              No active platforms detected. <a href="#/settings?tab=platforms" style="text-decoration: underline; font-weight: bold; color: inherit;">Enable platforms in Settings</a> to add shifts.
            </span>
          ` : ''}
        </label>

        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.date'))}</span>
          <input class="input" name="date" type="date" value="${escapeAttr(dateVal)}" required />
        </label>

        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.startTime'))}</span>
          <input class="input" name="startTime" type="text" data-clocklet="format: HH:mm" placeholder="hh:mm" value="${escapeAttr(startTimeVal)}" readonly style="cursor: pointer;" />
        </label>

        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.endTime'))}</span>
          <input class="input" name="endTime" type="text" data-clocklet="format: HH:mm" placeholder="hh:mm" value="${escapeAttr(endTimeVal)}" readonly style="cursor: pointer;" />
        </label>

        <label class="field field--span2">
          <span class="field-label">${escapeHtml(t('shifts.gross'))}</span>
          <div class="field-inline">
            <input class="input" name="gross" inputmode="decimal" placeholder="0.00" />
            <button type="button" class="btn btn-ghost" data-keypad="gross">${escapeHtml(t('ui.keypad.open'))}</button>
          </div>
        </label>

        <div class="shifts-multiplatform field--span2" data-mp-section>
          <div class="shifts-mp-header">
            <span class="field-label">${escapeHtml(t('shifts.platformsWorkedLabel'))}</span>
            <button type="button" class="btn btn-ghost btn-sm" data-action="add-platform">${escapeHtml(t('shifts.addPlatformBtn'))}</button>
          </div>
          <p class="field-hint is-hidden" data-mp-hint>${escapeHtml(t('shifts.platformsWorkedHint'))}</p>
          <div class="shifts-mp-list" data-mp-list></div>
        </div>

        <div class="shifts-form-toggle">
          <button type="button" class="btn btn-ghost" data-action="toggle-advanced" aria-expanded="false">${escapeHtml(t('shifts.advancedToggle'))}</button>
        </div>

        <div class="shifts-advanced" data-advanced>
          <div class="shifts-advanced-grid">
            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.tips'))}</span>
              <input class="input" name="tips" inputmode="decimal" placeholder="0.00" />
            </label>

            <label class="field">
              <span class="field-label" data-bonus-label>${escapeHtml(t('shifts.bonus'))}</span>
              <input class="input" name="bonus" inputmode="decimal" placeholder="0.00" />
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.orders'))}</span>
              <input class="input" name="orders" inputmode="numeric" placeholder="0" />
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.distance'))}</span>
              <input class="input" name="distance" inputmode="decimal" placeholder="0" />
              <span class="field-hint" data-distance-unit></span>
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.onlineMinutes'))}</span>
              <input class="input" name="onlineMinutes" inputmode="numeric" placeholder="0" />
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.activeMinutes'))}</span>
              <input class="input" name="activeMinutes" inputmode="numeric" placeholder="0" />
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.vehicle'))}</span>
              <select class="input" name="vehicleId">
                <option value="">${escapeHtml(t('shifts.vehicleNone'))}</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.weather'))}</span>
              <select class="input" name="weather">
                <option value="">${escapeHtml(t('common.optional'))}</option>
                <option value="clear">☀️ ${escapeHtml(t('shifts.weatherClear'))}</option>
                <option value="rain">🌧️ ${escapeHtml(t('shifts.weatherRain'))}</option>
                <option value="snow">❄️ ${escapeHtml(t('shifts.weatherSnow'))}</option>
                <option value="fog">🌫️ ${escapeHtml(t('shifts.weatherFog'))}</option>
                <option value="heat">🔥 ${escapeHtml(t('shifts.weatherHeat'))}</option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.deadMiles'))}</span>
              <input class="input" name="deadMilesKm" inputmode="decimal" placeholder="0" />
              <span class="field-hint">${escapeHtml(distanceUnit() === 'mi' ? t('shifts.unitMiles') : t('shifts.unitKm'))}</span>
            </label>

            <label class="field">
              <span class="field-label">${escapeHtml(t('shifts.outOfPocketExpense'))}</span>
              <input class="input" name="outOfPocketExpense" inputmode="decimal" placeholder="0.00" />
            </label>

            <div class="field field--span2 is-hidden" data-ps-wrap>
              <span class="field-label">${escapeHtml(t('shifts.platformExtras'))}</span>
              <div class="shifts-advanced-grid" data-ps-fields></div>
              <p class="field-hint is-hidden" data-ps-object-hint>${escapeHtml(t('shifts.psObjectHint'))}</p>
            </div>

            <div class="field">
              <span class="field-label">${escapeHtml(t('shifts.mood'))}</span>
              <div class="mood-row" role="group" aria-label="${escapeAttr(t('shifts.mood'))}">
                ${['😊', '🙂', '😐', '😤', '😩']
                  .map((m) => `<button type="button" class="mood-btn" data-mood="${escapeAttr(m)}">${escapeHtml(m)}</button>`)
                  .join('')}
              </div>
              <input type="hidden" name="mood" value="" />
            </div>

            <label class="field field--span2">
              <span class="field-label">${escapeHtml(t('shifts.notes'))}</span>
              <textarea class="input textarea" name="notes" rows="3" placeholder="${escapeAttr(t('shifts.notesPlaceholder'))}"></textarea>
            </label>
          </div>
        </div>
      </div>

      <div class="shifts-livebar" data-livebar>
        <div class="shifts-livebar-item">
          <span class="shifts-livebar-label">${escapeHtml(t('shifts.duration'))}</span>
          <span class="shifts-livebar-value" data-live-duration>—</span>
        </div>
        <div class="shifts-livebar-item">
          <span class="shifts-livebar-label">${escapeHtml(t('analytics.hourlyRate'))}</span>
          <span class="shifts-livebar-value" data-live-hourly>—</span>
        </div>
        <div class="shifts-livebar-item">
          <span class="shifts-livebar-label">${escapeHtml(t('shifts.deadMilesRatio'))}</span>
          <span class="shifts-livebar-value" data-live-vehicle>—</span>
        </div>
      </div>

      <div class="shifts-form-footer">
        <button type="button" class="btn btn-ghost" data-action="cancel">${escapeHtml(t('common.cancel'))}</button>
        <button type="submit" class="btn btn-primary" data-action="submit">${escapeHtml(submitLabel)}</button>
      </div>
    </form>
  `;

  const form = /** @type {HTMLFormElement | null} */ (wrapper.querySelector('form'));
  const adv = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-advanced]'));
  const advWrap = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-advanced]'));
  const toggleBtn = /** @type {HTMLButtonElement | null} */ (wrapper.querySelector('[data-action="toggle-advanced"]'));

  const platformSel = /** @type {HTMLSelectElement | null} */ (wrapper.querySelector('select[name="platformId"]'));
  const dateEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="date"]'));
  const weekAnchorEl = /** @type {HTMLInputElement | null} */ (
    allowWeeklyEntry ? wrapper.querySelector('input[name="weekAnchor"]') : null
  );
  const weekRow = /** @type {HTMLElement | null} */ (allowWeeklyEntry ? wrapper.querySelector('[data-week-day-row]') : null);
  const startEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="startTime"]'));
  const endEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="endTime"]'));
  const grossEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="gross"]'));
  const tipsEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="tips"]'));
  const bonusEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="bonus"]'));
  const ordersEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="orders"]'));
  const distanceEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="distance"]'));
  const onlineEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="onlineMinutes"]'));
  const activeEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="activeMinutes"]'));
  const vehicleSel = /** @type {HTMLSelectElement | null} */ (wrapper.querySelector('select[name="vehicleId"]'));
  const weatherSel = /** @type {HTMLSelectElement | null} */ (wrapper.querySelector('select[name="weather"]'));
  const deadMilesEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="deadMilesKm"]'));
  const outOfPocketExpenseEl = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="outOfPocketExpense"]'));
  const notesEl = /** @type {HTMLTextAreaElement | null} */ (wrapper.querySelector('textarea[name="notes"]'));
  const moodHidden = /** @type {HTMLInputElement | null} */ (wrapper.querySelector('input[name="mood"]'));
  const bonusLabel = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-bonus-label]'));
  const distanceHint = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-distance-unit]'));
  const psWrap = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-ps-wrap]'));
  const psFields = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-ps-fields]'));
  const psObjHint = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-ps-object-hint]'));
  const mpList = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-mp-list]'));
  const mpHint = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-mp-hint]'));

  let psDraft = cloneJsonObject(
    initial.platformSpecific && typeof initial.platformSpecific === 'object'
      ? /** @type {Record<string, unknown>} */ (initial.platformSpecific)
      : {},
  );

  /**
   * Multi-platform shift split (interop plan Workstream 4 — mirrors mobile's `shiftPlatforms`
   * table). The top-level platformId/gross/tips/orders/onlineMinutes/activeMinutes fields above
   * ALWAYS represent "platform row 1" (the primary platform) — single-platform shifts never see
   * any of this UI beyond the small "add another platform" button, so today's flow is unchanged.
   * Rows 2+ are entered here and combined with row 1 into a `shiftPlatforms` array by `getValue()`;
   * `shifts.js` sums the array into the shift's own aggregate grossRevenue/tipsRevenue/deliveryCount.
   * @typedef {{ platform: string, grossRevenue: string, tipsRevenue: string, tripsCount: string, onlineMinutes: string }} MpRow
   */
  const initialPlatformRows = Array.isArray(initial.shiftPlatforms)
    ? /** @type {Record<string, unknown>[]} */ (initial.shiftPlatforms).filter((r) => r && typeof r === 'object')
    : [];
  /** Row 1 override — when editing a shift that already has a shiftPlatforms breakdown, row 1's
   * fields come from shiftPlatforms[0] (that platform's own numbers), not the shift's aggregate
   * grossRevenue/tipsRevenue/deliveryCount (which is a SUM across all platforms once this
   * breakdown exists — see shifts.js normalizeShiftInput). */
  const row1Source =
    initialPlatformRows.length >= 1
      ? {
          grossRevenue: initialPlatformRows[0].grossRevenue,
          tipsRevenue: initialPlatformRows[0].tipsRevenue,
          deliveryCount: initialPlatformRows[0].tripsCount,
          onlineMinutes:
            initialPlatformRows[0].platformOnlineSeconds != null
              ? Math.round(Number(initialPlatformRows[0].platformOnlineSeconds) / 60)
              : undefined,
          activeMinutes:
            initialPlatformRows[0].platformActiveSeconds != null
              ? Math.round(Number(initialPlatformRows[0].platformActiveSeconds) / 60)
              : undefined,
        }
      : null;
  /** @type {MpRow[]} */
  let extraPlatformRows =
    initialPlatformRows.length > 1
      ? initialPlatformRows.slice(1).map((r) => ({
          platform: typeof r.platform === 'string' ? r.platform : '',
          grossRevenue: moneyStr(r.grossRevenue),
          tipsRevenue: moneyStr(r.tipsRevenue),
          tripsCount: r.tripsCount != null ? String(r.tripsCount) : '',
          onlineMinutes:
            r.platformOnlineSeconds != null ? String(Math.round(Number(r.platformOnlineSeconds) / 60)) : '',
        }))
      : [];

  function blankMpRow() {
    return { platform: '', grossRevenue: '', tipsRevenue: '', tripsCount: '', onlineMinutes: '' };
  }

  function mpPlatformOptionsHtml(selected) {
    return displayPlatforms
      .map((p) => {
        const id = String(p.id);
        const label = typeof p.name === 'string' && p.name ? p.name : id;
        const sel = id === selected ? ' selected' : '';
        return `<option value="${escapeAttr(id)}"${sel}>${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function renderMpRows() {
    if (!mpList) return;
    if (mpHint) mpHint.classList.toggle('is-hidden', extraPlatformRows.length === 0);
    mpList.innerHTML = extraPlatformRows
      .map(
        (row, i) => `
      <div class="shifts-mp-row" data-mp-row data-mp-index="${i}">
        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.platform'))}</span>
          <select class="input" data-mp-field="platform" data-mp-index="${i}">
            <option value="">${escapeHtml(t('common.optional'))}</option>
            ${mpPlatformOptionsHtml(row.platform)}
          </select>
        </label>
        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.gross'))}</span>
          <input class="input" data-mp-field="grossRevenue" data-mp-index="${i}" inputmode="decimal" placeholder="0.00" value="${escapeAttr(row.grossRevenue)}" />
        </label>
        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.tips'))}</span>
          <input class="input" data-mp-field="tipsRevenue" data-mp-index="${i}" inputmode="decimal" placeholder="0.00" value="${escapeAttr(row.tipsRevenue)}" />
        </label>
        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.platformTripsLabel'))}</span>
          <input class="input" data-mp-field="tripsCount" data-mp-index="${i}" inputmode="numeric" placeholder="0" value="${escapeAttr(row.tripsCount)}" />
        </label>
        <label class="field">
          <span class="field-label">${escapeHtml(t('shifts.onlineMinutes'))}</span>
          <input class="input" data-mp-field="onlineMinutes" data-mp-index="${i}" inputmode="numeric" placeholder="0" value="${escapeAttr(row.onlineMinutes)}" />
        </label>
        <button type="button" class="btn btn-ghost btn-sm shifts-mp-remove" data-action="remove-platform" data-mp-index="${i}">${escapeHtml(t('shifts.removePlatformBtn'))}</button>
      </div>
    `,
      )
      .join('');

    mpList.querySelectorAll('[data-mp-field]').forEach((el) => {
      const handler = () => {
        const target = /** @type {HTMLInputElement | HTMLSelectElement} */ (el);
        const idx = Number(target.getAttribute('data-mp-index'));
        const field = target.getAttribute('data-mp-field');
        if (Number.isFinite(idx) && field && extraPlatformRows[idx]) {
          extraPlatformRows[idx][field] = target.value;
        }
        recomputeLive();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  const liveDuration = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-live-duration]'));
  const liveHourly = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-live-hourly]'));
  const liveVehicle = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-live-vehicle]'));

  function renderWeekToggles() {
    if (!weekRow || !allowWeeklyEntry) return;
    const anchor = weekAnchorEl?.value || ymdToday();
    const dates = enumerateWeekDates(anchor, weekStartDay);
    weekRow.innerHTML = dates
      .map((iso, i) => {
        const d = new Date(`${iso}T12:00:00`);
        const shortDow = d.toLocaleDateString(undefined, { weekday: 'short' });
        return `<label class="shifts-weekday-chk"><input type="checkbox" data-week-day-index="${i}" checked aria-label="${escapeAttr(iso)}" /><span class="shifts-weekday-chk-dow">${escapeHtml(shortDow)}</span><span class="shifts-weekday-chk-date">${escapeHtml(iso.slice(5))}</span></label>`;
      })
      .join('');
    weekRow.querySelectorAll('input[type="checkbox"]').forEach((el) => el.addEventListener('change', () => recomputeLive()));
  }

  function applyEntryScope() {
    if (!allowWeeklyEntry || !dateEl) return;
    const scope = wrapper.querySelector('input[name="entryScope"]:checked')?.value || 'day';
    const weekPanel = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-week-panel]'));
    const dayWrap = /** @type {HTMLElement | null} */ (wrapper.querySelector('[data-day-date-wrap]'));
    if (scope === 'week') {
      weekPanel?.classList.remove('is-hidden');
      dayWrap?.classList.add('is-hidden');
      dateEl.removeAttribute('required');
      if (weekAnchorEl && !weekAnchorEl.value) weekAnchorEl.value = dateEl.value || ymdToday();
      weekAnchorEl?.setAttribute('required', '');
      renderWeekToggles();
    } else {
      weekPanel?.classList.add('is-hidden');
      dayWrap?.classList.remove('is-hidden');
      dateEl.setAttribute('required', '');
      weekAnchorEl?.removeAttribute('required');
    }
    recomputeLive();
  }

  const unit = distanceUnit();
  if (distanceHint) distanceHint.textContent = unit === 'mi' ? t('shifts.unitMiles') : t('shifts.unitKm');

  let advancedOpen = false;
  const applyAdvanced = () => {
    if (!toggleBtn || !advWrap) return;
    toggleBtn.setAttribute('aria-expanded', advancedOpen ? 'true' : 'false');
    advWrap.classList.toggle('is-hidden', !advancedOpen);
  };
  applyAdvanced();

  function applyBonusLabel() {
    if (!platformSel || !bonusLabel) return;
    const pid = String(platformSel.value || 'other');
    const term = getPlatformConfig(pid)?.terminology?.bonus;
    bonusLabel.textContent = term ? term : t('shifts.bonus');
  }

  function setMood(m) {
    if (!moodHidden) return;
    moodHidden.value = m ? String(m) : '';
    wrapper.querySelectorAll('[data-mood]').forEach((btn) => {
      const b = /** @type {HTMLElement} */ (btn);
      b.classList.toggle('is-selected', b.getAttribute('data-mood') === moodHidden.value);
    });
  }

  function parseDistanceToKm(distanceVal) {
    const d = num(distanceVal);
    if (unit === 'mi') return d * 1.60934;
    return d;
  }

  function fmtMoney(v) {
    const sym = currencySymbol();
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `${sym}${n.toFixed(2)}`;
  }

  function recomputeLive() {
    let date = dateEl?.value || ymdToday();
    if (allowWeeklyEntry) {
      const scope = wrapper.querySelector('input[name="entryScope"]:checked')?.value;
      if (scope === 'week') {
        const anchor = weekAnchorEl?.value || '';
        const dates = anchor ? enumerateWeekDates(anchor, weekStartDay) : [];
        date = dates[0] || ymdToday();
      }
    }
    const start = startEl?.value || '';
    const end = endEl?.value || '';
    const minutesFromFields = minutesFromTimes(date, start, end);
    const activeM = activeEl?.value ? Math.max(0, Math.floor(num(activeEl.value))) : 0;
    const durationM = activeM > 0 ? activeM : minutesFromFields;
    const gross = grossEl?.value ? num(grossEl.value) : 0;

    if (liveDuration) {
      if (!durationM) liveDuration.textContent = '—';
      else {
        const h = Math.floor(durationM / 60);
        const m = durationM % 60;
        liveDuration.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
    }

    if (liveHourly) {
      if (!durationM || !gross) liveHourly.textContent = '—';
      else liveHourly.textContent = fmtMoney(calcHourlyRate(gross, durationM));
    }

    if (liveVehicle) {
      const totalKm = parseDistanceToKm(distanceEl?.value || 0);
      const deadKm = deadMilesEl?.value ? Math.max(0, num(deadMilesEl.value)) : 0;
      const dead = unit === 'mi' ? deadKm * 1.60934 : deadKm;
      if (!totalKm || totalKm <= 0) liveVehicle.textContent = '—';
      else if (dead <= 0) liveVehicle.textContent = '0%';
      else liveVehicle.textContent = `${Math.min(100, Math.round((100 * dead) / totalKm))}%`;
    }
  }

  function wireKeypad(field, inputEl) {
    const btn = wrapper.querySelector(`[data-keypad="${field}"]`);
    if (!btn || !inputEl) return;
    btn.addEventListener('click', () => {
      showNumericKeypad({
        currency: currencySymbol(),
        value: String(inputEl.value || ''),
        allowDecimal: true,
        onConfirm: (val) => {
          inputEl.value = String(val || '');
          recomputeLive();
        },
      });
    });
  }

  wireKeypad('gross', grossEl);

  const onInput = () => {
    if (allowWeeklyEntry && dateEl && weekAnchorEl) {
      const scope = wrapper.querySelector('input[name="entryScope"]:checked')?.value;
      if (scope === 'day' && dateEl.value) weekAnchorEl.value = dateEl.value;
    }
    recomputeLive();
  };

  if (allowWeeklyEntry) {
    renderWeekToggles();
    weekAnchorEl?.addEventListener('input', () => {
      renderWeekToggles();
      recomputeLive();
    });
    wrapper.addEventListener('change', (e) => {
      const tg = /** @type {HTMLElement | null} */ (e.target);
      if (tg && tg.matches && tg.matches('input[name="entryScope"]')) applyEntryScope();
    });
  }

  function renderPlatformSpecificFields(pid) {
    if (!psFields || !psWrap) return;
    const cfg = getPlatformConfig(pid);
    const schema = Array.isArray(cfg.specificSchema) ? cfg.specificSchema : [];
    const hasObject = schema.some((r) => r && r.kind === 'object');
    if (psObjHint) psObjHint.classList.toggle('is-hidden', !hasObject);
    if (schema.length === 0) {
      psFields.innerHTML = '';
      psWrap.classList.add('is-hidden');
      return;
    }
    psWrap.classList.remove('is-hidden');
    const rowsHtml = schema
      .map((row) => {
        if (!row || typeof row.key !== 'string' || !row.kind) return '';
        const lk = row.labelKey || `shifts.ps.${row.key}`;
        const label = escapeHtml(t(lk));
        const n = `ps_${row.key}`;
        if (row.kind === 'number') {
          const v = psDraft[row.key];
          const sv = v != null && Number.isFinite(Number(v)) ? String(v) : '';
          const maxAttr = typeof row.max === 'number' ? ` max="${row.max}"` : '';
          const minAttr = typeof row.min === 'number' ? ` min="${row.min}"` : '';
          return `<label class="field"><span class="field-label">${label}</span><input class="input" type="number" name="${escapeAttr(n)}" inputmode="decimal"${minAttr}${maxAttr} step="any" value="${escapeAttr(sv)}" /></label>`;
        }
        if (row.kind === 'string') {
          const sv = psDraft[row.key] != null ? String(psDraft[row.key]) : '';
          return `<label class="field"><span class="field-label">${label}</span><input class="input" type="text" name="${escapeAttr(n)}" value="${escapeAttr(sv)}" /></label>`;
        }
        if (row.kind === 'stringArray') {
          const arr = Array.isArray(psDraft[row.key]) ? psDraft[row.key] : [];
          const sv = /** @type {unknown[]} */ (arr)
            .map((x) => String(x))
            .join(', ');
          return `<label class="field field--span2"><span class="field-label">${label}</span><input class="input" type="text" name="${escapeAttr(
            n,
          )}" value="${escapeAttr(sv)}" placeholder="${escapeAttr(t('shifts.psCOMMAPlaceholder'))}" /></label>`;
        }
        if (row.kind === 'object') {
          let txt = '{}';
          try {
            txt = JSON.stringify(
              psDraft[row.key] && typeof psDraft[row.key] === 'object' ? psDraft[row.key] : {},
              null,
              2,
            );
          } catch {
            txt = '{}';
          }
          return `<label class="field field--span2"><span class="field-label">${label}</span><textarea class="input textarea" name="${escapeAttr(
            n,
          )}" rows="5">${escapeHtml(txt)}</textarea></label>`;
        }
        return '';
      })
      .filter(Boolean)
      .join('');
    psFields.innerHTML = rowsHtml;
    psFields.querySelectorAll('input,textarea,select').forEach((el) => el.addEventListener('input', onInput));
  }

  wrapper.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target && /** @type {HTMLElement} */ (e.target).closest('[data-action],[data-mood]'));
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'cancel') {
      e.preventDefault();
      onCancel?.();
      return;
    }
    if (action === 'toggle-advanced') {
      e.preventDefault();
      advancedOpen = !advancedOpen;
      applyAdvanced();
      return;
    }
    if (action === 'add-platform') {
      e.preventDefault();
      extraPlatformRows.push(blankMpRow());
      renderMpRows();
      return;
    }
    if (action === 'remove-platform') {
      e.preventDefault();
      const idx = Number(target.getAttribute('data-mp-index'));
      if (Number.isFinite(idx)) extraPlatformRows.splice(idx, 1);
      renderMpRows();
      recomputeLive();
      return;
    }
    const mood = target.getAttribute('data-mood');
    if (mood != null) {
      e.preventDefault();
      setMood(moodHidden?.value === mood ? '' : mood);
    }
  });

  wrapper.querySelectorAll('input,select,textarea').forEach((el) => el.addEventListener('input', onInput));
  platformSel?.addEventListener('change', () => {
    psDraft = {};
    renderPlatformSpecificFields(String(platformSel?.value || 'other'));
    applyBonusLabel();
  });
  applyBonusLabel();

  // Seed initial values (beyond defaults)
  const seed = (name, val) => {
    const el = /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null} */ (
      wrapper.querySelector(`[name="${name}"]`)
    );
    if (!el) return;
    if (typeof val === 'string' || typeof val === 'number') el.value = String(val);
  };
  // Schema-alignment pass (interop plan Workstream 1): shift rows now store grossRevenue/
  // tipsRevenue/bonusAmount as plain dollars (mobile parity — mobile also has a real top-level
  // bonusAmount column as of Dexie v7). Legacy `gross`/`tips`/`bonus`/`customFields.bonusAmount`
  // are still accepted as a read-side fallback (e.g. shift templates saved before this pass, or
  // callers passing the old loose draft shape straight through).
  const grossDollars = moneyStr(row1Source?.grossRevenue ?? initial.grossRevenue ?? initial.gross);
  const tipsDollars = moneyStr(row1Source?.tipsRevenue ?? initial.tipsRevenue ?? initial.tips);
  const bonusFromCustomFields =
    initial.customFields && typeof initial.customFields === 'object'
      ? /** @type {any} */ (initial.customFields).bonusAmount
      : undefined;
  const bonusDollars = moneyStr(initial.bonusAmount ?? bonusFromCustomFields ?? initial.bonusEarnings ?? initial.bonus);

  seed('gross', grossDollars);
  seed('tips', tipsDollars);
  seed('bonus', bonusDollars);
  seed('orders', row1Source?.deliveryCount ?? initial.deliveryCount ?? initial.orders ?? '');
  let distanceVal = '';
  const activeMileageVal = initial.activeMileage ?? initial.distanceKm;
  if (activeMileageVal != null && Number.isFinite(Number(activeMileageVal))) {
    const km = Number(activeMileageVal);
    distanceVal = String(unit === 'mi' ? parseFloat((km / 1.60934).toFixed(2)) : parseFloat(km.toFixed(2)));
  } else if (initial.distance != null) {
    distanceVal = String(initial.distance);
  }

  let deadMilesVal = '';
  const deadMileageVal = initial.deadMileage ?? initial.deadMilesKm;
  if (deadMileageVal != null && Number.isFinite(Number(deadMileageVal))) {
    const km = Number(deadMileageVal);
    deadMilesVal = String(unit === 'mi' ? parseFloat((km / 1.60934).toFixed(2)) : parseFloat(km.toFixed(2)));
  } else if (initial.deadMiles != null) {
    deadMilesVal = String(initial.deadMiles);
  }

  seed('distance', distanceVal);
  seed('onlineMinutes', row1Source?.onlineMinutes ?? initial.onlineMinutes ?? '');
  seed('activeMinutes', row1Source?.activeMinutes ?? initial.activeMinutes ?? '');
  seed('weather', initial.weather ?? '');
  seed('deadMilesKm', deadMilesVal);
  seed('outOfPocketExpense', initial.outOfPocketExpense ?? '');
  seed('notes', initial.notes ?? '');
  if (typeof initial.mood === 'string') setMood(initial.mood);

  if (startEl && !startEl.value && mode === 'quick') startEl.value = hmNow();
  seed('platformId', defaultPlatformId);

  renderPlatformSpecificFields(String(platformSel?.value || defaultPlatformId));
  renderMpRows();

  recomputeLive();

  const getValue = () => {
    const platformId = platformSel?.value || defaultPlatformId;
    const date = dateEl?.value || ymdToday();
    const startTime = startEl?.value || null;
    const endTime = endEl?.value || null;
    const gross = grossEl?.value ? Number(grossEl.value) : null;

    // Advanced fields
    const tips = tipsEl?.value ? Number(tipsEl.value) : null;
    const bonus = bonusEl?.value ? Number(bonusEl.value) : null;
    const orders = ordersEl?.value ? Math.floor(num(ordersEl.value)) : null;
    const distRaw = distanceEl?.value ? num(distanceEl.value) : 0;
    const distanceKm = distRaw ? parseDistanceToKm(distRaw) : null;
    const onlineMinutes = onlineEl?.value ? Math.floor(num(onlineEl.value)) : null;
    const activeMinutes = activeEl?.value ? Math.floor(num(activeEl.value)) : null;
    // vehicles.id is a client-generated string (Fix 2 — interop plan); no numeric coercion.
    const vehicleId = vehicleSel?.value ? String(vehicleSel.value) : null;
    const weather = weatherSel?.value ? String(weatherSel.value) : null;
    const deadRaw = deadMilesEl?.value ? Math.max(0, num(deadMilesEl.value)) : 0;
    const deadMilesKm =
      deadRaw > 0 ? (unit === 'mi' ? deadRaw * 1.60934 : deadRaw) : null;
    const outOfPocketExpense = outOfPocketExpenseEl?.value ? Number(outOfPocketExpenseEl.value) : null;
    const mood = moodHidden?.value ? String(moodHidden.value) : null;
    const notes = notesEl?.value ? String(notesEl.value) : '';

    /** @type {Record<string, unknown>} */
    const platformSpecific = {};
    const schema = getPlatformConfig(platformId).specificSchema || [];
    for (const row of schema) {
      if (!row || typeof row.key !== 'string') continue;
      const el = psFields?.querySelector(`[name="ps_${row.key}"]`);
      if (!el) continue;
      if (row.kind === 'number') {
        const raw = String(/** @type {HTMLInputElement} */ (el).value || '').trim();
        platformSpecific[row.key] = raw === '' ? null : num(raw);
      } else if (row.kind === 'string') {
        platformSpecific[row.key] = String(/** @type {HTMLInputElement} */ (el).value || '').trim();
      } else if (row.kind === 'stringArray') {
        platformSpecific[row.key] = String(/** @type {HTMLInputElement} */ (el).value || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
      } else if (row.kind === 'object' && el instanceof HTMLTextAreaElement) {
        try {
          platformSpecific[row.key] = JSON.parse(el.value || '{}');
        } catch {
          const prev = psDraft[row.key];
          platformSpecific[row.key] = prev && typeof prev === 'object' ? prev : {};
        }
      }
    }

    // Multi-platform breakdown (interop plan Workstream 4): row 1 mirrors the top-level fields
    // above exactly, so a single-platform shift produces a `shiftPlatforms` array of length 1 whose
    // sole entry equals what the shift-level fields already say — shifts.js's sum-from-breakdown
    // logic is then a no-op for single-platform shifts (identical to pre-multi-platform behavior).
    const mpRow1 = {
      platform: platformId,
      grossRevenue: gross ?? 0,
      tipsRevenue: tips ?? 0,
      tripsCount: orders ?? 0,
      platformOnlineSeconds: Math.max(0, Math.round((onlineMinutes ?? 0) * 60)),
      platformActiveSeconds: Math.max(0, Math.round((activeMinutes ?? onlineMinutes ?? 0) * 60)),
    };
    const mpExtra = extraPlatformRows
      .filter((r) => normStrLocal(r.platform))
      .map((r) => {
        const onlineSec = r.onlineMinutes ? Math.max(0, Math.round(num(r.onlineMinutes) * 60)) : 0;
        return {
          platform: normStrLocal(r.platform),
          grossRevenue: r.grossRevenue ? Math.max(0, num(r.grossRevenue)) : 0,
          tipsRevenue: r.tipsRevenue ? Math.max(0, num(r.tipsRevenue)) : 0,
          tripsCount: r.tripsCount ? Math.max(0, Math.floor(num(r.tripsCount))) : 0,
          platformOnlineSeconds: onlineSec,
          platformActiveSeconds: onlineSec,
        };
      });
    const shiftPlatforms = [mpRow1, ...mpExtra];

    return {
      platformId,
      date,
      startTime,
      endTime,
      gross,
      tips,
      bonus,
      orders,
      distanceKm,
      onlineMinutes,
      activeMinutes,
      vehicleId,
      weather,
      deadMilesKm,
      outOfPocketExpense,
      mood,
      notes,
      platformSpecific,
      shiftPlatforms,
    };
  };

  const setValue = (patch) => {
    if (patch?.platformSpecific && typeof patch.platformSpecific === 'object') {
      psDraft = { ...psDraft, ...cloneJsonObject(patch.platformSpecific) };
    }
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (k === 'platformSpecific' || k === 'mood') return;
      seed(k, v);
    });
    if (patch && typeof patch.mood === 'string') setMood(patch.mood);
    if (patch && (patch.platformId != null || patch.platformSpecific)) {
      renderPlatformSpecificFields(String(platformSel?.value || defaultPlatformId));
    }
    applyBonusLabel();
    recomputeLive();
  };

  const getWeekSaveDates = () => {
    if (!allowWeeklyEntry) return null;
    const scope = wrapper.querySelector('input[name="entryScope"]:checked')?.value;
    if (scope !== 'week') return null;
    const anchor = weekAnchorEl?.value || '';
    if (!anchor) return [];
    const dates = enumerateWeekDates(anchor, weekStartDay);
    const out = [];
    dates.forEach((iso, i) => {
      const cb = weekRow?.querySelector(`input[data-week-day-index="${i}"]`);
      if (cb && /** @type {HTMLInputElement} */ (cb).checked) out.push(iso);
    });
    return out;
  };

  // Leave submit handling to parent (view) — it can attach listener on `form`.
  if (form) form.noValidate = false;

  return { el: wrapper, getValue, setValue, getWeekSaveDates };
}

