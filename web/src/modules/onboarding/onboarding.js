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
import { getVehicleMileageEligibility } from '../../registry/countries/mileageRates.js';
import { upsertTaxProfile } from '../vehicles/taxProfiles.js';
import { getCountryTaxProfile } from '../../registry/countries/index.js';
import { ProvinceRegistry } from '../../registry/provinces/index.js';
import { getDefaultSamplePlatformId } from '../../registry/platforms/index.js';
import { showConfirm, showToast, showModal } from '../../ui/components.js';
import { getIcon } from '../../ui/icons.js';
import { requestToken, isDriveConnected, getAccessToken } from '../backup/drive-auth.js';
import { listAvailableBackups, runRestore } from '../backup/restore-engine.js';
import { setBackupPassword, clearBackupPassword } from '../../services/sync/backupPassword.js';
import { setSyncEnabled, resetLogFailures } from '../../services/sync/syncState.js';
import { promptEncryptionPassword } from '../backup/backup-ui.js';
import { syncNow } from '../../services/sync/syncNow.js';
import { importVaultFile } from '../backup/vault-import.js';
import { runOnOpenNotificationCheck } from '../notifications/notifications.js';
import {
  TOTAL_STEPS,
  defaultDraftFromUser,
  renderStepInner,
  renderReveal,
  renderNoShiftYet,
  validateStep,
  applyTaxPreset,
  normalizeTaxRegionForCountry,
  filterPlatformRowsForOnboarding,
  pruneSelectedPlatformsForRegion,
  initLandingFlip,
} from './steps.js';

/** Teardown for the landing headline flip, so re-renders don't stack timers. */
let stopLandingFlip = null;

import { computeFirstShift, ASSUMED_VEHICLE_TYPE } from './firstShift.js';
import { saveShift } from '../shifts/shifts.js';

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

/**
 * Landing-page "Restore / Sync" chooser: pull existing data in via Google Drive SYNC (the
 * cross-device path — works with the phone) or by importing a local backup FILE (current or
 * legacy web exports, plus encrypted .comdb — see backup/vault-import.js).
 */
function handleRestoreSync() {
  const modal = showModal({
    title: 'Restore / Sync',
    content: `
      <div class="restore-choice-grid">
        <button type="button" class="restore-choice-btn card" data-choice="google-sync">
          <span class="restore-choice-icon">${getIcon('google-drive', 28)}</span>
          <span class="restore-choice-label">Google Sync</span>
          <span class="restore-choice-desc">Connect your account — pulls the data your phone (or another browser) synced, and keeps syncing</span>
        </button>
        <button type="button" class="restore-choice-btn card" data-choice="local-file">
          <span class="restore-choice-icon">${getIcon('upload', 28)}</span>
          <span class="restore-choice-label">Backup file</span>
          <span class="restore-choice-desc">Import a comma-vault-backup .json or encrypted .comdb — old exports work too</span>
        </button>
      </div>
      <input type="file" id="ob-import-file" accept=".json,.comdb,application/json" style="display:none" />
    `,
    size: 'sm',
    actions: [],
  });

  modal.root.querySelector('[data-choice="google-sync"]')?.addEventListener('click', () => {
    modal.close();
    handleJoinSync();
  });

  const fileInput = modal.root.querySelector('#ob-import-file');
  modal.root.querySelector('[data-choice="local-file"]')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
    modal.close();
    if (!file) return;
    const res = await importVaultFile(file);
    if ('cancelled' in res && res.cancelled) return;
    if (res.success) {
      showToast({ type: 'success', message: 'Backup imported ✓' });
      setTimeout(() => window.location.reload(), 900);
    } else {
      showToast({ type: 'error', message: res.error || 'Import failed.', duration: 3600 });
    }
  });
}

/**
 * "Google Sync" flow: connect Drive with the SAME Google account as the phone
 * → run the first full sync → adopt the synced profile and mark onboarding complete.
 * Password is no longer required — Drive connection + Google Account security is sufficient.
 */
