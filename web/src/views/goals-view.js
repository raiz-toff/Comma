import { getGoalDashboardData, upsertGoal } from '../modules/goals/goals.js';
import { formatCurrency, formatLargeNumber } from '../utils/formatters.js';
import { t } from '../utils/strings.js';
import { getIcon } from '../ui/icons.js';
import { showNumericKeypad, showToast, showModal, showConfirm } from '../ui/components.js';
import { GoalTypeRegistry, GoalScopeRegistry } from '../registry/goal-types/index.js';
import { db } from '../core/db.js';

/**
 * Escapes HTML to prevent XSS.
 * @param {unknown} v
 * @returns {string}
 */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strips the FAB query from the hash to keep the URL clean after a redirect.
 */
function stripFabQueryFromHash() {
  try {
    const raw = window.location.hash || '';
    const qi = raw.indexOf('?');
    if (qi === -1) return;
    const base = raw.slice(0, qi);
    const params = new URLSearchParams(raw.slice(qi + 1));
    if (!params.has('fab')) return;
    params.delete('fab');
    const qs = params.toString();
    const next = qs ? `${base}?${qs}` : base;
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', `${path}${next}`);
  } catch {
    /* ignore */
  }
}

// ─── Mappings (mirror mobile's GOAL_UNITS) ──────────────────────────────────────
const UNIT_ICON = {
  earnings: '💰', net_profit: '💵', tips: '💸', hours: '⏱️', deliveries: '🚗', distance: '📍',
};
const UNIT_LABEL = {
  earnings: 'Earnings ($)', net_profit: 'Net Profit', tips: 'Tips', hours: 'Hours Worked',
  deliveries: 'Deliveries', distance: 'Active Distance',
};
const CURRENCY_TYPES = new Set(['earnings', 'net_profit', 'tips']);

/** Title-case a snake_case goal type for display. */
function humanizeType(type) {
  return String(type || '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Next streak milestone (mirror mobile's getStreakMilestone). */
function streakMilestone(days) {
  if (days < 7) return { target: 7, label: '7-day streak' };
  if (days < 30) return { target: 30, label: '30-day streak' };
  if (days < 100) return { target: 100, label: '100-day streak' };
  return { target: 100, label: 'Legend' };
}

function daysUntilReset(nextResetDate) {
  if (!nextResetDate) return 7;
  const diff = new Date(nextResetDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

/**
 * Inline SVG progress ring — visually matches mobile's `CircularProgress`
 * (grey track, rounded colored arc from 12 o'clock, centered content).
 * @param {number} pct @param {{size?:number,stroke?:number,color?:string,center?:string}} [o]
 */
function ring(pct, o = {}) {
  const size = o.size ?? 140;
  const stroke = o.stroke ?? 10;
  // Tokens only (AGENTS.md §5) — `stroke` moves to an inline style because CSS var() does not
  // resolve inside SVG presentation attributes.
  const color = o.color ?? 'var(--color-warning)';
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, Number(pct) || 0)) / 100) * c;
  return `
    <div class="gv-ring" style="width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="gv-ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"></circle>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color};" stroke-width="${stroke}"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round"
          transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
      </svg>
      <div class="gv-ring-center">${o.center ?? ''}</div>
    </div>`;
}

/**
 * Goals view — matches the mobile (Android) "Goals & Progress" screen: a Goals / Progress
 * tab switch, a weekly thermometer hero, an active-goals list, and a progress tab with
 * XP, day-streak (+ shields), weekly challenges and a driver-badges grid.
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} ctx
 */
