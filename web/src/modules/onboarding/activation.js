/**
 * The activation panel — where the setup we cut from the wizard actually lives.
 *
 * Mirror of the phone app's `src/services/onboarding/activationChecklist.ts` and
 * `components/ActivationChecklist.tsx`. Keep the two in step.
 *
 * Nothing here is asked before the driver has seen their first number, because none of it is an
 * input to that number. Each item is instead surfaced on the dashboard next to the value it
 * unlocks, so the ask arrives with a reason attached.
 *
 * Done-ness is DERIVED FROM THE TABLE THAT ACTUALLY STORES THE THING, never from the cached user
 * record. That distinction matters and got this wrong once already: active platforms live in
 * `db.platforms` (active), and the weekly target is a row in `db.goals` — the copies on the user
 * record are stale defaults written at onboarding. Deriving from those meant the driver could go
 * set a goal, come back, and find the item still unticked, because the thing they changed was
 * never the thing being read.
 *
 * The card cannot be dismissed: it stays until every item is genuinely done, because a driver who
 * waves it away is exactly the one who forgets to come back and set any of it up.
 */

import { db, getUser, getAppState, setAppState } from '../../core/db.js';
import { store } from '../../core/store.js';
import { isSyncEnabled } from '../../services/sync/syncState.js';
import { renderEmptyState } from '../../ui/components.js';
import { t } from '../../utils/strings.js';

/**
 * Items the driver explicitly completed, for the ones we cannot infer from state alone.
 *
 * The goal is the case in point: onboarding seeds a 500 default, so "target !== 500" is the only
 * available signal — which would trap a driver who genuinely *wants* 500 with an item they can
 * never tick. Since the card can no longer be dismissed, that trap would be permanent. upsertGoal
 * records this on save, so any deliberate choice counts.
 */
const DONE_KEY = 'activation_checklist_done';

/** The weekly goal onboarding writes by default (goals table stores DOLLARS, unlike user.weeklyGoal
 *  which is cents). Used to tell "untouched" from "chosen". */
const DEFAULT_WEEKLY_GOAL = 500;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function readDoneOverrides() {
  const raw = await getAppState(DONE_KEY);
  return new Set(Array.isArray(raw) ? raw.map(String) : []);
}

/** Called by the screen that satisfies an item, at the moment it actually saves. */
export async function markActivationDone(id) {
  const done = await readDoneOverrides();
  if (done.has(id)) return;
  done.add(id);
  await setAppState(DONE_KEY, [...done]);
}

/** Non-deleted shifts. Zero means the driver has never seen what Comma is for. */
export async function countShifts() {
  const all = await db.shifts.toArray();
  return all.filter((s) => !s.deletedAt).length;
}

/** The weekly earnings target, read from the goals table — the row the Goals screen writes. */
async function getWeeklyGoalTarget() {
  const rows = await db.goals.toArray();
  const weekly = rows.find((g) => g.scope === 'weekly' && g.type === 'earnings');
  const target = Number(weekly?.target ?? weekly?.targetValue);
  return Number.isFinite(target) ? target : null;
}

/** Active platforms, read from the platforms table — the rows the Settings screen writes. */
async function countActivePlatforms() {
  const rows = await db.platforms.toArray();
  return rows.filter((p) => p.active).length;
}

/**
 * There is no GPS item on web — background location tracking is a phone capability, so offering it
 * here would be a dead end. The other four match the phone app one-for-one.
 */
