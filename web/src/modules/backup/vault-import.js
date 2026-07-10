/**
 * COMMA — Local backup-file import (Settings → Data → "Import backup file").
 *
 * Accepts every backup this app has ever produced:
 *   - CURRENT vault JSON (`schemaVersion` ≥ 4, `{exportedAt, schemaVersion, tables, integrity}`)
 *     → straight through `deserializeVault` (raw put + integrity check + mobile-shape backfill).
 *   - LEGACY vault JSON (`schemaVersion` ≤ 3 — the pre-interop web app) → transformed row-by-row
 *     through the CURRENT normalizers, because the old data model differs materially:
 *       · money was stored in integer CENTS (shifts.grossEarnings/tips/bonusEarnings,
 *         expenses.amount) — divided by 100 here; goals.target was already dollars (verified:
 *         legacy goalHistory.actual carries decimal dollar values)
 *       · shift times were `HH:mm` strings + `durationMinutes` (the normalizer derives epoch-ms
 *         startTime/endTime and durationSeconds from them)
 *       · primary keys were numeric — fresh string ids are minted and the relations remapped
 *         (shifts.vehicleId, expenses.shiftId, goalHistory.goalId)
 *       · old field names map onto current ones (grossEarnings→grossRevenue, tips→tipsRevenue,
 *         bonusEarnings→bonusAmount, distanceKm→activeMileage, deadMilesKm→deadMileage,
 *         businessPct→deductiblePct — the normalizers already alias most of these)
 *   - Encrypted `.comdb` files are handled by the CALLER (decrypt first, then pass the payload
 *     here) — see data-settings.js.
 *
 * Both paths REPLACE this device's data (like a restore), then run `backfillMobileShapeKeys()`
 * — which also rewinds the sync push cursor — so everything imported flows to the phone on the
 * next sync push.
 */

import { db, backfillMobileShapeKeys } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { showModal, showConfirm } from '../../ui/components.js';
import { t } from '../../utils/strings.js';
import { deserializeVault } from './vault-serializer.js';
import { decryptBackup } from './encryption.js';
import { normalizeShiftInput } from '../shifts/shifts.js';
import { normalizeExpenseInput } from '../expenses/expenses.js';
import { normalizeVehicleInput } from '../vehicles/vehicles.js';
import { mobileGoalKeys } from '../../services/sync/interopShape.js';

/**
 * Full user-facing import flow for a picked backup File: parse (password-prompting for
 * encrypted `.comdb` envelopes), destructive-replace confirm, then `importVaultData`.
 * @param {File} file
 * @returns {Promise<{cancelled: true} | {success: boolean, error?: string, counts?: Record<string, number>, skipped?: string[]}>}
 */
export async function importVaultFile(file) {
  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
    if (data && data.v === 2 && data.salt && data.iv && data.content && data.tag) {
      // Encrypted .comdb envelope — ask for the backup password, then decrypt.
      const password = await promptBackupPassword();
      if (!password) return { cancelled: true };
      data = JSON.parse(await decryptBackup(text, password));
    }
    if (data && data.magic === 'COMMA_VAULT') {
      return {
        success: false,
        error: 'This is the very old encrypted format — restore it once in the previous app version, then export again.',
      };
    }
  } catch (err) {
    return { success: false, error: err?.message || 'Invalid backup file.' };
  }

  const confirmed = await showConfirm({
    title: 'Import backup?',
    message:
      'This replaces ALL data on this device with the backup contents. Other synced devices are untouched until the next sync (which will then receive the imported data).',
    confirmLabel: 'Import & replace',
    confirmClass: 'btn btn-danger',
  });
  if (!confirmed) return { cancelled: true };

  return importVaultData(data);
}