export async function render(root, ctx) {
  const data = await getGoalDashboardData();
  const badges = data.badges || [];
  const unlockedBadges = badges.filter((b) => b.unlockedAt);
  const activeChallenges = (data.challenges || []).filter((c) => c.active !== false);
  const activeGoals = data.goals || [];

  const weeklyGoal = activeGoals.find((g) => g.scope === 'weekly' && g.type === 'earnings');
  const otherGoals = activeGoals.filter((g) => !(weeklyGoal && g.id === weeklyGoal.id));

  const thermoPct = Math.round((data.thermometer?.progress || 0) * 100);
  const streakDays = data.streakDays || 0;
  const frozen = Math.max(0, data.streakFrozenCount || 0);
  const milestone = streakMilestone(streakDays);
  const streakPct = streakDays >= 100 ? 100 : (streakDays / milestone.target) * 100;
  const xpTotal = data.xpTotal || 0;
  const xpLevel = data.xpLevel || 1;
  const bestGross = data.records?.bestShiftGross || 0;

  // ── Goals tab ──
  const heroHtml = weeklyGoal
    ? `
      <div class="gv-card gv-hero">
        <div class="gv-hero-main">
          <span class="gv-kicker" style="color:var(--color-warning);">Weekly Thermometer</span>
          <h1 class="gv-hero-title">${esc(humanizeType(weeklyGoal.type))}</h1>
          <p class="gv-hero-sub">Weekly Target Progress</p>
          <div class="gv-hero-value">${esc(formatCurrency(weeklyGoal.current || 0))}</div>
          <ion-button size="small" fill="outline" class="gv-edit-target" data-action="edit-weekly-goal">
            ${getIcon('edit', 13)} <span>EDIT TARGET</span>
          </ion-button>
        </div>
        ${ring(thermoPct, { color: 'var(--color-warning)', center: `<span class="gv-ring-pct">${thermoPct}%</span>` })}
      </div>`
    : '';

  const goalsListHtml = `
    <div class="gv-card gv-list">
      <div class="gv-list-head">
        <h2>${weeklyGoal ? 'Other Active Goals' : 'Active Goals'}</h2>
        <ion-button size="small" fill="clear" color="warning" class="gv-add" data-action="add-goal">${getIcon('plus', 16)} <span>ADD</span></ion-button>
      </div>
      <div class="gv-list-body">
        ${otherGoals.length === 0
          ? `<p class="gv-empty">No other active goals. Tap Add to create one.</p>`
          : otherGoals.map((goal) => {
              const pct = Math.min(100, (goal.progress || 0) * 100);
              const target = CURRENCY_TYPES.has(goal.type)
                ? formatCurrency(goal.target || 0)
                : formatLargeNumber(goal.target || 0);
              return `
                <ion-item-sliding class="gv-sliding" data-goal-id="${esc(goal.id)}">
                  <ion-item class="gv-ion-item" lines="none">
                    <div class="gv-goal">
                      <div class="gv-goal-top">
                        <div class="gv-goal-id">
                          <div class="gv-goal-icon">${UNIT_ICON[goal.type] || '🎯'}</div>
                          <div>
                            <div class="gv-goal-name">${esc(humanizeType(goal.type))}</div>
                            <div class="gv-goal-meta">${esc(goal.scope)} · ${esc(UNIT_LABEL[goal.type] || goal.type)}</div>
                          </div>
                        </div>
                        <div class="gv-goal-right">
                          <div class="gv-goal-target">${esc(target)}</div>
                          <div class="gv-goal-actions">
                            <ion-button size="small" fill="clear" color="medium" class="gv-ibtn" data-action="edit-goal" data-id="${esc(goal.id)}" aria-label="Edit">${getIcon('edit', 14)}</ion-button>
                            <ion-button size="small" fill="clear" color="danger" class="gv-ibtn" data-action="delete-goal" data-id="${esc(goal.id)}" aria-label="Delete">${getIcon('trash', 14)}</ion-button>
                          </div>
                        </div>
                      </div>
                      <ion-progress-bar class="gv-bar ${pct >= 100 ? 'gv-bar--success' : 'gv-bar--warning'}" value="${(pct / 100).toFixed(3)}"></ion-progress-bar>
                    </div>
                  </ion-item>
                  <ion-item-options side="end">
                    <ion-item-option color="medium" data-action="edit-goal" data-id="${esc(goal.id)}">${esc(t('common.edit'))}</ion-item-option>
                    <ion-item-option color="danger" data-action="delete-goal" data-id="${esc(goal.id)}">${esc(t('common.delete'))}</ion-item-option>
                  </ion-item-options>
                </ion-item-sliding>`;
            }).join('')}
      </div>
    </div>`;

  // ── Progress tab ──
  const xpHtml = `
    <div class="gv-card" style="padding:20px;">
      <div class="gv-row-between" style="margin-bottom:16px;">
        <div class="gv-inline"><span style="color:var(--color-info);">${getIcon('award', 16)}</span><span class="gv-cap">Driver XP</span></div>
        <div class="gv-lvl">LVL ${xpLevel}</div>
      </div>
      <div class="gv-xp">${esc(formatLargeNumber(xpTotal))} <span class="gv-xp-unit">XP</span></div>
      <ion-progress-bar class="gv-bar gv-bar--info" style="margin:10px 0;" value="${((xpTotal % 100) / 100).toFixed(2)}"></ion-progress-bar>
      <div class="gv-hint">${100 - (xpTotal % 100)} XP to Level ${xpLevel + 1}</div>
    </div>`;

  const streakHtml = `
    <div class="gv-card" style="padding:20px;">
      <div class="gv-inline" style="margin-bottom:20px;"><span style="color:var(--color-danger);">${getIcon('fire', 16)}</span><span class="gv-cap">Day Streak</span></div>
      <div class="gv-streak">
        ${ring(streakPct, { size: 110, stroke: 8, color: 'var(--color-danger)', center: `<span class="gv-streak-n">${streakDays}</span><span class="gv-streak-l">days</span>` })}
        <div class="gv-streak-side">
          <div>
            <div class="gv-mini-cap">Next milestone</div>
            <div class="gv-streak-ms">${streakDays >= 100 ? 'Legend 🏆' : `${milestone.target - streakDays} days to ${esc(milestone.label)}`}</div>
          </div>
          <div class="gv-shields">
            ${Array.from({ length: Math.min(3, frozen) }).map(() => `<span class="gv-shield on">${getIcon('shield', 18)}</span>`).join('')}
            ${Array.from({ length: Math.max(0, 3 - frozen) }).map(() => `<span class="gv-shield">${getIcon('shield', 18)}</span>`).join('')}
            <span class="gv-shields-n">${frozen}/3 shields</span>
          </div>
        </div>
      </div>
    </div>`;

  const challengesHtml = `
    <div class="gv-card" style="padding:20px;">
      <h2 class="gv-card-title">Weekly Challenges</h2>
      <div class="gv-challenges">
        ${activeChallenges.length === 0
          ? `<p class="gv-empty">No active challenges.</p>`
          : activeChallenges.map((c) => {
              const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;
              const done = !!c.completedAt || pct >= 100;
              const resetDays = daysUntilReset(c.nextResetDate ?? c.resetAt ?? null);
              return `
                <div class="gv-challenge">
                  <div class="gv-ch-top">
                    <div class="gv-ch-icon ${done ? 'done' : ''}">${getIcon('goal', 18)}</div>
                    <div class="gv-ch-body">
                      <div class="gv-row-between">
                        <span class="gv-ch-name">${esc(c.name)}</span>
                        <span class="gv-ch-pct" style="color:${done ? 'var(--color-success)' : 'var(--color-brand)'};">${done ? '✓ Done' : pct + '%'}</span>
                      </div>
                      ${c.description ? `<div class="gv-ch-desc">${esc(c.description)}</div>` : ''}
                    </div>
                  </div>
                  <ion-progress-bar class="gv-bar ${done ? 'gv-bar--success' : 'gv-bar--brand'}" style="margin:6px 0;" value="${(pct / 100).toFixed(2)}"></ion-progress-bar>
                  <div class="gv-hint">${done ? `Resets in ${resetDays} day${resetDays === 1 ? '' : 's'}` : `${resetDays} day${resetDays === 1 ? '' : 's'} remaining`}</div>
                </div>`;
            }).join('')}
      </div>
    </div>`;

  const badgesHtml = `
    <div class="gv-card" style="padding:20px;">
      <div class="gv-row-between" style="margin-bottom:18px;">
        <div class="gv-inline"><span style="color:#8b5cf6;">${getIcon('star', 16)}</span><h2 class="gv-card-title" style="margin:0;">Driver Badges</h2></div>
        <span class="gv-hint" style="font-weight:700;">${unlockedBadges.length} / ${badges.length}</span>
      </div>
      <div class="gv-badges">
        ${badges.map((b) => `
          <button class="gv-badge ${b.unlockedAt ? 'on' : ''}" data-action="badge" data-id="${esc(b.id)}" title="${esc(b.name)}">
            <span class="gv-badge-icon">${esc(b.icon)}</span>
          </button>`).join('')}
      </div>
      <p class="gv-badges-hint">Tap a badge to see details</p>
    </div>`;

  const bestHtml = `
    <div class="gv-card gv-best">
      <div class="gv-inline">
        <span style="color:var(--color-warning);">${getIcon('trending-up', 18)}</span>
        <div>
          <div class="gv-cap">Best Shift — All Time</div>
          <div class="gv-best-val">${esc(formatCurrency(bestGross))}</div>
        </div>
      </div>
      <span class="gv-chevron">›</span>
    </div>`;

  root.innerHTML = `
    <div class="goals-view-container" data-goals-root>
      <div class="gv-header"><h1 class="gv-page-title">Goals &amp; Progress</h1></div>

      <ion-segment class="gv-tabs" value="0" data-gv-tabs>
        <ion-segment-button value="0"><ion-label>Goals</ion-label></ion-segment-button>
        <ion-segment-button value="1"><ion-label>Progress</ion-label></ion-segment-button>
      </ion-segment>

      <div class="gv-panel is-active" data-panel="0">
        ${heroHtml}
        ${goalsListHtml}
      </div>

      <div class="gv-panel" data-panel="1">
        ${xpHtml}
        ${streakHtml}
        ${challengesHtml}
        ${badgesHtml}
        ${bestHtml}
      </div>
    </div>

    <style>
      .goals-view-container {
        /* Dark (default — matches the Android look). Light theme overrides below. */
        --gv-card:#0F0F12; --gv-border:#1E1E23; --gv-inset:#16161A; --gv-inset2:#1C1C21;
        --gv-text:#F6F6F7; --gv-muted:#9B9BA4; --gv-dim:#65656E; --gv-faint:#2E2E36;
        --gv-track:#1C1C21; --gv-badge:#0a0a0a; --gv-badge-on:#ffffff08; --gv-badge-on-bd:#ffffff18;
        --gv-lvl-bg:#1e3a8a22; --gv-done-bg:#052e1640;
        max-width: var(--app-content-width, 720px); margin: 0 auto; padding: 20px 16px 120px;
        animation: gvFade 0.35s ease-out;
      }
      /* Light theme (explicit) + auto theme when the OS prefers light. */
      html[data-theme='light'] .goals-view-container {
        --gv-card:#ffffff; --gv-border:#e5e2da; --gv-inset:#f2f0eb; --gv-inset2:#e5e2da;
        --gv-text:#1a1916; --gv-muted:#6b6860; --gv-dim:#a09d96; --gv-faint:#d5d1c8;
        --gv-track:#e5e2da; --gv-badge:#f2f0eb; --gv-badge-on:rgba(0,0,0,0.035); --gv-badge-on-bd:#e5e2da;
        --gv-lvl-bg:rgba(59,130,246,0.12); --gv-done-bg:rgba(34,197,94,0.14);
      }
      @media (prefers-color-scheme: light) {
        html[data-theme='auto'] .goals-view-container {
          --gv-card:#ffffff; --gv-border:#e5e2da; --gv-inset:#f2f0eb; --gv-inset2:#e5e2da;
          --gv-text:#1a1916; --gv-muted:#6b6860; --gv-dim:#a09d96; --gv-faint:#d5d1c8;
          --gv-track:#e5e2da; --gv-badge:#f2f0eb; --gv-badge-on:rgba(0,0,0,0.035); --gv-badge-on-bd:#e5e2da;
          --gv-lvl-bg:rgba(59,130,246,0.12); --gv-done-bg:rgba(34,197,94,0.14);
        }
      }
      .gv-ring-track { stroke: var(--gv-track); }
      @keyframes gvFade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

      .gv-header { text-align:center; padding:6px 0 16px; }
      .gv-page-title { margin:0; font-size:17px; font-weight:900; letter-spacing:-0.3px; color:var(--gv-text); }

      /* Goals/Progress switch is an ion-segment now — host plumbing lives in css/views/goals.css. */

      .gv-panel { display:none; flex-direction:column; gap:16px; }
      .gv-panel.is-active { display:flex; }

      .gv-card { background:var(--gv-card); border:0.8px solid var(--gv-border); border-radius:20px; }

      /* Hero */
      .gv-hero { padding:24px; display:flex; align-items:center; gap:24px; overflow:hidden; }
      .gv-hero-main { flex:1; min-width:0; }
      .gv-kicker { display:block; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px; }
      .gv-hero-title { margin:0 0 6px; font-size:24px; font-weight:900; letter-spacing:-0.5px; line-height:1.15; color:var(--gv-text); text-transform:capitalize; }
      .gv-hero-sub { margin:0 0 14px; font-size:12px; font-weight:600; color:var(--gv-muted); }
      .gv-hero-value { font-size:38px; font-weight:800; letter-spacing:-0.5px; color:var(--gv-text); margin-bottom:18px; line-height:1; }
      /* .gv-edit-target is an ion-button now — see css/views/goals.css. */

      /* Ring */
      .gv-ring { position:relative; display:grid; place-items:center; flex-shrink:0; }
      .gv-ring-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .gv-ring-pct { font-size:28px; font-weight:800; color:var(--gv-text); letter-spacing:-0.5px; }

      /* Active goals list */
      .gv-list-head { display:flex; align-items:center; justify-content:space-between; padding:20px; border-bottom:0.8px solid var(--gv-border); }
      .gv-list-head h2 { margin:0; font-size:16px; font-weight:800; color:var(--gv-text); }
      /* .gv-add is an ion-button (fill=clear, color=warning) now — see css/views/goals.css. */
      .gv-list-body { padding:20px; display:flex; flex-direction:column; gap:20px; }
      .gv-empty { margin:0; font-size:13px; color:var(--gv-muted); font-style:italic; text-align:center; }
      .gv-goal { display:flex; flex-direction:column; gap:10px; }
      .gv-goal-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .gv-goal-id { display:flex; align-items:center; gap:10px; min-width:0; }
      .gv-goal-icon { width:36px; height:36px; border-radius:12px; background:var(--gv-inset); border:1px solid var(--gv-inset2);
        display:grid; place-items:center; font-size:16px; flex-shrink:0; }
      .gv-goal-name { font-size:14px; font-weight:800; color:var(--gv-text); text-transform:capitalize; }
      .gv-goal-meta { font-size:11px; font-weight:700; color:var(--gv-muted); text-transform:uppercase; margin-top:2px; }
      .gv-goal-right { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
      .gv-goal-target { font-size:14px; font-weight:900; color:var(--gv-text); }
      .gv-goal-actions { display:flex; gap:8px; align-items:center; }
      /* .gv-ibtn is an ion-button (fill=clear) now — see css/views/goals.css. */
      .gv-bar { height:5px; border-radius:3px; overflow:hidden; --background: var(--gv-border); }
      .gv-bar--success { --progress-background: var(--color-success); }
      .gv-bar--warning { --progress-background: var(--color-warning); }
      .gv-bar--brand { --progress-background: var(--color-brand); }
      .gv-bar--info { --progress-background: var(--color-info); }

      /* Progress tab shared */
      .gv-row-between { display:flex; align-items:center; justify-content:space-between; }
      .gv-inline { display:flex; align-items:center; gap:8px; }
      .gv-cap { font-size:12px; font-weight:800; color:var(--gv-muted); text-transform:uppercase; }
      .gv-card-title { margin:0 0 18px; font-size:16px; font-weight:800; color:var(--gv-text); }
      .gv-hint { font-size:11px; font-weight:700; color:var(--gv-dim); }

      .gv-lvl { background:var(--gv-lvl-bg); border:1px solid color-mix(in srgb, var(--color-info) 25%, transparent); border-radius:8px; padding:4px 10px; font-size:11px; font-weight:900; color:var(--color-info); }
      .gv-xp { font-size:34px; font-weight:800; letter-spacing:-0.5px; color:var(--gv-text); line-height:1; }
      .gv-xp-unit { font-size:16px; color:var(--gv-dim); font-weight:600; }

      .gv-streak { display:flex; align-items:center; gap:20px; }
      .gv-streak-n { font-size:26px; font-weight:800; color:var(--gv-text); line-height:1; }
      .gv-streak-l { font-size:10px; font-weight:700; color:var(--gv-muted); }
      .gv-streak-side { flex:1; display:flex; flex-direction:column; gap:12px; }
      .gv-mini-cap { font-size:10px; font-weight:800; color:var(--gv-dim); text-transform:uppercase; margin-bottom:4px; }
      .gv-streak-ms { font-size:13px; font-weight:800; color:var(--gv-text); }
      .gv-shields { display:flex; align-items:center; gap:6px; }
      .gv-shield { color:var(--gv-faint); display:inline-flex; }
      .gv-shield.on { color:#6366f1; }
      .gv-shields-n { font-size:11px; font-weight:700; color:#6366f1; margin-left:2px; }

      .gv-challenges { display:flex; flex-direction:column; gap:16px; }
      .gv-ch-top { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
      .gv-ch-icon { width:40px; height:40px; border-radius:20px; background:var(--gv-card); border:1px solid var(--gv-inset2);
        display:grid; place-items:center; color:var(--color-brand); flex-shrink:0; }
      .gv-ch-icon.done { background:var(--gv-done-bg); border-color:color-mix(in srgb, var(--color-success) 25%, transparent); color:var(--color-success); }
      .gv-ch-body { flex:1; min-width:0; }
      .gv-ch-name { font-size:13px; font-weight:800; color:var(--gv-text); }
      .gv-ch-pct { font-size:12px; font-weight:900; }
      .gv-ch-desc { font-size:11px; color:var(--gv-muted); margin-top:3px; }

      .gv-badges { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; }
      .gv-badge { aspect-ratio:1; display:grid; place-items:center; background:var(--gv-badge); border:1px solid var(--gv-border);
        border-radius:14px; cursor:pointer; }
      .gv-badge.on { background:var(--gv-badge-on); border-color:var(--gv-badge-on-bd); }
      .gv-badge-icon { font-size:32px; filter:grayscale(1) opacity(0.25); }
      .gv-badge.on .gv-badge-icon { filter:none; }
      .gv-badges-hint { text-align:center; font-size:11px; color:var(--gv-dim); font-style:italic; margin:14px 0 0; }

      .gv-best { padding:20px; display:flex; align-items:center; justify-content:space-between; cursor:default; }
      .gv-best-val { font-size:22px; font-weight:900; letter-spacing:-0.5px; color:var(--gv-text); margin-top:2px; }
      .gv-chevron { font-size:18px; color:var(--gv-dim); }

      @media (max-width: 30rem) {
        .gv-hero { flex-direction:column; text-align:center; gap:18px; }
        .gv-hero-main { width:100%; }
        .gv-edit-target { align-self:center; }
      }
    </style>
  `;

  // ── Tab switching (ion-segment; no re-render, preserves scroll) ──
  const seg = root.querySelector('[data-gv-tabs]');
  const panels = Array.from(root.querySelectorAll('.gv-panel'));
  if (seg) {
    seg.addEventListener('ionChange', (e) => {
      const idx = String(/** @type {CustomEvent} */ (e).detail?.value ?? '0');
      panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === idx));
    });
  }

  /** Swipe-action taps come from inside an open ion-item-sliding — snap it shut before acting. */
  const closeSlider = (el) => {
    const slider = /** @type {{ close?: () => Promise<void> } | null} */ (el.closest('ion-item-sliding'));
    if (slider && typeof slider.close === 'function') void slider.close();
  };

  // ── Interaction handlers ──
  root.querySelectorAll('[data-action="edit-weekly-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (weeklyGoal) openGoalEditModal(weeklyGoal);
    });
  });

  root.querySelectorAll('[data-action="add-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => openGoalEditModal(null));
  });

  root.querySelectorAll('[data-action="edit-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSlider(btn);
      // goals.id is a client-generated string (Fix 2 — interop plan) — no numeric coercion.
      const id = btn.dataset.id;
      const goal = activeGoals.find((g) => g.id === id);
      if (goal) openGoalEditModal(goal);
    });
  });

  root.querySelectorAll('[data-action="delete-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeSlider(btn);
      const id = btn.dataset.id;
      showConfirm({
        title: 'Delete Goal',
        message: 'Are you sure you want to remove this goal?',
        confirmClass: 'btn btn-danger',
        onConfirm: async () => {
          await db.goals.delete(id);
          showToast({ message: 'Goal removed', type: 'info' });
          render(root, ctx);
        },
      });
    });
  });

  // Badge detail (mirror mobile's badge modal).
  root.querySelectorAll('[data-action="badge"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const badge = badges.find((b) => String(b.id) === btn.dataset.id);
      if (!badge) return;
      const el = document.createElement('div');
      el.style.textAlign = 'center';
      el.innerHTML = `
        <div style="font-size:56px;filter:${badge.unlockedAt ? 'none' : 'grayscale(1) opacity(0.3)'};">${esc(badge.icon)}</div>
        <h3 style="margin:12px 0 4px;font-weight:900;">${esc(badge.name)}</h3>
        <p style="margin:0;color:var(--color-text-muted);font-size:0.85rem;">${esc(badge.description || '')}</p>
        <div style="margin-top:12px;font-weight:800;font-size:0.75rem;color:${badge.unlockedAt ? 'var(--color-success)' : 'var(--color-text-muted)'};">
          ${badge.unlockedAt ? '✓ UNLOCKED' : 'LOCKED'}
        </div>`;
      showModal({ title: '', content: el, actions: [{ label: t('common.close'), class: 'btn btn-secondary' }] });
    });
  });

  // Goal edit/create modal.
  function openGoalEditModal(goal) {
    const isNew = !goal;
    const types = GoalTypeRegistry.getAll();
    const scopes = GoalScopeRegistry.getAll();

    const content = document.createElement('div');
    content.className = 'goal-form';
    content.innerHTML = `
      <div class="input-group">
        <label class="input-label">Metric</label>
        <select class="input" id="goal-type">
          ${types.map((tp) => `<option value="${tp.key}" ${goal?.type === tp.key ? 'selected' : ''}>${esc(humanizeType(tp.key))}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-top: var(--space-4);">
        <label class="input-label">Frequency</label>
        <select class="input" id="goal-scope">
          ${scopes.map((s) => `<option value="${s}" ${goal?.scope === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-top: var(--space-4);">
        <label class="input-label">Target Value</label>
        <div class="input-with-action">
          <input type="number" class="input" id="goal-target" value="${goal?.target || 100}" step="any">
          <ion-button size="small" fill="clear" id="btn-keypad" aria-label="Enter Target">${getIcon('dollar', 14)}</ion-button>
        </div>
      </div>
    `;

    showModal({
      title: isNew ? 'Add Goal' : 'Edit Goal',
      content,
      actions: [
        { label: t('common.cancel'), class: 'btn btn-secondary' },
        {
          label: isNew ? 'Add' : 'Save',
          class: 'btn btn-primary',
          onClick: async () => {
            const type = content.querySelector('#goal-type').value;
            const scope = content.querySelector('#goal-scope').value;
            const target = parseFloat(content.querySelector('#goal-target').value);

            if (isNaN(target) || target <= 0) {
              showToast({ message: 'Please enter a valid target', type: 'error' });
              return false; // Stay open
            }

            await upsertGoal({ id: goal?.id, type, scope, target, active: true });
            showToast({ message: isNew ? 'Goal added!' : 'Goal updated!', type: 'success' });
            render(root, ctx);
          },
        },
      ],
    });

    content.querySelector('#btn-keypad').addEventListener('click', () => {
      showNumericKeypad({
        value: content.querySelector('#goal-target').value,
        title: 'Enter Target',
        onConfirm: (val) => {
          content.querySelector('#goal-target').value = val;
        },
      });
    });
  }

  // Handle auto-scroll from FAB or context
  if (ctx && /** @type {{ fabQuickGoals?: boolean }} */ (ctx).fabQuickGoals) {
    queueMicrotask(() => {
      stripFabQueryFromHash();
      root.querySelector('[data-goals-root]')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
}
