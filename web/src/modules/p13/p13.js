import { db, getAppState, setAppState } from '../../core/db.js';
import { newId } from '../../core/id.js';
import { getDefaultSamplePlatformId } from '../../registry/platforms/index.js';
import { isVaultActive } from '../../core/vault-gate.js';
import { showModal, showToast } from '../../ui/components.js';

const APP_VERSION = '1.0.0';
const DAILY_BREAK_REMINDER_MIN = 120;
const DAILY_MILEAGE_WARN_KM = 250;

const DID_YOU_KNOW_TIPS = [
  'Track one extra expense each day to improve net-profit accuracy.',
  'Review weekly net hourly instead of gross hourly for better decisions.',
  'Tag shifts with notes when traffic or weather impacts earnings.',
  'Export a vault backup before major app updates.',
];

const COMMUNITY_TIPS = [
  'Stack low-mile offers during peak windows to protect hourly net.',
  'Keep one fallback hotspot if your main zone stalls out.',
  'Snapshot your weekly trend every Sunday to guide target hours.',
];

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function maybeShowChangelog() {
  const seen = await getAppState('p13_seen_version');
  if (seen === APP_VERSION) return;
  showModal({
    title: 'What is new',
    content: `<div class="p13-modal-list">
      <p>COMMA ${APP_VERSION} includes polish updates:</p>
      <ul>
        <li>Year-in-review export card</li>
        <li>Zen mode and wellbeing nudges</li>
        <li>Developer debug utilities</li>
      </ul>
    </div>`,
    actions: [{ label: 'Nice', class: 'btn btn-primary' }],
    size: 'sm',
  });
  await setAppState('p13_seen_version', APP_VERSION);
}

async function maybeShowDidYouKnowTip() {
  const lastDate = await getAppState('p13_tip_last_date');
  const today = todayYmd();
  if (lastDate === today) return;
  const idx = asNumber(await getAppState('p13_tip_index'), 0) % DID_YOU_KNOW_TIPS.length;
  const tip = DID_YOU_KNOW_TIPS[idx];
  showToast({
    type: 'info',
    message: `Did you know? ${tip}`,
    duration: 5200,
  });
  await setAppState('p13_tip_index', idx + 1);
  await setAppState('p13_tip_last_date', today);
}

async function maybeShowReviewNudge() {
  const count = asNumber(await getAppState('p13_open_count'), 0) + 1;
  await setAppState('p13_open_count', count);
  const dismissed = await getAppState('p13_review_dismissed');
  if (dismissed || count < 8 || count % 4 !== 0) return;
  showModal({
    title: 'Enjoying COMMA?',
    content: '<p>If you\'re finding COMMA helpful, a quick thank you or suggestion goes a long way! You can also support the developer directly.</p>',
    actions: [
      {
        label: 'Say Thanks & Support',
        class: 'btn btn-primary',
        onClick: () => {
          showToast({
            type: 'success',
            message: 'Thank you so much for your support! 💚',
            duration: 3500,
          });
          window.location.hash = '#/support';
        }
      },
      {
        label: 'Later',
        class: 'btn btn-secondary',
      },
      {
        label: 'Do not ask again',
        class: 'btn btn-ghost',
        onClick: () => {
          void setAppState('p13_review_dismissed', true);
        },
      },
    ],
    size: 'sm',
  });
}

async function maybeShowWellbeingToasts() {
  const [activeShift, warnedDate] = await Promise.all([
    getAppState('active_shift_start'),
    getAppState('p13_break_warn_date'),
  ]);
  const today = todayYmd();
  if (warnedDate !== today && activeShift && typeof activeShift.startTime === 'string') {
    const runningMs = Date.now() - new Date(activeShift.startTime).getTime();
    if (runningMs >= DAILY_BREAK_REMINDER_MIN * 60000) {
      showToast({
        type: 'warning',
        message: 'Break reminder: you have been active for 2+ hours. Hydrate and reset.',
        duration: 6500,
      });
      await setAppState('p13_break_warn_date', today);
    }
  }

  const shiftRows = await db.shifts.where('date').equals(today).filter((s) => s.deletedAt == null).toArray();
  const totalKm = shiftRows.reduce((sum, row) => sum + asNumber(row.activeMileage), 0);
  const mileageWarnDate = await getAppState('p13_mileage_warn_date');
  if (totalKm >= DAILY_MILEAGE_WARN_KM && mileageWarnDate !== today) {
    showToast({
      type: 'warning',
      message: `Mileage health warning: ${Math.round(totalKm)}km today. Consider ending early.`,
      duration: 7000,
    });
    await setAppState('p13_mileage_warn_date', today);
  }
}