async function handleJoinSync() {
  let unsubOk = null;
  let unsubFail = null;
  const cleanup = () => {
    unsubOk?.();
    unsubFail?.();
    unsubOk = null;
    unsubFail = null;
  };

  const modal = showModal({
    title: 'Sync from your phone',
    content: `
      <p class="text-secondary" style="margin:0 0 var(--space-3)">
        Connect the <strong>same Google account</strong> you use in the Comma app.
        Your records will sync into this browser and stay in sync both ways — no password needed.
      </p>
      <button type="button" class="btn btn-primary" data-join-connect style="width:100%">
        ${getIcon('google-drive', 18)} <span data-join-connect-label>Connect Google Drive</span>
      </button>
      <button type="button" class="btn btn-primary" data-join-start style="width:100%;margin-top:var(--space-3)" disabled>
        Start syncing
      </button>
      <p class="text-xs text-secondary" data-join-status style="margin-top:var(--space-2);min-height:1em"></p>
    `,
    size: 'sm',
    actions: [],
    onClose: cleanup,
  });

  const root = modal.root;
  const connectBtn = root.querySelector('[data-join-connect]');
  const connectLabel = root.querySelector('[data-join-connect-label]');
  const startBtn = root.querySelector('[data-join-start]');
  const statusEl = root.querySelector('[data-join-status]');

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
  const markConnected = () => {
    if (connectLabel) connectLabel.textContent = 'Google Drive connected ✓';
    connectBtn?.setAttribute('disabled', 'true');
    startBtn?.removeAttribute('disabled');
    setStatus('');
  };

  if (getAccessToken()) markConnected();

  unsubOk = bus.on('drive:auth_success', markConnected);
  unsubFail = bus.on('drive:auth_failed', () => setStatus('Google sign-in failed — try again.'));

  connectBtn?.addEventListener('click', () => {
    setStatus('Waiting for Google sign-in…');
    requestToken();
  });

  startBtn?.addEventListener('click', async () => {
    startBtn.setAttribute('disabled', 'true');
    setStatus('Syncing your data…');
    setSyncEnabled(true);
    try {
      // Default one-tap mode needs no password — the engine reads plain envelopes with an
      // empty key. But if the OTHER device turned E2E encryption ON, its files are encrypted
      // and we must ask for that password (syncNow reports needsPassphrase) — otherwise the
      // join silently pulls nothing and looks like "no data found".
      let res = await syncNow('');

      if (res.needsPassphrase) {
        setStatus('Your other device is end-to-end encrypted — enter its password.');
        const pw = await promptEncryptionPassword('enter');
        if (!pw) {
          setSyncEnabled(false);
          setStatus('Encryption password needed to sync from that device.');
          startBtn.removeAttribute('disabled');
          return;
        }
        setBackupPassword(pw);
        res = await syncNow(pw);
        if (res.needsPassphrase || res.pulledLogs === 0) {
          // Still can't read it → wrong password. Undo so a typo can't leave sync half-on.
          setSyncEnabled(false);
          clearBackupPassword();
          resetLogFailures();
          setStatus("That password didn't decrypt your data — make sure it matches your other device.");
          startBtn.removeAttribute('disabled');
          return;
        }
      }

      if (res.pulledLogs === 0) {
        setStatus('No synced data found yet. On your phone: Settings → Cloud Sync → Sync now, then press "Start syncing" again.');
        startBtn.removeAttribute('disabled');
        return;
      }

      const active = await db.platforms.filter((p) => p.active === true && p.syncDeletedAt == null).toArray();
      await saveUser({
        onboardingComplete: true,
        platforms: active.map((p) => p.id),
        primaryPlatform: active[0]?.id || null,
      });
      showToast({ type: 'success', message: `Synced ✓ ${res.appliedRows} records from your other device.` });
      cleanup();
      modal.close();
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setSyncEnabled(false);
      setStatus(err?.message || 'Sync failed — check your connection and try again.');
      startBtn.removeAttribute('disabled');
    }
  });
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

import { DEMO_WINDOW_DAYS } from '../demo/sample-year.js';
import { generateDemoRoutePath, demoVehicleTypeForIndex } from '../demo/demo-routes.js';

/**
 * Demo vault: three active platforms, weekday earnings across the recent ~2-month window ending
 * today (mobile parity — current data, not a fixed year), each shift carrying a road-snapped GPS
 * `routePath` so its card shows a route mini-map, plus sample expenses (all watermarked).
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
  // Mobile parity (store/useSettingsStore.ts loadSampleData): three demo vehicles, cycled
  // across shifts in the same car/scooter/ebike order the route mini-map already uses via
  // demoVehicleTypeForIndex, so the vehicle filter has real subset/one options to show off.
  const demoVehicleIds = ['demo_vehicle_car', 'demo_vehicle_scooter', 'demo_vehicle_ebike'];
  // Mirrors mobile's `await db.delete(vehicles)` before inserting demo vehicles — loadSampleData
  // can run more than once (repeat "Try Demo" clicks, the Settings "load sample" button), and a
  // second bulkAdd with the same fixed ids would throw a Dexie ConstraintError otherwise.
  await db.vehicles.clear();
  await db.vehicles.bulkAdd([
    {
      id: 'demo_vehicle_car', nickname: 'Toyota Prius', name: 'Toyota Prius',
      isActive: true, active: true, type: 'hybrid', make: 'Toyota', model: 'Prius', year: 2020,
      color: '', fuelType: null, licensePlate: '', currentOdometer: 0, fuelEfficiency: null,
      currentFuelPrice: null, kwPer100km: null, electricityRate: null, maintenanceCostPerKm: null,
      purchasePrice: null, expectedLifespanKm: null, totalKmLogged: 0,
      createdAt: t0, updatedAt: t0, syncUpdatedAt: Date.now(), syncDeletedAt: null,
    },
    {
      id: 'demo_vehicle_scooter', nickname: 'Honda Ruckus', name: 'Honda Ruckus',
      isActive: false, active: false, type: 'scooter', make: 'Honda', model: 'Ruckus', year: 2022,
      color: '', fuelType: null, licensePlate: '', currentOdometer: 0, fuelEfficiency: null,
      currentFuelPrice: null, kwPer100km: null, electricityRate: null, maintenanceCostPerKm: null,
      purchasePrice: null, expectedLifespanKm: null, totalKmLogged: 0,
      createdAt: t0, updatedAt: t0, syncUpdatedAt: Date.now(), syncDeletedAt: null,
    },
    {
      id: 'demo_vehicle_ebike', nickname: 'Rad Power RadCity', name: 'Rad Power RadCity',
      isActive: false, active: false, type: 'ebike', make: 'Rad Power', model: 'RadCity', year: 2023,
      color: '', fuelType: null, licensePlate: '', currentOdometer: 0, fuelEfficiency: null,
      currentFuelPrice: null, kwPer100km: null, electricityRate: null, maintenanceCostPerKm: null,
      purchasePrice: null, expectedLifespanKm: null, totalKmLogged: 0,
      createdAt: t0, updatedAt: t0, syncUpdatedAt: Date.now(), syncDeletedAt: null,
    },
  ]);
  const shiftRows = [];
  const expenseRows = [];
  let weekdayShiftCount = 0;
  // Seed the last ~2 months ending today, so the demo shows CURRENT data (mobile parity) rather
  // than a fixed calendar year. `dayIndex` (days since the window start) drives the same
  // pseudo-random variation the old `dayOfYear` did.
  const windowStart = new Date();
  windowStart.setHours(12, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - DEMO_WINDOW_DAYS);
  const windowEnd = new Date();
  windowEnd.setHours(12, 0, 0, 0);

  for (
    let d = new Date(windowStart);
    d.getTime() <= windowEnd.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    const dow = d.getDay();
    const dateStr = ymdFromDate(d);
    const dayOfYear = Math.round((d.getTime() - windowStart.getTime()) / 86400000);

    if (dow >= 1 && dow <= 5) {
      const platformId = DEMO_SAMPLE_PLATFORM_IDS[weekdayShiftCount % 3];
      const seed = weekdayShiftCount * 13 + dow;
      // Road-snapped GPS route for this shift's mini-map; scale cycles car → scooter → ebike.
      const routeVehicleType = demoVehicleTypeForIndex(weekdayShiftCount);
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
        bonusAmount: bonusDollars,
        deliveryCount: 6 + (seed % 7),
        activeMileage: 28 + (seed % 55),
        deadMileage: seed % 4,
        provinceId: sampleProvinceId,
        onlineMinutes: 220 + (seed % 80),
        activeMinutes: 170 + (seed % 70),
        vehicleId: demoVehicleIds[weekdayShiftCount % 3],
        routePath: generateDemoRoutePath(weekdayShiftCount, routeVehicleType),
        weather: seed % 3 === 0 ? 'Rain' : seed % 3 === 1 ? 'Cloudy' : 'Clear',
        mood: '🙂',
        notes: SAMPLE_NOTE,
        isTemplate: false,
        templateName: null,
        isPlaceholder: true,
        isMultiApp: false,
        multiAppSplit: {},
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
      // Mobile mirror + LWW stamp (interop audit) — mobile reads `isActive`, and an
      // unstamped write never pushes, so the chosen platform set stayed device-local.
      isActive: active,
      syncUpdatedAt: Date.now(),
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
    const nickname = v.nickname.trim() || 'Vehicle';
    const vehicleId = newId('veh');
    await db.vehicles.add({
      id: vehicleId,
      nickname,
      // Mobile-canonical mirrors (interop audit): mobile's vehicles.name is NOT NULL.
      name: nickname,
      isActive: true,
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

    // Seed a tax-year profile so the mileage write-off shown later reflects what the user told
    // us during onboarding (opt out entirely, a custom rate, or the researched default for their
    // vehicle type/country) — never a blind flat rate. Mirrors mobile's
    // `store/useSettingsStore.ts` seedDefaultTaxProfile.
    await seedDefaultTaxProfile(vehicleId, v, draft.country);
  }
}

/**
 * @param {string} vehicleId
 * @param {{ type: string, mileageOptOut?: boolean, mileageRateOverride?: string }} draftVehicle
 * @param {string} countryId
 */
async function seedDefaultTaxProfile(vehicleId, draftVehicle, countryId) {
  const taxYear = new Date().getFullYear();

  if (draftVehicle.mileageOptOut) {
    await upsertTaxProfile({
      vehicleId,
      taxYear,
      deductionMethod: 'actual_expenses',
      country: countryId,
      standardRatePrimary: null,
      standardRateSecondary: null,
      rateThreshold: null,
    });
    return;
  }

  const override = draftVehicle.mileageRateOverride ? parseFloat(draftVehicle.mileageRateOverride) : null;
  if (override != null && !Number.isNaN(override)) {
    await upsertTaxProfile({
      vehicleId,
      taxYear,
      deductionMethod: 'standard_mileage',
      country: countryId,
      standardRatePrimary: override,
      standardRateSecondary: null,
      rateThreshold: null,
    });
    return;
  }

  const def = getVehicleMileageEligibility(countryId, draftVehicle.type);
  await upsertTaxProfile({
    vehicleId,
    taxYear,
    deductionMethod: def.eligible ? 'standard_mileage' : 'actual_expenses',
    country: countryId,
    standardRatePrimary: def.ratePrimary,
    standardRateSecondary: def.rateSecondary,
    rateThreshold: def.rateThreshold,
  });
}

/**
 * @param {OnboardingDraft} draft
 */
async function persistWeeklyGoalRow(draft) {
  const row = await db.goals.filter((g) => g.scope === 'weekly' && g.type === 'earnings').first();
  if (row?.id != null) {
    const target = Math.max(0, Number(draft.weeklyGoal) || 0);
    await db.goals.update(row.id, {
      target,
      active: true,
      // Mobile-canonical mirrors (interop audit) — keep targetValue/isActive in step.
      targetValue: target,
      isActive: true,
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
    if (field === 'lastShiftHours' || field === 'lastShiftGross' || field === 'lastShiftDistance') {
      if (!draft.lastShift) draft.lastShift = { platformId: '', hours: '', gross: '', distance: '' };
      const k = field.replace('lastShift', '').toLowerCase();
      draft.lastShift[k] = el.value;
      return;
    }
    draft[field] = el.value;
  });

  root.querySelectorAll('[data-vehicle-idx]').forEach((el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    const idx = Number(el.getAttribute('data-vehicle-idx'));
    const vf = el.getAttribute('data-vehicle-field');
    if (!Number.isFinite(idx) || !vf || !draft.vehicles[idx]) return;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      draft.vehicles[idx][vf] = el.checked;
      return;
    }
    draft.vehicles[idx][vf] = el.value;
  });

  root.querySelectorAll('[data-np]').forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    const k = el.getAttribute('data-np');
    if (k && draft.notificationPrefs) draft.notificationPrefs[k] = el.checked;
  });
}