/** Small password prompt for encrypted .comdb imports. Resolves '' on cancel. */
function promptBackupPassword() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="text-secondary" style="margin:0 0 var(--space-3)">This backup is encrypted — enter the backup password it was made with.</p>
      <label class="input-group"><span class="input-label">Backup password</span>
        <input type="password" class="input" data-import-password autocomplete="off" /></label>
    `;
    showModal({
      title: 'Encrypted backup',
      content: wrap,
      size: 'sm',
      onClose: () => done(''),
      actions: [
        { label: t('common.cancel') || 'Cancel', class: 'btn btn-ghost', onClick: () => done(''), close: true },
        {
          label: 'Decrypt',
          class: 'btn btn-primary',
          autofocus: true,
          onClick: () => {
            const input = wrap.querySelector('[data-import-password]');
            done(input && 'value' in input ? String(/** @type {HTMLInputElement} */ (input).value || '') : '');
          },
          close: true,
        },
      ],
    });
  });
}

/** @param {unknown} v integer cents → dollars (rounds odd float input defensively) */
function centsToDollars(v) {
  return Math.round(Number(v) || 0) / 100;
}

/**
 * Route a parsed vault payload to the right importer by its schema generation.
 * @param {Record<string, any>} data parsed backup JSON
 * @returns {Promise<{success: boolean, error?: string, counts?: Record<string, number>, skipped?: string[]}>}
 */
export async function importVaultData(data) {
  if (!data || typeof data !== 'object' || !data.tables || typeof data.tables !== 'object') {
    return { success: false, error: 'Not a Comma backup file (missing data tables).' };
  }
  const version = Number(data.schemaVersion) || 0;
  if (version >= 4) {
    return deserializeVault(data);
  }
  return importLegacyVault(data);
}

/** SHA-256 integrity check, same contract as deserializeVault's. */
async function integrityOk(data) {
  if (!data.integrity?.sha256) return true; // older exports without integrity — accept
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data.tables)));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === data.integrity.sha256;
  } catch (err) {
    console.warn('[vault-import] skipping integrity check (crypto error)', err);
    return true;
  }
}

/**
 * Import a legacy (schemaVersion ≤ 3) vault. See module doc for the transform rules.
 * @param {Record<string, any>} data
 */
async function importLegacyVault(data) {
  if (!(await integrityOk(data))) {
    return { success: false, error: 'Backup integrity validation failed (hash mismatch). File may be corrupted or truncated.' };
  }

  const t = data.tables;
  const counts = { vehicles: 0, shifts: 0, expenses: 0, goals: 0 };
  /** @type {string[]} */
  const skipped = [];

  try {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        if (table.name === 'appState') continue;
        await table.clear();
      }

      // users — merge onto the fixed id-1 row; the wizard is done as far as this vault knows.
      const legacyUser = Array.isArray(t.users) && t.users[0] ? t.users[0] : null;
      if (legacyUser) {
        await db.users.put({ ...legacyUser, id: 1, onboardingComplete: true });
      }

      // platforms — legacy rows are shape-compatible with today's (slug ids, name/color/active/
      // priority…); stamp 0 so restored catalog state can't beat another device's real state in
      // LWW. The backfill below adds the mobile-canonical keys.
      if (Array.isArray(t.platforms)) {
        await db.platforms.bulkPut(
          t.platforms.map((p) => ({ ...p, syncUpdatedAt: 0, syncDeletedAt: null }))
        );
      }

      // vehicles — numeric ids → fresh string ids (map kept for shift references).
      const vehicleIdMap = new Map();
      for (const v of t.vehicles || []) {
        const row = normalizeVehicleInput({ ...v, id: undefined });
        vehicleIdMap.set(String(v.id), row.id);
        await db.vehicles.add(row);
        counts.vehicles += 1;
      }

      // shifts — cents→dollars; the normalizer derives epoch-ms times from date+HH:mm and
      // durationSeconds from durationMinutes, and stamps the sync clock.
      const shiftIdMap = new Map();
      for (const s of t.shifts || []) {
        try {
          const row = normalizeShiftInput({
            ...s,
            id: undefined,
            vehicleId: s.vehicleId == null ? null : (vehicleIdMap.get(String(s.vehicleId)) ?? null),
            grossRevenue: centsToDollars(s.grossEarnings ?? s.grossRevenue),
            tipsRevenue: centsToDollars(s.tips ?? s.tipsRevenue),
            bonusAmount: centsToDollars(s.bonusEarnings ?? s.bonusAmount),
          });
          shiftIdMap.set(String(s.id), row.id);
          await db.shifts.add(row);
          counts.shifts += 1;
        } catch (err) {
          skipped.push(`shift ${s.date || ''} #${s.id}: ${err?.message || err}`);
        }
      }

      // expenses — cents→dollars, businessPct aliased by the normalizer, shift link remapped.
      for (const e of t.expenses || []) {
        try {
          const row = normalizeExpenseInput({
            ...e,
            id: undefined,
            amount: centsToDollars(e.amount),
            shiftId: e.shiftId == null ? null : (shiftIdMap.get(String(e.shiftId)) ?? null),
          });
          await db.expenses.add(row);
          counts.expenses += 1;
        } catch (err) {
          skipped.push(`expense ${e.date || ''} #${e.id}: ${err?.message || err}`);
        }
      }

      // goals — targets were already dollars in legacy data (verified against goalHistory's
      // decimal `actual` values); carry the mobile-canonical keys.
      const goalIdMap = new Map();
      for (const g of t.goals || []) {
        const type = String(g.type || 'earnings').toLowerCase();
        const scope = String(g.scope || 'weekly').toLowerCase();
        const target = Math.max(0, Number(g.target) || 0);
        const active = g.active !== false;
        const row = {
          id: newId('goal'),
          type,
          scope,
          platformId: g.platformId ?? null,
          target,
          active,
          createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
          ...mobileGoalKeys({ type, scope, target, active }),
          syncUpdatedAt: Date.now(),
          syncDeletedAt: null,
        };
        goalIdMap.set(String(g.id), row.id);
        await db.goals.add(row);
        counts.goals += 1;
      }

      // goalHistory — keep (web-local history), remap the goal link, let ++id re-mint.
      if (Array.isArray(t.goalHistory) && t.goalHistory.length) {
        await db.goalHistory.bulkAdd(
          t.goalHistory.map(({ id: _old, ...h }) => ({
            ...h,
            goalId: goalIdMap.get(String(h.goalId)) ?? h.goalId,
          }))
        );
      }

      // Device-local extras — verbatim (stable shapes). Auto-increment stores get fresh ids;
      // vehicle references remapped where present.
      if (Array.isArray(t.badges) && t.badges.length) await db.badges.bulkPut(t.badges);
      if (Array.isArray(t.challenges) && t.challenges.length) await db.challenges.bulkPut(t.challenges);
      if (Array.isArray(t.notifications) && t.notifications.length) await db.notifications.bulkPut(t.notifications);
      if (Array.isArray(t.xpLog) && t.xpLog.length) {
        await db.xpLog.bulkAdd(t.xpLog.map(({ id: _old, ...r }) => r));
      }
      if (Array.isArray(t.backupLog) && t.backupLog.length) {
        await db.backupLog.bulkAdd(t.backupLog.map(({ id: _old, ...r }) => r));
      }
      for (const name of ['fuelPrices', 'vehicleOdometerLog']) {
        const rows = t[name];
        if (!Array.isArray(rows) || !rows.length) continue;
        await db[name].bulkAdd(
          rows.map(({ id: _old, ...r }) => ({
            ...r,
            vehicleId: r.vehicleId == null ? r.vehicleId : (vehicleIdMap.get(String(r.vehicleId)) ?? r.vehicleId),
          }))
        );
      }

      // vehicleMaintenanceLogs — legacy shape had date/type/cost/odometer already; remap vehicle.
      for (const m of t.vehicleMaintenanceLogs || []) {
        await db.vehicleMaintenanceLogs.add({
          ...m,
          id: newId('mnt'),
          vehicleId: m.vehicleId == null ? null : (vehicleIdMap.get(String(m.vehicleId)) ?? null),
          syncUpdatedAt: Date.now(),
          syncDeletedAt: null,
        });
      }
    });
  } catch (err) {
    console.error('[vault-import] legacy import failed', err);
    return { success: false, error: err?.message || 'Failed to write to the local database.' };
  }

  // Mobile-shape keys + sync-stamp backfill + push-cursor rewind — the imported data must
  // reach the phone on the next sync.
  await backfillMobileShapeKeys();

  return { success: true, counts, skipped };
}