function buildSchemaDump() {
  return db.tables.map((table) => ({ table: table.name, schema: table.schema.primKey.src || 'unknown' }));
}

async function inspectVault() {
  const out = {};
  for (const table of db.tables) {
    out[table.name] = await table.toArray();
  }
  return out;
}

async function timedQuery(tableName, limit = 50) {
  const table = db.table(tableName);
  const started = performance.now();
  const rows = await table.limit(limit).toArray();
  const elapsedMs = performance.now() - started;
  return { table: tableName, limit, count: rows.length, elapsedMs };
}

async function generateSyntheticData() {
  const today = new Date();
  const rows = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const durationSeconds = (210 + i * 5) * 60;
    // Fix 1 (interop plan) — startTime/endTime are real epoch-ms timestamps; this dev-tool
    // generator builds rows manually (bypassing normalizeShiftInput), so derive them itself:
    // noon local time + the row's own duration.
    const startMs = new Date(`${dateStr}T12:00:00`).getTime();
    const platformId = getDefaultSamplePlatformId();
    rows.push({
      id: newId('shift'),
      date: dateStr,
      platformId,
      // Mobile-canonical mirror (interop audit) — these rows sync like real ones, and
      // mobile's shifts.platform is NOT NULL.
      platform: String(platformId || 'other'),
      startTime: startMs,
      endTime: startMs + durationSeconds * 1000,
      grossRevenue: 90 + i * 8,
      tipsRevenue: 16 + i * 2,
      bonusAmount: i % 2 === 0 ? 5 : 0,
      activeMileage: 42 + i * 3,
      durationSeconds,
      deliveryCount: 11 + i,
      deletedAt: null,
      syncUpdatedAt: Date.now(),
      syncDeletedAt: null,
    });
  }
  await db.shifts.bulkAdd(rows);
  return rows.length;
}

export function getCommunityTips() {
  return [...COMMUNITY_TIPS];
}

export function getDidYouKnowTips() {
  return [...DID_YOU_KNOW_TIPS];
}

export async function initP13() {
  window.__comma = window.__comma || {};
  window.__comma.debug = {
    inspectVault,
    timedQuery,
    generateSyntheticData,
    schemaDump: buildSchemaDump,
  };
  if (!(await isVaultActive())) return;
  // Disabled to prevent duplicate/legacy modal rendering (v1.3.0 changelog is the single source of truth)
  // await maybeShowChangelog();
  await maybeShowDidYouKnowTip();
  await maybeShowReviewNudge();
  await maybeShowWellbeingToasts();
}

export function toggleZenMode(force) {
  const body = document.body;
  if (!body) return false;
  const next = typeof force === 'boolean' ? force : !body.classList.contains('zen-mode');
  body.classList.toggle('zen-mode', next);
  showToast({
    type: 'info',
    message: next ? 'Zen Mode enabled' : 'Zen Mode disabled',
    duration: 2000,
  });
  return next;
}

export function apiSpecMarkdown() {
  return `# COMMAAPI (Local Module Spec)

## Surface
- \`window.__comma.debug.inspectVault()\` -> full table export object
- \`window.__comma.debug.timedQuery(table, limit?)\` -> IndexedDB query timing payload
- \`window.__comma.debug.generateSyntheticData()\` -> inserts synthetic shift rows
- \`window.__comma.debug.schemaDump()\` -> table + primary-key schema snapshot

## Notes
- All calls are local-first and run against IndexedDB.
- Debug helpers are for development/testing and should not be exposed in external APIs.
`;
}
