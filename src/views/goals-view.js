import { getGoalDashboardData } from '../modules/goals/goals.js';
import { formatCurrency, formatLargeNumber, formatPercent } from '../utils/formatters.js';
import { t } from '../utils/strings.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  void ctx;
  const data = await getGoalDashboardData();
  const unlockedBadges = data.badges.filter((b) => b.unlockedAt);
  const activeChallenges = data.challenges.filter((c) => c.active);
  const goals = data.goals.filter((g) => g.active);

  root.innerHTML = `
    <section class="goals-view">
      <header class="card card-raised">
        <h1>${esc(t('goals.title'))}</h1>
        <p>${esc(t('goals.weeklyTarget'))}: ${esc(formatCurrency(data.thermometer.target))}</p>
      </header>

      <section class="bento-grid" style="margin-top: var(--space-4);">
        <article class="card stat-card bento-cell-1x1">
          <span class="stat-label">${esc(t('goals.xp'))}</span>
          <span class="stat-value">${esc(formatLargeNumber(data.xpTotal))}</span>
          <span class="stat-meta">${esc(t('goals.level'))} ${esc(formatLargeNumber(data.xpLevel))}</span>
        </article>
        <article class="card stat-card bento-cell-1x1">
          <span class="stat-label">${esc(t('goals.streakDays'))}</span>
          <span class="stat-value">${esc(formatLargeNumber(data.streakDays))}</span>
          <span class="stat-meta">${esc(t('goals.weeksHit'))}: ${esc(formatLargeNumber(data.weekGoalStreak))}</span>
        </article>
        <article class="card stat-card bento-cell-1x1">
          <span class="stat-label">${esc(t('goals.badges'))}</span>
          <span class="stat-value">${esc(formatLargeNumber(unlockedBadges.length))}</span>
          <span class="stat-meta">${esc(t('goals.of'))} ${esc(formatLargeNumber(data.badges.length))}</span>
        </article>
        <article class="card stat-card bento-cell-1x1">
          <span class="stat-label">${esc(t('goals.thermometer'))}</span>
          <span class="stat-value">${esc(formatPercent(data.thermometer.progress * 100, 0))}</span>
          <span class="stat-meta">${esc(formatCurrency(data.thermometer.current))}</span>
        </article>
      </section>

      <section class="bento-grid" style="margin-top: var(--space-4);">
        <article class="card bento-cell-2x1">
          <h2>${esc(t('goals.activeGoals'))}</h2>
          <ul style="margin: 0; padding-left: var(--space-4);">
            ${goals
              .map(
                (goal) => `<li>${esc(goal.scope)} · ${esc(goal.type)} · ${esc(formatCurrency(goal.target))}</li>`,
              )
              .join('')}
          </ul>
        </article>

        <article class="card bento-cell-1x2">
          <h2>${esc(t('goals.challenges'))}</h2>
          <ul style="margin: 0; padding-left: var(--space-4);">
            ${activeChallenges
              .map((challenge) => {
                const pct = challenge.target > 0 ? (challenge.current / challenge.target) * 100 : 0;
                return `<li>${esc(challenge.name)} · ${esc(formatPercent(pct, 0))}</li>`;
              })
              .join('')}
          </ul>
        </article>

        <article class="card bento-cell-1x2">
          <h2>${esc(t('goals.badges'))}</h2>
          <ul style="margin: 0; padding-left: var(--space-4);">
            ${data.badges
              .slice(0, 8)
              .map((badge) => `<li>${esc(badge.icon)} ${esc(badge.name)}${badge.unlockedAt ? ' ✓' : ''}</li>`)
              .join('')}
          </ul>
        </article>

        <article class="card bento-cell-2x1">
          <h2>${esc(t('goals.history'))}</h2>
          <ul style="margin: 0; padding-left: var(--space-4);">
            ${data.history
              .slice(0, 6)
              .map(
                (row) =>
                  `<li>${esc(row.periodStart)} ${esc(t('goals.to'))} ${esc(row.periodEnd)} · ${row.hit ? esc(t('goals.hit')) : esc(t('goals.inProgress'))} · ${esc(formatCurrency(row.actual))}</li>`,
              )
              .join('')}
          </ul>
        </article>
      </section>
    </section>
  `;
}
