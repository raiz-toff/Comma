/**
 * COMMA — Vault Serializer
 * Handles converting the Dexie database to a portable JSON format and back.
 */

import { db, CURRENT_LOGICAL_SCHEMA_VERSION, getAppState, backfillMobileShapeKeys } from '../../core/db.js';

/**
 * Serializes the entire database into a JSON structure.
 * @returns {Promise<string>} JSON string
 */
export async function serializeVault() {
  const tables = {};
  
  // We serialize all tables to ensure full fidelity
  for (const table of db.tables) {
    tables[table.name] = await table.toArray();
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(tables)));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
  const rowCounts = {};
  for (const [name, list] of Object.entries(tables)) {
    rowCounts[name] = Array.isArray(list) ? list.length : 0;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: await getAppState('schema_version') || CURRENT_LOGICAL_SCHEMA_VERSION,
    tables: tables,
    integrity: { sha256: hashHex, rowCounts }
  };

  return JSON.stringify(payload);
}

/**
 * Validates and restores a vault from a JSON object.
 * @param {Object} data 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deserializeVault(data) {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid vault data format.' };
  }

  if (!data.tables || typeof data.tables !== 'object') {
    return { success: false, error: 'Vault is missing data tables.' };
  }

  if (data.integrity) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data.tables)));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');
      if (hashHex !== data.integrity.sha256) {
        return { success: false, error: 'Backup integrity validation failed (hash mismatch). File may be corrupted or truncated.' };
      }
    } catch (err) {
      console.warn('[vault-serializer] Skipping integrity check due to crypto error', err);
    }
  }

  // Basic validation of schema version
  const backupVersion = Number(data.schemaVersion) || 0;
  if (backupVersion > CURRENT_LOGICAL_SCHEMA_VERSION) {
    return { 
      success: false, 
      error: `This backup was made with a newer version of Comma (v${backupVersion}). Please update the app first.` 
    };
  }

  try {
    await db.transaction('rw', db.tables, async () => {
      // 1. Clear all current tables
      for (const table of db.tables) {
        if (table.name === 'appState') continue;
        await table.clear();
      }

      // 2. Import data into each table
      for (const [tableName, rows] of Object.entries(data.tables)) {
        if (tableName === 'appState') continue;
        const table = db.table(tableName);
        if (table && Array.isArray(rows)) {
          // Use bulkPut to preserve IDs and handle potential overlaps
          await table.bulkPut(rows);
        }
      }
    });

    // appState.schema_version survives the restore, so logical migrations will NOT re-run —
    // re-apply the mobile-shape backfill directly in case this vault predates the interop fix
    // (2026-07-03 audit): restored rows must carry platform/name/label/… before they sync.
    await backfillMobileShapeKeys();

    return { success: true };
  } catch (err) {
    console.error('[vault-serializer] Restore failed', err);
    return { success: false, error: err.message || 'Failed to write to local database.' };
  }
}
