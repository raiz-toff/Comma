/**
 * F9 — Onboarding orchestrator: session progress, steps, Dexie persistence, completion, vault reset.
 */

import { db, saveUser, getUser, getAppState, setAppState } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { store } from '../../core/store.js';
import { Router } from '../../core/router.js';
import {
  bus,
  ONBOARDING_COMPLETE,
  PLATFORM_CHANGED,
  THEME_CHANGED,
  GOAL_UPDATED,
  VAULT_RESET,
} from '../../core/events.js';
import { t } from '../../utils/strings.js';
import { getLocaleConfig } from '../../utils/locale.js';
import { getCountryTaxProfile } from '../../registry/countries/index.js';
import { ProvinceRegistry } from '../../registry/provinces/index.js';
import { getDefaultSamplePlatformId } from '../../registry/platforms/index.js';
import { showConfirm, showToast, showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { requestToken, isDriveConnected } from '../backup/drive-auth.js';
import { listAvailableBackups, runRestore } from '../backup/restore-engine.js';
import { deserializeVault } from '../backup/vault-serializer.js';
import { runOnOpenNotificationCheck } from '../notifications/notifications.js';
import {
  TOTAL_STEPS,
  defaultDraftFromUser,
  renderStepInner,
  validateStep,
  applyTaxPreset,
  normalizeTaxRegionForCountry,
  filterPlatformRowsForOnboarding,
  pruneSelectedPlatformsForRegion,
} from './steps.js';

/** @typedef {import('./steps.js').OnboardingDraft} OnboardingDraft */

export const ONBOARDING_SESSION_KEY = 'comma_onboarding_session_v3';

const SAMPLE_NOTE = '[COMMA sample data]';

/** Demo vault: three catalog platforms (Dexie seed always includes these ids). */
const DEMO_SAMPLE_PLATFORM_IDS = ['doordash', 'ubereats', 'instacart'];

function ymdFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function handleRestoreVault() {
  const modal = showModal({
    title: t('onboarding.landing.restoreLink') || 'Restore existing vault',
    content: `
      <div class="restore-choice-grid">
        <button type="button" class="restore-choice-btn card" data-restore-type="drive">
          <span class="restore-choice-icon">${getIcon('google-drive', 28)}</span>
          <span class="restore-choice-label">Google Drive</span>
          <span class="restore-choice-desc">Restore from your cloud backups</span>
        </button>
        <button type="button" class="restore-choice-btn card" data-restore-type="local">
          <span class="restore-choice-icon">${getIcon('upload', 28)}</span>
          <span class="restore-choice-label">Local Backup</span>
          <span class="restore-choice-desc">Import a .comdb or .json file</span>
        </button>
      </div>
      <input type="file" id="ob-restore-file" accept=".comdb,.json" style="display:none" />
    `,
    size: 'sm',
    actions: []
  });

  const driveBtn = modal.root.querySelector('[data-restore-type="drive"]');
  driveBtn?.addEventListener('click', async () => {
    modal.close();
    if (!isDriveConnected()) {
      requestToken();
    } else {
      const backups = await listAvailableBackups();
      if (backups.length > 0) {
        showRestoreChoiceModal(backups);
      } else {
        showToast({ type: 'info', message: t('settings.backupRestoreEmpty') || 'No backups found in your Drive.' });
      }
    }
  });

  const localBtn = modal.root.querySelector('[data-restore-type="local"]');
  const fileInput = modal.root.querySelector('#ob-restore-file');
  localBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    modal.close();
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const confirmed = await showConfirm({
        title: 'Confirm Restore',
        message: 'This will replace all current data. Are you sure?',
        confirmText: 'Restore Now',
        danger: true
      });

      if (confirmed) {
        const res = await (data.magic === 'COMMA_VAULT' ? runRestoreFromFile(data) : deserializeVault(data));
        if (res.success) {
          showToast({ type: 'success', message: 'Vault restored ✓' });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast({ type: 'error', message: res.error || 'Restore failed.' });
        }
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Invalid file format.' });
    }
  });
}