export async function buildActivationItems() {
  const user = await getUser();
  const vehicles = await db.vehicles.toArray();
  const syncOn = isSyncEnabled();
  const distanceUnit = user?.locale?.distanceUnit ?? 'km';
  const [weeklyGoal, activePlatforms, doneOverrides] = await Promise.all([
    getWeeklyGoalTarget(),
    countActivePlatforms(),
    readDoneOverrides(),
  ]);

  return [
    {
      id: 'platforms',
      title: t('onboarding.activation.platformsTitle'),
      detail: t('onboarding.activation.platformsDetail'),
      done: doneOverrides.has('platforms') || activePlatforms > 1,
      href: '#/settings',
    },
    {
      id: 'vehicle',
      title: t('onboarding.activation.vehicleTitle'),
      detail: t('onboarding.activation.vehicleDetail').replace('{unit}', distanceUnit),
      // Done once ANY vehicle carries real details. Checking only the first one meant a driver who
      // added a second vehicle still couldn't tick this off, because the untouched placeholder
      // onboarding created was the one being read.
      done: doneOverrides.has('vehicle') || vehicles.some((v) => String(v?.make ?? '').trim()),
      href: '#/vehicles',
    },
    {
      id: 'goal',
      title: t('onboarding.activation.goalTitle'),
      detail: t('onboarding.activation.goalDetail'),
      // Either they changed it from the seeded default, or they saved the Goals screen at all —
      // the latter so that deliberately choosing 500 still counts. See DONE_KEY.
      done: doneOverrides.has('goal') || (weeklyGoal != null && weeklyGoal !== DEFAULT_WEEKLY_GOAL),
      href: '#/goals',
    },
    {
      id: 'backup',
      title: t('onboarding.activation.backupTitle'),
      detail: t('onboarding.activation.backupDetail'),
      done: syncOn,
      href: '#/settings',
    },
  ];
}

/**
 * The whole panel: the empty state (only with zero shifts) plus the checklist (until it's done or
 * dismissed). Returns '' when there is nothing to say, so the dashboard can drop it in blind.
 */
export async function renderActivationPanel() {
  // Demo mode is someone kicking the tyres on sample data. Asking them to configure a real vehicle
  // or back up their vault is nonsense — none of it applies to records they're about to throw away,
  // and the items would tick against seeded demo data rather than anything they actually did.
  if (store.get('demoMode')) return '';

  const [shiftCount, items] = await Promise.all([countShifts(), buildActivationItems()]);

  // A driver with no shifts has never seen what Comma is for. This is the last place left to show
  // them, so it carries the same promise the reveal does — and an actual way to act on it.
  const emptyHtml =
    shiftCount === 0
      ? `<div class="dashboard-activation-empty">${renderEmptyState({
          icon: 'clock',
          title: t('onboarding.activation.emptyTitle'),
          message: t('onboarding.activation.emptyMessage'),
          action: '#/shifts/new',
          actionLabel: t('onboarding.activation.emptyCta'),
        })}</div>`
      : '';

  const done = items.filter((i) => i.done).length;
  const showChecklist = done < items.length;

  const checklistHtml = showChecklist
    ? `<section class="card dashboard-activation" aria-label="${esc(t('onboarding.activation.title'))}">
        <div class="dashboard-activation-head">
          <div>
            <h2 class="dashboard-activation-title">${esc(t('onboarding.activation.title'))}</h2>
            <p class="dashboard-activation-sub">${esc(
              t('onboarding.activation.progress')
                .replace('{done}', String(done))
                .replace('{total}', String(items.length)),
            )}</p>
          </div>
        </div>
        <div class="dashboard-activation-bar" aria-hidden="true">
          ${items.map((i) => `<span class="${i.done ? 'is-done' : ''}"></span>`).join('')}
        </div>
        <ul class="dashboard-activation-list">
          ${items
            .map((i) =>
              i.done
                ? `<li class="is-done"><span class="dashboard-activation-check">✓</span><span>${esc(i.title)}</span></li>`
                : `<li><a href="${esc(i.href)}">
                    <span class="dashboard-activation-check" aria-hidden="true"></span>
                    <span class="dashboard-activation-text">
                      <strong>${esc(i.title)}</strong>
                      <small>${esc(i.detail)}</small>
                    </span>
                  </a></li>`,
            )
            .join('')}
        </ul>
      </section>`
    : '';

  return emptyHtml + checklistHtml;
}