const STEP_LOCATION = 0;
const STEP_LAST_SHIFT = 1;

/** The vehicle we assume until the driver tells us otherwise. Matches the reveal's assumption. */
const DEFAULT_VEHICLE = {
  nickname: 'My Car',
  type: ASSUMED_VEHICLE_TYPE,
  make: '',
  model: '',
  year: '',
  mileageOptOut: false,
  mileageRateOverride: '',
};

const DEFAULT_WEEKLY_GOAL = 500;

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

  /** Set once the driver reaches the reveal; its presence is what makes the reveal render. */
  let revealMath = null;

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
      // Goals, name, theme and tax % are no longer asked for — they are not inputs to the number
      // the reveal shows, so they default here and are offered by the dashboard checklist instead.
      weeklyGoal: Math.round(Number(d.weeklyGoal || DEFAULT_WEEKLY_GOAL) * 100),
      monthlyGoal: Math.round(Number(d.monthlyGoal || DEFAULT_WEEKLY_GOAL * 4.33) * 100),
      annualGoal: Math.round(Number(d.annualGoal || DEFAULT_WEEKLY_GOAL * 52) * 100),
      taxWithholdingPct: d.taxWithholdingPct,
      hstRegistered: getCountryTaxProfile(country).hstOnboarding ? d.hstRegistered : false,
      theme: d.theme,
      notificationPrefs: { ...d.notificationPrefs },
      onboardingComplete: true,
      onboardingStep: TOTAL_STEPS,
    };
  }

  const render = () => {
    // The reveal and its no-shift-yet counterpart are terminal screens rather than steps: they
    // own their own CTA, carry no progress chrome, and there is nowhere to go "next" from them.
    if (revealMath || draft.noShiftYet) {
      root.innerHTML = `
        <div class="onboarding-flow" role="region" aria-label="${escAttr(t('views.onboarding.title'))}">
          <div class="onboarding-body card card-raised" data-step-body>${
            revealMath ? renderReveal(revealMath) : renderNoShiftYet()
          }</div>
        </div>`;
      bindStep(root);
      if (revealMath) animateRevealHourly(root);
      return;
    }

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
    const navHtml = isLanding
      ? ''
      : `<div class="onboarding-nav">
          <button type="button" class="btn btn-secondary" data-back>${escHtml(t('common.back'))}</button>
          <button type="button" class="btn btn-primary" data-next>${escHtml(
            isLast ? t('onboarding.steps.lastShiftCta') : t('common.next'),
          )}</button>
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

    if (draft.step === 4) {
      // Vehicle type and the opt-out toggle both change what's shown (eligibility text /
      // custom-rate field) — unlike most fields on this step, these need a live re-render
      // rather than waiting for the "Next" commit, matching the country-select pattern above.
      const vType = body.querySelector('[data-vehicle-idx="0"][data-vehicle-field="type"]');
      if (vType instanceof HTMLSelectElement) {
        vType.addEventListener('change', () => {
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        });
      }
      const vOptOut = body.querySelector('[data-vehicle-idx="0"][data-vehicle-field="mileageOptOut"]');
      if (vOptOut instanceof HTMLInputElement) {
        vOptOut.addEventListener('change', () => {
          readFormIntoDraft(el, draft);
          persistSession(draft);
          render();
        });
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

    body.querySelector('[data-action="restore-sync"]')?.addEventListener('click', () => {
      handleRestoreSync();
    });

    body.querySelectorAll('[data-last-shift-platform]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-last-shift-platform');
        if (!id) return;
        if (!draft.lastShift) draft.lastShift = { platformId: '', hours: '', gross: '', distance: '' };
        readFormIntoDraft(el, draft);
        draft.lastShift.platformId = id;
        persistSession(draft);
        render();
      });
    });

    body.querySelector('[data-no-shift-yet]')?.addEventListener('click', () => {
      draft.noShiftYet = true;
      persistSession(draft);
      render();
    });

    // The landing headline cycles the word for a work session. Every render replaces the
    // DOM, so tear the previous timer down first or they stack up and the words race.
    stopLandingFlip?.();
    stopLandingFlip = initLandingFlip(body);

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
          await persistWeeklyGoalRow(draft);
          const displayName = draft.displayName.trim() || 'Hustler';
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
      if (draft.step === 0 && !draft.landingComplete) return;

      const err = validateStep(draft.step, draft, platformRows);
      if (err) {
        showToast({ type: 'warning', message: t(err) });
        return;
      }

      if (draft.step === STEP_LOCATION) {
        normalizeTaxRegionForCountry(draft);
        pruneSelectedPlatformsForRegion(draft, platformRows);
        draft.step = STEP_LAST_SHIFT;
        persistSession(draft);
        await saveUser({ onboardingStep: draft.step });
        render();
        return;
      }

      // Last step — the driver has given us a shift, so show them what it was worth. Nothing is
      // written yet; persistence happens on the reveal's CTA, so bailing here leaves no residue.
      const ls = draft.lastShift || {};
      draft.selectedPlatforms = ls.platformId ? [ls.platformId] : draft.selectedPlatforms;
      revealMath = computeFirstShift({
        country: draft.country,
        region: draft.taxRegion,
        gross: Number(ls.gross) || 0,
        hours: Number(ls.hours) || 0,
        distance: Number(ls.distance) || 0,
      });
      persistSession(draft);
      render();
    });
  }

  /** Counts the hero from the gross hourly rate down to the real one — the gap IS the insight. */
  function animateRevealHourly(root) {
    const el = root.querySelector('[data-reveal-hourly]');
    if (!el) return;
    const from = Number(el.getAttribute('data-from')) || 0;
    const to = Number(el.getAttribute('data-to')) || 0;
    const symbol = el.getAttribute('data-symbol') || '$';
    if (!(from > 0) || Math.abs(to - from) < 0.01) return;

    const DURATION = 1200;
    const t0 = performance.now();
    const paint = (v) => {
      el.innerHTML = `${symbol}${v.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}<small>/hr</small>`;
    };
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      paint(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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

    // Onboarding no longer asks for a vehicle, but the app needs one to hang shifts and tax
    // profiles off. Seed the same gas car the reveal assumed, so the write-off it promised stays
    // true; the checklist invites the driver to replace it with their real one.
    draft.vehicles[0] = { ...DEFAULT_VEHICLE };

    await applyPlatformsFromDraft(draft);
    await persistVehicles(draft);
    await persistWeeklyGoalRow(draft);

    await saveUser(buildCompletedUserPatch(draft, draft.displayName.trim() || 'Driver'));

    if (revealMath) await persistFirstShift(revealMath);

    clearSession();
    await store.refresh('user');
    await store.refresh('platforms');
    await store.refresh('currentWeekEarnings');
    await store.refresh('currentWeekGoal');
    bus.emit(ONBOARDING_COMPLETE, { displayName: draft.displayName });
    showToast({ type: 'celebration', message: t('onboarding.completeToast'), duration: 4500 });
    Router.navigate('#/dashboard');
  }

  /**
   * Saves the backfilled shift.
   *
   * Anchored to *now* rather than to a guessed past date, deliberately: the dashboard reports on
   * the current week, so a shift dated to "yesterday" silently falls outside it whenever today is
   * the first day of the week — and the driver would land on a wall of zeros seconds after being
   * shown their hourly rate. Being a few hours off on a timestamp they can edit is a much smaller
   * cost than breaking the moment the whole flow is built around.
   */
  async function persistFirstShift(m) {
    const ls = draft.lastShift || {};
    const vehicles = await db.vehicles.toArray();
    const vehicleId = vehicles[0]?.id ?? null;

    const endTime = Date.now();
    const durationSeconds = Math.round(m.hours * 3600);

    await saveShift({
      platformId: ls.platformId,
      vehicleId,
      startTime: endTime - durationSeconds * 1000,
      endTime,
      durationSeconds,
      grossRevenue: m.gross,
      activeMileage: m.distance,
      distanceSource: 'manual',
      notes: 'Your first shift — logged during setup. Open it to correct the date or details.',
    });
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