async function showRestoreChoiceModal(backups) {
  const modal = showModal({
    title: t('settings.backupRestoreTitle'),
    content: `
      <div class="restore-list">
        ${backups.map(b => `
          <div class="restore-item">
            <div class="restore-info">
              <p class="restore-date">${new Date(b.encryptedAt).toLocaleString()}</p>
              <p class="restore-meta text-xs text-secondary">${b.deviceHint || 'Unknown Device'} · v${b.appVersion}</p>
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-restore-id="${b.id}">Restore</button>
          </div>
        `).join('')}
      </div>
    `,
    size: 'sm'
  });

  modal.root.querySelectorAll('[data-restore-id]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.restoreId;
      modal.close();
      const confirmed = await showConfirm({
        title: t('settings.backupRestoreConfirmTitle'),
        message: t('settings.backupRestoreConfirmMessage'),
        requireType: 'RESTORE',
        danger: true
      });
      if (confirmed) {
        const res = await runRestore(id);
        if (res.success) {
          showToast({ type: 'success', message: 'Vault restored ✓' });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showToast({ type: 'error', message: res.error });
        }
      }
    };
  });
}

async function runRestoreFromFile(wrapper) {
  return { success: false, error: 'Encrypted local files must be restored via Google Drive for key synchronization.' };
}

