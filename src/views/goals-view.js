import { getGoalDashboardData, upsertGoal, listGoals } from '../modules/goals/goals.js';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/formatters.js';
import { t } from '../utils/strings.js';
import { getIcon } from '../ui/icons.js';
import { renderProgressRing, showNumericKeypad, showToast, showModal, showConfirm } from '../ui/components.js';
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

/**
 * Renders the sleek Goals view.
 * @param {HTMLElement} root 
 * @param {Record<string, unknown>} ctx 
 */
export async function render(root, ctx) {
  const data = await getGoalDashboardData();
  const unlockedBadges = data.badges.filter((b) => b.unlockedAt);
  const activeChallenges = data.challenges.filter((c) => c.active);
  const activeGoals = data.goals;

  root.innerHTML = `
    <div class="goals-view-container" data-goals-root>
      <!-- Hero Section: Weekly Thermometer -->
      <section class="goals-hero">
        <div class="hero-card card card-raised">
          <div class="hero-main">
            <div class="hero-progress">
              ${renderProgressRing({
                value: data.thermometer.current,
                max: data.thermometer.target,
                size: 140,
                strokeWidth: 10,
                color: 'var(--color-warn)',
                label: formatPercent(data.thermometer.progress * 100, 0),
                ariaLabel: t('goals.thermometer'),
              })}
            </div>
            <div class="hero-content">
              <span class="hero-kicker">${esc(t('goals.thermometer'))}</span>
              <h1 class="hero-title">${esc(t('goals.title'))}</h1>
              <p class="hero-subtitle">${esc(t('goals.weeklyTarget'))}</p>
              <div class="hero-value">
                ${esc(formatCurrency(data.thermometer.current))} 
                <span class="target-sep">/</span> 
                <span class="target-val">${esc(formatCurrency(data.thermometer.target))}</span>
              </div>
              <button class="btn btn-primary btn-sm edit-target-btn" data-action="edit-weekly-goal">
                ${getIcon('edit', 14)} <span>${esc(t('common.edit'))}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Bento Grid: Summary Stats -->
      <section class="bento-grid">
        <!-- XP & Level -->
        <article class="card bento-cell-1x1 stat-card xp-card" data-widget-id="xp">
          <div class="wr">
            <div class="wh">
              <div class="wi">${getIcon('award', 16)}</div>
              <span class="wl">${esc(t('goals.xp'))}</span>
              <span class="wb neu">Lv. ${data.xpLevel}</span>
            </div>
            <div class="wv">${esc(formatLargeNumber(data.xpTotal))} <span class="unit">XP</span></div>
            <div class="wpb" style="margin-top: 4px;">
              <div class="wpf" style="width: ${data.xpTotal % 100}%;"></div>
            </div>
            <div class="ws">${esc(100 - (data.xpTotal % 100))} to next level</div>
          </div>
        </article>

        <!-- Day Streak -->
        <article class="card bento-cell-1x1 stat-card streak-card" data-widget-id="streak">
          <div class="wr">
            <div class="wh">
              <div class="wi" style="--wa: var(--color-neg); --war: var(--rgb-neg)">${getIcon('fire', 16)}</div>
              <span class="wl">${esc(t('goals.streakDays'))}</span>
            </div>
            <div class="wv">${esc(formatLargeNumber(data.streakDays))} <span class="unit">days</span></div>
            <div class="wf">
              <span class="ws">${getIcon('award', 12)} ${data.weekGoalStreak} weeks hit</span>
            </div>
          </div>
        </article>

        <!-- Badge Progress -->
        <article class="card bento-cell-1x1 stat-card badges-card" data-widget-id="badges">
          <div class="wr">
            <div class="wh">
              <div class="wi" style="--wa: #8b5cf6; --war: 139, 92, 246">${getIcon('star', 16)}</div>
              <span class="wl">${esc(t('goals.badges'))}</span>
            </div>
            <div class="wv">${esc(unlockedBadges.length)} <span class="unit">/ ${data.badges.length}</span></div>
            <div class="badge-mini-preview">
              ${unlockedBadges.slice(0, 4).map((b) => `<span class="mini-icon" title="${esc(b.name)}">${esc(b.icon)}</span>`).join('')}
            </div>
          </div>
        </article>

        <!-- Top Record -->
        <article class="card bento-cell-1x1 stat-card records-card" data-widget-id="records">
          <div class="wr">
            <div class="wh">
              <div class="wi" style="--wa: #10b981; --war: 16, 185, 129">${getIcon('trending-up', 16)}</div>
              <span class="wl">Personal Best</span>
            </div>
            <div class="wv">${esc(formatCurrency(data.records.bestShiftGross || 0))}</div>
            <div class="ws">Highest single shift gross</div>
          </div>
        </article>
      </section>

      <!-- Row 2: Active Goals & Challenges -->
      <section class="bento-grid" style="margin-top: var(--space-4);">
        <!-- Active Goals List -->
        <article class="card bento-cell-2x1 goals-list-card">
          <div class="card-header-flex">
            <h2>${esc(t('goals.activeGoals'))}</h2>
            <button class="btn btn-ghost btn-xs" data-action="add-goal">
              ${getIcon('plus', 14)} <span>Add Goal</span>
            </button>
          </div>
          <div class="goals-content-list">
            ${activeGoals.length === 0 
              ? `<p class="empty-hint">No active goals. Set one to start tracking!</p>`
              : activeGoals.map(goal => `
                <div class="goal-row" data-goal-id="${goal.id}">
                  <div class="goal-meta">
                    <div class="goal-name-wrap">
                      <span class="goal-name">${esc(goal.scope)} ${esc(goal.type)}</span>
                      <div class="goal-actions">
                        <button class="btn-icon" data-action="edit-goal" data-id="${goal.id}" aria-label="Edit">${getIcon('edit', 12)}</button>
                        <button class="btn-icon danger" data-action="delete-goal" data-id="${goal.id}" aria-label="Delete">${getIcon('trash', 12)}</button>
                      </div>
                    </div>
                    <span class="goal-target">${esc(formatCurrency(goal.target))}</span>
                  </div>
                  <div class="wpb">
                    <div class="wpf" style="width: ${goal.progress * 100}%;"></div>
                  </div>
                </div>
              `).join('')}
          </div>
        </article>

        <!-- Challenges -->
        <article class="card bento-cell-1x1 challenges-card">
          <div class="card-header-flex">
            <h2>${esc(t('goals.challenges'))}</h2>
          </div>
          <div class="challenges-content-list">
            ${activeChallenges.length === 0
              ? `<p class="empty-hint">No active challenges.</p>`
              : activeChallenges.map(challenge => {
                  const pct = challenge.target > 0 ? Math.min(100, (challenge.current / challenge.target) * 100) : 0;
                  return `
                    <div class="challenge-row">
                      <div class="challenge-meta">
                        <span class="challenge-name">${esc(challenge.name)}</span>
                        <span class="challenge-pct">${formatPercent(pct, 0)}</span>
                      </div>
                      <div class="wpb">
                        <div class="wpf" style="width: ${pct}%;"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
          </div>
        </article>
      </section>

      <!-- Badge Gallery Grid -->
      <section class="card badges-gallery-card" style="margin-top: var(--space-4);">
        <div class="card-header-flex">
          <h2>Badge Collection</h2>
        </div>
        <div class="badges-gallery-grid">
          ${data.badges.map(badge => `
            <div class="badge-gallery-item ${badge.unlockedAt ? 'is-unlocked' : 'is-locked'}" title="${esc(badge.description)}">
              <div class="badge-icon-large">${esc(badge.icon)}</div>
              <span class="badge-label-small">${esc(badge.name)}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- History Log -->
      <section class="card history-card" style="margin-top: var(--space-4);">
        <div class="card-header-flex">
          <h2>${esc(t('goals.history'))}</h2>
        </div>
        <div class="history-scroll-table">
          <table class="goal-history-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Target</th>
                <th>Actual</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              ${data.history.length === 0
                ? `<tr><td colspan="4" class="empty-table-hint">No history yet. Log shifts to see progress.</td></tr>`
                : data.history.slice(0, 10).map(row => `
                  <tr>
                    <td>${esc(row.periodStart)} — ${esc(row.periodEnd)}</td>
                    <td>${esc(formatCurrency(row.target))}</td>
                    <td>${esc(formatCurrency(row.actual))}</td>
                    <td>
                      <span class="result-badge ${row.hit ? 'is-hit' : 'is-miss'}">
                        ${row.hit ? 'HIT' : 'MISS'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <style>
      .goals-view-container {
        padding: var(--space-4);
        max-width: 1000px;
        margin: 0 auto;
        padding-bottom: 120px;
        animation: goalsFadeIn 0.4s ease-out;
      }

      @keyframes goalsFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Hero Card Customization */
      .hero-card {
        padding: var(--space-6);
        background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg-alt) 100%);
        border: 1px solid var(--color-border);
        margin-bottom: var(--space-4);
      }
      .hero-main {
        display: flex;
        align-items: center;
        gap: var(--space-8);
      }
      .hero-kicker {
        display: block;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-warn);
        margin-bottom: 4px;
      }
      .hero-title {
        margin: 0;
        font-size: 2.25rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1;
      }
      .hero-subtitle {
        margin: var(--space-1) 0 0;
        font-size: 0.875rem;
        color: var(--color-text-muted);
        font-weight: 500;
      }
      .hero-value {
        margin: var(--space-4) 0;
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--color-text-primary);
        letter-spacing: -0.01em;
      }
      .target-sep { color: var(--color-text-muted); opacity: 0.3; padding: 0 4px; }
      .target-val { color: var(--color-text-muted); font-weight: 600; }

      /* Stat Cards */
      .badge-mini-preview {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }
      .mini-icon {
        font-size: 1.25rem;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
      }

      /* List & Challenges */
      .card-header-flex {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-4);
      }
      .card-header-flex h2 {
        font-size: 1.1rem;
        font-weight: 700;
        margin: 0;
      }
      .goal-row, .challenge-row {
        margin-bottom: var(--space-4);
      }
      .goal-meta, .challenge-meta {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .goal-name-wrap { display: flex; align-items: center; gap: 8px; }
      .goal-name { text-transform: capitalize; }
      .goal-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
      .goal-row:hover .goal-actions { opacity: 1; }
      .btn-icon { background: none; border: none; padding: 4px; cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; border-radius: 4px; }
      .btn-icon:hover { background: rgba(0,0,0,0.1); color: var(--color-text-primary); }
      .btn-icon.danger:hover { color: var(--color-neg); }

      .empty-hint { color: var(--color-text-muted); font-style: italic; font-size: 0.875rem; }

      /* Badge Gallery */
      .badges-gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
        gap: var(--space-4);
      }
      .badge-gallery-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: var(--space-2);
        border-radius: var(--radius-md);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: help;
      }
      .badge-icon-large { font-size: 2rem; filter: grayscale(1) opacity(0.2); transition: all 0.3s; }
      .badge-label-small { font-size: 0.65rem; font-weight: 700; color: var(--color-text-muted); text-align: center; }
      
      .badge-gallery-item.is-unlocked .badge-icon-large { filter: grayscale(0) opacity(1); transform: scale(1.1); }
      .badge-gallery-item.is-unlocked .badge-label-small { color: var(--color-text-primary); }
      .badge-gallery-item.is-unlocked:hover { background: rgba(0,0,0,0.05); }

      /* History Table */
      .history-scroll-table { overflow-x: auto; margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4); }
      .goal-history-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
      .goal-history-table th { text-align: left; padding: var(--space-3); color: var(--color-text-muted); font-weight: 600; border-bottom: 1px solid var(--color-border); }
      .goal-history-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
      .result-badge { padding: 2px 8px; border-radius: 99px; font-size: 0.65rem; font-weight: 800; }
      .result-badge.is-hit { background: rgba(var(--rgb-pos), 0.1); color: var(--color-pos); }
      .result-badge.is-miss { background: rgba(var(--rgb-neg), 0.1); color: var(--color-neg); }

      @media (max-width: 40rem) {
        .hero-main { flex-direction: column; text-align: center; gap: var(--space-6); }
        .hero-content { width: 100%; }
        .hero-title { font-size: 1.75rem; }
        .hero-value { font-size: 1.5rem; }
        .goal-actions { opacity: 1; }
      }
    </style>
  `;

  // --- INTERACTION HANDLERS ---

  // Edit Weekly Goal (Main Hero)
  root.querySelectorAll('[data-action="edit-weekly-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const weeklyEarningsGoal = activeGoals.find(g => g.scope === 'weekly' && g.type === 'earnings');
      if (weeklyEarningsGoal) openGoalEditModal(weeklyEarningsGoal);
    });
  });

  // Add Goal
  root.querySelectorAll('[data-action="add-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => openGoalEditModal(null));
  });

  // Edit Goal (from list)
  root.querySelectorAll('[data-action="edit-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // goals.id is a client-generated string (Fix 2 — interop plan) — no numeric coercion.
      const id = btn.dataset.id;
      const goal = activeGoals.find(g => g.id === id);
      if (goal) openGoalEditModal(goal);
    });
  });

  // Delete Goal
  root.querySelectorAll('[data-action="delete-goal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      showConfirm({
        title: 'Delete Goal',
        message: 'Are you sure you want to remove this goal?',
        confirmClass: 'btn btn-danger',
        onConfirm: async () => {
          await db.goals.delete(id);
          showToast({ message: 'Goal removed', type: 'info' });
          render(root, ctx);
        }
      });
    });
  });

  // Goal Edit Modal Implementation
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
          ${types.map(t => `<option value="${t.key}" ${goal?.type === t.key ? 'selected' : ''}>${esc(t.key)}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-top: var(--space-4);">
        <label class="input-label">Frequency</label>
        <select class="input" id="goal-scope">
          ${scopes.map(s => `<option value="${s}" ${goal?.scope === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-top: var(--space-4);">
        <label class="input-label">Target Value</label>
        <div class="input-with-action">
          <input type="number" class="input" id="goal-target" value="${goal?.target || 100}" step="any">
          <button class="btn btn-ghost" id="btn-keypad">${getIcon('dollar', 14)}</button>
        </div>
      </div>
    `;

    const modal = showModal({
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

            await upsertGoal({
              id: goal?.id,
              type,
              scope,
              target,
              active: true
            });

            showToast({ message: isNew ? 'Goal added!' : 'Goal updated!', type: 'success' });
            render(root, ctx);
          }
        }
      ]
    });

    content.querySelector('#btn-keypad').addEventListener('click', () => {
      showNumericKeypad({
        value: content.querySelector('#goal-target').value,
        title: 'Enter Target',
        onConfirm: (val) => {
          content.querySelector('#goal-target').value = val;
        }
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