function interpolate(str, vars) {
  let out = String(str);
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/**
 * @param {OnboardingDraft} draft
 */
function persistSession(draft) {
  try {
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(ONBOARDING_SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return /** @type {OnboardingDraft} */ (o);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Build JSON export of preferences only (Feature 265).
 * @param {OnboardingDraft} draft
 * @param {Record<string, unknown>} user
 */
export function buildOnboardingSetupExport(draft, user) {
  const u = user && typeof user === 'object' ? user : {};
  const country = String(draft.country || 'CA').toUpperCase();
  const cfg = getLocaleConfig(country);
  const du = draft.distanceUnit === 'km' || draft.distanceUnit === 'mi' ? draft.distanceUnit : cfg.distanceUnit;
  const provinceId = String(draft.taxRegion || '').trim().toUpperCase();
  return {
    exportKind: 'comma_setup',
    version: 1,
    exportedAt: nowIso(),
    countryId: country,
    provinceId,
    displayName: draft.displayName,
    avatarType: draft.avatarType,
    avatarData: draft.avatarType === 'custom' ? (draft.avatarData ? '[base64 omitted]' : null) : draft.avatarData,
    platforms: draft.selectedPlatforms,
    locale: {
      ...(typeof u.locale === 'object' && u.locale ? u.locale : {}),
      country,
      currency: cfg.currency,
      currencySymbol: cfg.symbol,
      distanceUnit: du,
    },
    vehicles: draft.vehicles.filter((_, i) => i === 0),
    workSchedule: { preset: draft.workSchedulePreset },
    weeklyGoal: draft.weeklyGoal,
    monthlyGoal: draft.monthlyGoal,
    annualGoal: draft.annualGoal,
    taxWithholdingPct: draft.taxWithholdingPct,
    taxRegion: draft.taxRegion,
    hstRegistered: draft.hstRegistered,
    theme: draft.theme,
    notificationPrefs: draft.notificationPrefs,
  };
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import { DEMO_SAMPLE_DATA_YEAR } from '../demo/sample-year.js';

/**
 * Demo vault: three active platforms, weekday earnings across the sample calendar year, and sample expenses (watermarked).
 */
export async function loadSampleData() {
  const user = await getUser();
  const countryId = typeof user?.countryId === 'string' && user.countryId ? String(user.countryId).toUpperCase() : 'CA';
  const pList = ProvinceRegistry.getByCountry(countryId);
  const sampleProvinceId =
    (typeof user?.provinceId === 'string' && user.provinceId.trim() && String(user.provinceId).toUpperCase()) ||
    (pList[0]?.id ?? 'ON');

  await activatePlatformSet(DEMO_SAMPLE_PLATFORM_IDS, 'sample');

  const t0 = nowIso();
  const shiftRows = [];
  const expenseRows = [];
  let weekdayShiftCount = 0;
  const start2025 = new Date(DEMO_SAMPLE_DATA_YEAR, 0, 1, 12, 0, 0, 0);

  for (
    let d = new Date(DEMO_SAMPLE_DATA_YEAR, 0, 1, 12, 0, 0, 0);
    d.getFullYear() === DEMO_SAMPLE_DATA_YEAR;
    d.setDate(d.getDate() + 1)
  ) {
    const dow = d.getDay();
    const dateStr = ymdFromDate(d);
    const dayOfYear = Math.round((d.getTime() - start2025.getTime()) / 86400000);

    if (dow >= 1 && dow <= 5) {
      const platformId = DEMO_SAMPLE_PLATFORM_IDS[weekdayShiftCount % 3];
      const seed = weekdayShiftCount * 13 + dow;
      const grossDollars = 68 + (seed % 42) + (weekdayShiftCount % 3) * 5.5;
      const tipsDollars = 9 + (seed % 8) + (weekdayShiftCount % 4) * 1.25;
      const bonusDollars = 3 + (seed % 5);
      // Fix 1 (interop plan) — startTime/endTime are real epoch-ms timestamps in the stored row
      // (mobile parity); this demo-seed path builds shift rows manually (bypassing
      // normalizeShiftInput), so it derives them itself the same way.
      const demoStartMs = new Date(`${dateStr}T10:30:00`).getTime();
      const demoEndMs = new Date(`${dateStr}T15:00:00`).getTime();
      shiftRows.push({
        id: newId('shift'),
        platformId,
        date: dateStr,
        startTime: demoStartMs,
        endTime: demoEndMs,
        durationSeconds: (240 + (seed % 90)) * 60,
        grossRevenue: Math.round(grossDollars * 100) / 100,
        tipsRevenue: Math.round(tipsDollars * 100) / 100,
        deliveryCount: 6 + (seed % 7),
        activeMileage: 28 + (seed % 55),
        deadMileage: seed % 4,
        provinceId: sampleProvinceId,
        onlineMinutes: 220 + (seed % 80),
        activeMinutes: 170 + (seed % 70),
        vehicleId: null,
        weather: seed % 3 === 0 ? 'Rain' : seed % 3 === 1 ? 'Cloudy' : 'Clear',
        mood: '🙂',
        notes: SAMPLE_NOTE,
        isTemplate: false,
        templateName: null,
        isPlaceholder: true,
        isMultiApp: false,
        multiAppSplit: {},
        customFields: { bonusAmount: bonusDollars },
        deletedAt: null,
        createdAt: t0,
        updatedAt: t0,
        syncUpdatedAt: Date.now(),
        syncDeletedAt: null,
      });
      weekdayShiftCount += 1;
    }

    if (dow === 1) {
      expenseRows.push({
        id: newId('exp'),
        category: 'fuel',
        customCategory: '',
        amount: Math.round(3200 + (dayOfYear % 38) * 95) / 100,
        deductiblePct: 100,
        date: dateStr,
        provinceId: sampleProvinceId,
        platformId: DEMO_SAMPLE_PLATFORM_IDS[dayOfYear % 3],
        notes: `${SAMPLE_NOTE} Demo fuel.`,
        merchant: '',
        merchantNormalized: '',
        receiptData: null,
        receiptUri: null,
        isRecurring: false,
        recurringInterval: null,
        recurringNextDate: null,
        hstPaid: 0,
        confirmedPaid: true,
        deletedAt: null,
        createdAt: t0,
        updatedAt: t0,
        source: 'manual',
        shiftId: null,
        syncUpdatedAt: Date.now(),
        syncDeletedAt: null,
      });
    } else if (dow === 3) {
      const cats = ['parking', 'phone', 'supplies', 'meals'];
      const cat = cats[(dayOfYear >> 1) % 4];
      const baseByCat = { parking: 1400, phone: 8999, supplies: 2899, meals: 2199 };
      const base = baseByCat[cat] ?? 1500;
      expenseRows.push({
        id: newId('exp'),
        category: cat,
        customCategory: '',
        amount: Math.round(base + (dayOfYear % 17) * 55) / 100,
        deductiblePct: cat === 'meals' ? 50 : 100,
        date: dateStr,
        provinceId: sampleProvinceId,
        platformId: DEMO_SAMPLE_PLATFORM_IDS[(dayOfYear + 1) % 3],
        notes: `${SAMPLE_NOTE} Demo ${cat}.`,
        merchant: '',
        merchantNormalized: '',
        receiptData: null,
        receiptUri: null,
        isRecurring: false,
        recurringInterval: null,
        recurringNextDate: null,
        hstPaid: 0,
        confirmedPaid: true,
        deletedAt: null,
        createdAt: t0,
        updatedAt: t0,
        source: 'manual',
        shiftId: null,
        syncUpdatedAt: Date.now(),
        syncDeletedAt: null,
      });
    }
  }

  await db.shifts.bulkAdd(shiftRows);
  await db.expenses.bulkAdd(expenseRows);
  await setAppState('demo_mode', true);
  store.set('demoMode', true);
  bus.emit(GOAL_UPDATED, { source: 'sample' });
}

/** Remove sample shifts and expenses created by `loadSampleData`. */
export async function clearSampleData() {
  const all = await db.shifts.filter((s) => s.isPlaceholder === true || (typeof s.notes === 'string' && s.notes.includes(SAMPLE_NOTE))).toArray();
  for (const s of all) {
    if (s.id != null) await db.shifts.delete(s.id);
  }
  const demoExpenses = await db.expenses
    .filter((e) => typeof e.notes === 'string' && e.notes.includes(SAMPLE_NOTE))
    .toArray();
  for (const e of demoExpenses) {
    if (e.id != null) await db.expenses.delete(e.id);
  }
  await setAppState('demo_mode', false);
  store.set('demoMode', false);
  bus.emit(GOAL_UPDATED, { source: 'sample_clear' });
}

/**
 * Leave demo: wipe the local IndexedDB vault, then hard-reload. Startup re-seeds a first-run DB and opens onboarding.
 */
export async function exitDemoToOnboardingStart() {
  // 1. Clear all session and persistent state
  clearSession();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* ignore */
  }

  // 2. Wipe the database. This is a hard reset.
  try {
    if (db.isOpen()) {
      await db.close();
    }
    await db.delete();
  } catch (e) {
    console.warn('[comma onboarding] db delete during exit failed', e);
  }

  // 3. Inform the user
  showToast({ type: 'success', message: t('app.exitDemoToast'), duration: 2600 });

  // 4. Redirect to onboarding and reload. 
  // We use window.location.href change followed by reload to ensure we don't 
  // stay on the dashboard with a deleted database for even a frame.
  const target = window.location.origin + window.location.pathname + '#/onboarding';
  window.location.href = target;
  
  // A tiny delay to let the browser process the hash change before the hard reload
  setTimeout(() => {
    window.location.reload();
  }, 60);
}

/**
 * Wipe vault after backup + typed RESET (Feature 20). Settings should call when export exists.
 * @param {{ skipExportCheck?: boolean }} [opts]
 */
export async function resetVault(opts = {}) {
  const skip = Boolean(opts?.skipExportCheck);
  if (!skip) {
    const last = await getAppState('last_backup');
    if (last == null || last === '') {
      showToast({ type: 'warning', message: t('onboarding.resetNeedExport'), duration: 5000 });
      return;
    }
  }
  showConfirm({
    title: t('onboarding.resetTitle'),
    message: t('onboarding.resetMessage'),
    confirmLabel: t('onboarding.resetConfirm'),
    confirmClass: 'btn btn-danger',
    requireType: 'RESET',
    onConfirm: async () => {
      await db.delete();
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch {
        /* ignore */
      }
      bus.emit(VAULT_RESET, {});
      window.location.hash = '#/onboarding';
      window.location.reload();
    },
  });
}

/**
 * @param {string[]} platformIds ordered; all others deactivated.
 * @param {string} [busSource]
 */
async function activatePlatformSet(platformIds, busSource = 'onboarding') {
  const ts = nowIso();
  const ids = new Set(platformIds);
  const all = await db.platforms.toArray();
  for (const p of all) {
    const active = ids.has(p.id);
    await db.platforms.update(p.id, {
      active,
      deactivatedAt: active ? null : p.deactivatedAt || ts,
    });
  }
  const primary = platformIds[0] || null;
  await saveUser({
    platforms: [...platformIds],
    primaryPlatform: primary,
  });
  await store.refresh('platforms');
  bus.emit(PLATFORM_CHANGED, { source: busSource });
}

/**
 * @param {OnboardingDraft} draft
 */
async function applyPlatformsFromDraft(draft) {
  await activatePlatformSet(draft.selectedPlatforms, 'onboarding');
}

/**
 * @param {OnboardingDraft} draft
 */
async function persistVehicles(draft) {
  const ts = nowIso();
  const toSave = [draft.vehicles[0]].filter(Boolean);
  const existing = await db.vehicles.toArray();
  for (const e of existing) {
    if (e.id != null) await db.vehicles.delete(e.id);
  }
  for (const v of toSave) {
    const yearNum = v.year === '' || v.year == null ? null : Number(v.year);
    await db.vehicles.add({
      id: newId('veh'),
      nickname: v.nickname.trim(),
      type: /** @type {'gas'} */ (v.type) || 'gas',
      make: v.make || '',
      model: v.model || '',
      year: Number.isFinite(yearNum) ? yearNum : null,
      color: '',
      fuelType: null,
      licensePlate: '',
      currentOdometer: 0,
      fuelEfficiency: null,
      currentFuelPrice: null,
      kwPer100km: null,
      electricityRate: null,
      maintenanceCostPerKm: null,
      purchasePrice: null,
      expectedLifespanKm: null,
      totalKmLogged: 0,
      active: true,
      createdAt: ts,
      updatedAt: ts,
      syncUpdatedAt: Date.now(),
      syncDeletedAt: null,
    });
  }
}

/**
 * @param {OnboardingDraft} draft
 */
async function persistWeeklyGoalRow(draft) {
  const row = await db.goals.filter((g) => g.scope === 'weekly' && g.type === 'earnings').first();
  if (row?.id != null) {
    await db.goals.update(row.id, {
      target: Math.max(0, Number(draft.weeklyGoal) || 0),
      active: true,
      syncUpdatedAt: Date.now(),
    });
  }
  bus.emit(GOAL_UPDATED, { source: 'onboarding' });
}

/**
 * Merge session draft onto defaults.
 * @param {OnboardingDraft | null} saved
 * @param {OnboardingDraft} base
 */
function mergeDraft(saved, base) {
  if (!saved) return { ...base, step: 0 };
  const { step, vehicles: sv, notificationPrefs: np, landingComplete: lc, ...rest } = saved;
  const vehicles = [
    { ...base.vehicles[0], ...(sv && sv[0] && typeof sv[0] === 'object' ? sv[0] : {}) },
    { ...base.vehicles[1], ...(sv && sv[1] && typeof sv[1] === 'object' ? sv[1] : {}) },
  ];
  const st = typeof step === 'number' && step >= 0 && step < TOTAL_STEPS ? step : 0;
  const landingDone = typeof lc === 'boolean' ? lc : st > 0;
  return {
    ...base,
    ...rest,
    vehicles,
    notificationPrefs: { ...base.notificationPrefs, ...(np && typeof np === 'object' ? np : {}) },
    step: st,
    landingComplete: landingDone,
  };
}

/**
 * Read draft from form into object (partial).
 * @param {HTMLElement} root
 * @param {OnboardingDraft} draft
 */
function readFormIntoDraft(root, draft) {
  root.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.getAttribute('data-field');
    if (!field || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (el.type === 'checkbox') {
      /** @type {keyof OnboardingDraft} */ (draft)[field] = el.checked;
      return;
    }
    if (field === 'weeklyGoal' || field === 'monthlyGoal' || field === 'annualGoal' || field === 'taxWithholdingPct') {
      draft[field] = Number(el.value) || 0;
      return;
    }
    if (field === 'country') {
      draft.country = el.value;
      const cfg = getLocaleConfig(el.value);
      draft.distanceUnit = cfg.distanceUnit;
      return;
    }
    draft[field] = el.value;
  });

  root.querySelectorAll('[data-vehicle-idx]').forEach((el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    const idx = Number(el.getAttribute('data-vehicle-idx'));
    const vf = el.getAttribute('data-vehicle-field');
    if (!Number.isFinite(idx) || !vf || !draft.vehicles[idx]) return;
    draft.vehicles[idx][vf] = el.value;
  });

  root.querySelectorAll('[data-np]').forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const k = el.getAttribute('data-np');
    if (k && draft.notificationPrefs) draft.notificationPrefs[k] = el.checked;
  });
}

/**
 * Mount onboarding UI into `root`.
 * @param {HTMLElement} root
 */
export async function mountOnboarding(root) {
  const user = await getUser();
  if (user?.onboardingComplete) {
    Router.navigate('#/dashboard');
    return;
  }

  const baseDraft = defaultDraftFromUser(user);
  const sessionSnap = readSession();
  let draft = mergeDraft(sessionSnap, baseDraft);

  const platformRows = await db.platforms.toArray();
  platformRows.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

  /**
   * @param {import('./steps.js').OnboardingDraft} d
   * @param {string} displayName
   */
  function buildCompletedUserPatch(d, displayName) {
    const country = String(d.country || 'CA').toUpperCase();
    const cfg = getLocaleConfig(country);
    const du = d.distanceUnit === 'km' || d.distanceUnit === 'mi' ? d.distanceUnit : cfg.distanceUnit;
    const rawRegion = String(d.taxRegion || '').trim().toUpperCase();
    const provList = ProvinceRegistry.getByCountry(country);
    let provinceId = rawRegion;
    if (provList.length) {
      provinceId = provList.some((p) => p.id === rawRegion) ? rawRegion : provList[0].id;
    } else if (!rawRegion && country === 'CA') {
      provinceId = 'ON';
    } else if (!rawRegion) {
      provinceId = '';
    }
    const workSchedule = { preset: d.workSchedulePreset, label: t(`onboarding.schedule.${d.workSchedulePreset}`) };
    return {
      displayName,
      avatarType: d.avatarType,
      avatarData: d.avatarData,
      locale: {
        country,
        currency: cfg.currency,
        currencySymbol: cfg.symbol,
        distanceUnit: du,
        dateFormat: 'YYYY-MM-DD',
        weekStartDay: 0,
        timeFormat: '12h',
      },
      countryId: country,
      provinceId,
      workSchedule,
      weeklyGoal: Math.round(Number(d.weeklyGoal || 0) * 100),
      monthlyGoal: Math.round(Number(d.monthlyGoal || 0) * 100),
      annualGoal: Math.round(Number(d.annualGoal || 0) * 100),
      taxWithholdingPct: d.taxWithholdingPct,
      hstRegistered: getCountryTaxProfile(country).hstOnboarding ? d.hstRegistered : false,
      theme: d.theme,
      notificationPrefs: { ...d.notificationPrefs },
      onboardingComplete: true,
      onboardingStep: TOTAL_STEPS,
    };
  }

  const render = () => {
    const step = draft.step;
    const inner = renderStepInner(step, draft, platformRows);
    const isLast = step === TOTAL_STEPS - 1;
    const isLanding = step === 0 && !draft.landingComplete;
    const dots = Array.from({ length: TOTAL_STEPS }, (_, i) => `<span class="onboarding-dot${i === step ? ' is-active' : i < step ? ' is-done' : ''}" aria-hidden="true"></span>`).join('');
    const progressLabel = interpolate(t('onboarding.stepProgress'), { current: String(step + 1), total: String(TOTAL_STEPS) });
    const topHtml = isLanding
      ? ''
      : `<div class="onboarding-top">
          <div class="onboarding-progress" aria-label="${escAttr(progressLabel)}">${dots}</div>
          <p class="onboarding-progress-text">${escHtml(progressLabel)}</p>
          <button type="button" class="btn btn-ghost btn-sm onboarding-demo" data-demo>${escHtml(t('onboarding.tryDemo'))}</button>
        </div>`;
    const navHtml =
      isLanding || isLast
        ? ''
        : `<div class="onboarding-nav">
          <button type="button" class="btn btn-secondary" data-back>${escHtml(t('common.back'))}</button>
          <button type="button" class="btn btn-primary" data-next>${escHtml(t('common.next'))}</button>
        </div>`;

    root.innerHTML = `
      <div class="onboarding-flow${isLanding ? ' onboarding-flow--landing' : ''}" role="region" aria-label="${escAttr(t('views.onboarding.title'))}">
        ${topHtml}
        <div class="onboarding-body${isLanding ? ' onboarding-body--landing' : ' card card-raised'}" data-step-body>${inner}</div>
        ${navHtml}
      </div>`;

    bindStep(root);
  };

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  /** @param {HTMLElement} el */
  function bindStep(el) {
    const body = el.querySelector('[data-step-body]');
    if (!body) return;

    body.querySelectorAll('[data-platform-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-platform-id');
        if (!id) return;
        const set = new Set(draft.selectedPlatforms);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        draft.selectedPlatforms = [...set];
        persistSession(draft);
        render();
      });
    });

    body.querySelectorAll('[data-avatar-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const em = btn.getAttribute('data-avatar-emoji');
        if (em) {
          draft.avatarType = 'emoji';
          draft.avatarData = em;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        }
      });
    });

    body.querySelectorAll('[data-avatar-type]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio instanceof HTMLInputElement && radio.checked) {
          draft.avatarType = /** @type {'initials'|'custom'} */ (radio.value);
          if (draft.avatarType === 'initials') draft.avatarData = null;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        }
      });
    });

    const file = body.querySelector('[data-avatar-file]');
    if (file instanceof HTMLInputElement) {
      file.addEventListener('change', () => {
        const f = file.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          draft.avatarType = 'custom';
          draft.avatarData = typeof reader.result === 'string' ? reader.result : null;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        };
        reader.readAsDataURL(f);
      });
    }

    body.querySelectorAll('[data-schedule]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-schedule');
        if (p) {
          draft.workSchedulePreset = p;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        }
      });
    });

    body.querySelectorAll('[data-distance]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.getAttribute('data-distance');
        if (d === 'km' || d === 'mi') {
          draft.distanceUnit = d;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        }
      });
    });

    body.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const th = btn.getAttribute('data-theme');
        if (th === 'light' || th === 'dark' || th === 'auto') {
          draft.theme = th;
          readFormIntoDraft(el, draft);
          persistSession(draft);
          await saveUser({ theme: th });
          await store.refresh('user');
          bus.emit(THEME_CHANGED, { theme: th });
          render();
        }
      });
    });

    const weeklyInput = body.querySelector('[data-field="weeklyGoal"]');
    if (weeklyInput instanceof HTMLInputElement) {
      const syncMotivation = () => {
        const w = Number(weeklyInput.value) || 0;
        const labelKey =
          w >= 800 ? 'onboarding.motivation.high' : w >= 400 ? 'onboarding.motivation.mid' : w >= 200 ? 'onboarding.motivation.low' : 'onboarding.motivation.start';
        const m = body.querySelector('[data-motivation]');
        if (m) m.textContent = t(labelKey);
      };
      weeklyInput.addEventListener('input', syncMotivation);
      syncMotivation();
    }

    const countrySel = body.querySelector('[data-field="country"]');
    if (countrySel instanceof HTMLSelectElement) {
      countrySel.addEventListener('change', () => {
        draft.country = countrySel.value;
        const cfg = getLocaleConfig(draft.country);
        draft.distanceUnit = cfg.distanceUnit;
        normalizeTaxRegionForCountry(draft);
        pruneSelectedPlatformsForRegion(draft, platformRows);
        persistSession(draft);
        render();
      });
    }

    if (draft.step === 1) {
      const tr = body.querySelector('[data-field="taxRegion"]');
      if (tr instanceof HTMLSelectElement || tr instanceof HTMLInputElement) {
        const syncRegion = () => {
          readFormIntoDraft(el, draft);
          pruneSelectedPlatformsForRegion(draft, platformRows);
          persistSession(draft);
        };
        tr.addEventListener('change', syncRegion);
        if (tr instanceof HTMLInputElement) tr.addEventListener('blur', syncRegion);
      }
    }

    const taxPresetBtn = body.querySelector('[data-tax-preset]');
    if (taxPresetBtn) {
      taxPresetBtn.addEventListener('click', () => {
        readFormIntoDraft(el, draft);
        draft.taxWithholdingPct = applyTaxPreset(draft);
        persistSession(draft);
        render();
      });
    }

    const add2cb = body.querySelector('[data-field="addSecondVehicle"]');
    if (add2cb instanceof HTMLInputElement) {
      add2cb.addEventListener('change', () => {
        readFormIntoDraft(el, draft);
        persistSession(draft);
        render();
      });
    }

    const enter = body.querySelector('[data-enter-vault]');
    if (enter instanceof HTMLButtonElement) {
      enter.addEventListener('click', () => void finalizeOnboarding(el));
    }
    const connectDriveBtn = body.querySelector('[data-connect-drive]');
    if (connectDriveBtn) {
      connectDriveBtn.addEventListener('click', async () => {
        if (store.get('demoMode')) {
          await showConfirm({
            title: t('common.warning'),
            message: t('settings.backupDemoWarning'),
            confirmLabel: t('common.ok') || 'OK',
            cancelLabel: ''
          });
          return;
        }
        requestToken();
      });
      
      // Listen for successful connection to offer restore
      bus.on('drive:auth_success', async () => {
        if (draft.step === TOTAL_STEPS - 1) {
          const backups = await listAvailableBackups();
          if (backups.length > 0) {
            const latest = backups[0];
            const confirmed = await showConfirm({
              title: 'Found existing backup',
              message: `We found a backup from ${new Date(latest.encryptedAt).toLocaleDateString()}. Would you like to restore your data and skip the rest of setup?`,
              confirmText: 'Restore & Skip',
              cancelText: 'Keep Fresh'
            });
            if (confirmed) {
              const res = await runRestore(latest.id);
              if (res.success) {
                showToast({ type: 'success', message: 'Vault restored ✓' });
                setTimeout(() => window.location.reload(), 1000);
              }
            }
          } else {
            showToast({ type: 'success', message: 'Drive connected. First backup will happen after you enter the vault.' });
            render();
          }
        }
      });
    }
    const exportBtn = body.querySelector('[data-export-setup]');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        readFormIntoDraft(el, draft);
        const u = await getUser();
        downloadJson('comma-setup.json', buildOnboardingSetupExport(draft, u));
        showToast({ type: 'success', message: t('onboarding.exportDone') });
      });
    }
    const sampleBtn = body.querySelector('[data-load-sample]');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', async () => {
        try {
          await loadSampleData();
          showToast({ type: 'info', message: t('onboarding.sample.loaded') });
        } catch (e) {
          console.error(e);
          showToast({ type: 'error', message: t('errors.generic') });
        }
      });
    }

    body.querySelector('[data-action="restore-vault"]')?.addEventListener('click', () => {
      handleRestoreVault();
    });

    body.querySelector('[data-start-onboarding]')?.addEventListener('click', () => {
      draft.landingComplete = true;
      persistSession(draft);
      void saveUser({ onboardingStep: draft.step });
      render();
    });

    el.querySelectorAll('[data-demo]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          readFormIntoDraft(el, draft);
          if (!draft.selectedPlatforms.length) {
            const filtered = filterPlatformRowsForOnboarding(draft, platformRows);
            const fallback = filtered[0]?.id || platformRows[0]?.id || getDefaultSamplePlatformId();
            draft.selectedPlatforms = [fallback];
          }

          // Explicitly prompt for notification permission on onboarding completion as it is required for shift timers & alarms
          if ('Notification' in window) {
            try {
              await Notification.requestPermission();
            } catch (err) {
              console.warn('[onboarding] Notification permission request error', err);
            }
          }

          await applyPlatformsFromDraft(draft);
          await clearSampleData();
          await loadSampleData();
          await persistVehicles(draft);
          await persistWeeklyGoalRow(draft);
          const displayName = draft.displayName.trim() || t('onboarding.steps.completeFallbackName');
          await saveUser(buildCompletedUserPatch(draft, displayName));
          clearSession();
          await store.refresh('user');
          await store.refresh('platforms');
          await store.refresh('currentWeekEarnings');
          await store.refresh('currentWeekGoal');
          bus.emit(ONBOARDING_COMPLETE, { displayName, demo: true });
          showToast({ type: 'info', message: t('onboarding.demoEnabled'), duration: 5000 });
          // Proactive notification detectors disabled — mobile parity not built yet,
          // see comma/../now-as-the-app-cozy-gray.md Workstream 7.
          // await runOnOpenNotificationCheck();
          Router.navigate('#/dashboard');
        } catch (e) {
          console.error(e);
          showToast({ type: 'error', message: t('errors.generic') });
        }
      });
    });

    el.querySelector('[data-back]')?.addEventListener('click', () => {
      readFormIntoDraft(el, draft);
      if (draft.step === 0 && draft.landingComplete) {
        draft.landingComplete = false;
        persistSession(draft);
        void saveUser({ onboardingStep: draft.step });
        render();
        return;
      }
      if (draft.step <= 0) return;
      draft.step -= 1;
      persistSession(draft);
      void saveUser({ onboardingStep: draft.step });
      render();
    });

    el.querySelector('[data-next]')?.addEventListener('click', async () => {
      readFormIntoDraft(el, draft);
      if (draft.step === 0 && !draft.landingComplete) {
        return;
      }
      if (draft.step === 6) {
        draft.monthlyGoal = Math.round(draft.weeklyGoal * 4.33);
        draft.annualGoal = Math.round(draft.weeklyGoal * 52);
      }
      const err = validateStep(draft.step, draft, platformRows);
      if (err) {
        showToast({ type: 'warning', message: t(err) });
        return;
      }
      if (draft.step === 0) normalizeTaxRegionForCountry(draft);
      if (draft.step === 1) pruneSelectedPlatformsForRegion(draft, platformRows);
      if (draft.step === 2) await applyPlatformsFromDraft(draft);
      if (draft.step < TOTAL_STEPS - 1) {
        draft.step += 1;
      }
      persistSession(draft);
      await saveUser({ onboardingStep: draft.step });
      render();
    });
  }

  async function finalizeOnboarding(container) {
    readFormIntoDraft(container, draft);

    // Request notification permission as the final step before entering the vault
    // (only prompt if not already decided — never re-pop when denied)
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (err) {
        console.warn('[onboarding] Notification permission request error', err);
      }
    }

    await applyPlatformsFromDraft(draft);
    await persistVehicles(draft);
    await persistWeeklyGoalRow(draft);

    await saveUser(buildCompletedUserPatch(draft, draft.displayName.trim()));

    clearSession();
    await store.refresh('user');
    await store.refresh('platforms');
    bus.emit(ONBOARDING_COMPLETE, { displayName: draft.displayName });
    showToast({ type: 'celebration', message: t('onboarding.completeToast'), duration: 4500 });
    // Proactive notification detectors disabled — mobile parity not built yet,
    // see comma/../now-as-the-app-cozy-gray.md Workstream 7.
    // await runOnOpenNotificationCheck();
    Router.navigate('#/dashboard');
  }

  render();

  if (sessionSnap && typeof sessionSnap.step === 'number' && sessionSnap.step > 0) {
    showConfirm({
      title: t('onboarding.resumeTitle'),
      message: t('onboarding.resumeMessage'),
      confirmLabel: t('onboarding.resumeContinue'),
      cancelLabel: t('onboarding.resumeStartOver'),
      onConfirm: () => {
        draft = mergeDraft(sessionSnap, baseDraft);
        persistSession(draft);
        render();
      },
      onCancel: () => {
        clearSession();
        draft = { ...baseDraft, step: 0 };
        persistSession(draft);
        render();
      },
    });
  }
}
