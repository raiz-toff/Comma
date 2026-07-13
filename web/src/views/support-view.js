import { db } from '../core/db.js';
import { store } from '../core/store.js';
import { t } from '../utils/strings.js';
import { getIcon } from '../ui/icons.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  root.textContent = '';
  
  // Get active platforms count & shift statistics for diagnostics
  const [platformCount, shiftCount, expenseCount] = await Promise.all([
    db.platforms.filter((p) => p.active === true).count(),
    db.shifts.count(),
    db.expenses.count()
  ]);

  const user = store.get('user') || {};
  const appVersion = window.__comma?.version || '1.0.0';
  const theme = user.theme || 'auto';
  const weeklyGoal = (Number(user.weeklyGoal) || 0) / 100;
  const isOnline = store.get('isOnline') ? 'Online' : 'Offline';
  const distanceUnit = user.locale?.distanceUnit || 'km';
  const userAgent = navigator.userAgent;

  // Render the layout
  const wrap = document.createElement('div');
  wrap.className = 'support-view-container';
  wrap.style.cssText = `
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) var(--space-6);
  `;

  wrap.innerHTML = `
    <header class="support-header" style="margin-bottom: var(--space-2);">
      <h1 class="app-header-title" style="font-size: var(--text-2xl); font-weight: 800; letter-spacing: -0.02em;">Support & Feedback</h1>
      <p class="text-secondary" style="margin-top: var(--space-1); font-size: var(--text-sm);">
        Found a bug, hit an issue, or have an amazing idea for a new feature? Tell us about it!
      </p>
    </header>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">
      
      <!-- GitHub Issue Card -->
      <section class="card card-raised" style="display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-brand);">
          ${getIcon('code', 22)}
          <h2 style="font-size: var(--text-lg); font-weight: 700; margin: 0;">Create a GitHub Issue</h2>
        </div>
        <p class="text-secondary" style="font-size: var(--text-sm); margin: 0; line-height: 1.5;">
          COMMA is a fully open-source, community-driven project. If you are comfortable using GitHub, we track and resolve bugs, feature requests, and tasks publicly on our repository.
        </p>
        <div style="margin-top: auto; padding-top: var(--space-2);">
          <ion-button size="small" href="https://github.com/raiz-toff/CommaApp/issues/new" target="_blank" rel="noopener noreferrer">
            <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('export', 16)}</span>
            Open GitHub Issues
          </ion-button>
        </div>
      </section>

      <!-- Buy Me a Coffee Card -->
      <section class="card card-raised" style="display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-warning);">
          ${getIcon('award', 22)}
          <h2 style="font-size: var(--text-lg); font-weight: 700; margin: 0; color: var(--color-text-primary);">Buy Me a Coffee</h2>
        </div>
        <p class="text-secondary" style="font-size: var(--text-sm); margin: 0; line-height: 1.5;">
          COMMA is entirely free, local-first, and open source. If you love using this app and want to support its ongoing development, consider buying the developer a coffee!
        </p>
        <div style="margin-top: auto; padding-top: var(--space-2);">
          <ion-button size="small" color="warning" href="https://buymeacoffee.com/raiztuffy" target="_blank" rel="noopener noreferrer">
            ☕ Buy Me a Coffee
          </ion-button>
        </div>
      </section>

      <!-- Email Support Card -->
      <section class="card card-raised" style="display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-brand);">
          ${getIcon('bell', 22)}
          <h2 style="font-size: var(--text-lg); font-weight: 700; margin: 0;">Email Support Directly</h2>
        </div>
        <p class="text-secondary" style="font-size: var(--text-sm); margin: 0; line-height: 1.5;">
          Send us an email. We automatically package diagnostic info below to help us investigate faster.
        </p>

        <form id="support-email-form" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="field" style="display: flex; flex-direction: column; gap: var(--space-1);">
            <label class="label" style="font-size: var(--text-xs); font-weight: 600;">Feedback Type</label>
            <select class="input" name="feedbackType" style="width: 100%;">
              <option value="Bug Report">🐛 Bug Report</option>
              <option value="Feature Request">💡 Feature Request</option>
              <option value="General Feedback">💬 General Feedback / Question</option>
            </select>
          </div>

          <div class="field" style="display: flex; flex-direction: column; gap: var(--space-1);">
            <label class="label" style="font-size: var(--text-xs); font-weight: 600;">Message</label>
            <textarea class="input" name="message" rows="5" placeholder="Explain what happened or what you expect..." style="width: 100%; resize: vertical; min-height: 100px; padding: var(--space-2); font-family: inherit; font-size: var(--text-sm);"></textarea>
          </div>

          <button type="submit" class="btn btn-secondary btn-sm" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font-weight: 600;">
            ${getIcon('plus', 16)} Draft Support Email
          </button>
        </form>
      </section>

    </div>

    <!-- Diagnostic Info Footer -->
    <footer class="card" style="padding: var(--space-4); background: var(--color-surface-raised); border-top: 1px solid var(--color-border);">
      <h3 style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin: 0 0 var(--space-3) 0;">
        System Diagnostic Details (Included in email)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3); font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-text-secondary);">
        <div><strong>App Version:</strong> ${esc(appVersion)}</div>
        <div><strong>Date / Time:</strong> ${esc(new Date().toLocaleString())}</div>
        <div><strong>Active Theme:</strong> ${esc(theme)}</div>
        <div><strong>Weekly Goal:</strong> $${esc(weeklyGoal.toFixed(2))}</div>
        <div><strong>Distance Unit:</strong> ${esc(distanceUnit)}</div>
        <div><strong>Active Platforms:</strong> ${esc(platformCount)}</div>
        <div><strong>Shifts Logged:</strong> ${esc(shiftCount)}</div>
        <div><strong>Expenses Logged:</strong> ${esc(expenseCount)}</div>
        <div><strong>Connection:</strong> ${esc(isOnline)}</div>
      </div>
      <div style="font-size: 10px; font-family: var(--font-mono); color: var(--color-text-muted); margin-top: var(--space-3); border-top: 1px dashed var(--color-border); padding-top: var(--space-2); word-break: break-all;">
        <strong>User Agent:</strong> ${esc(userAgent)}
      </div>
    </footer>
  `;

  // Attach submit listener
  const form = wrap.querySelector('#support-email-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const feedbackType = fd.get('feedbackType');
    const msg = fd.get('message') || '';

    const subject = `[COMMA Support] ${feedbackType}`;
    const body = `Hi Raj,\n\nHope you are doing great! I am writing to you regarding the COMMA web app. Here are my thoughts:\n\n` +
      `----------------------------------------\n` +
      `${msg || '(No custom message provided)'}\n` +
      `----------------------------------------\n\n` +
      `🛠️ SYSTEM DIAGNOSTICS:\n` +
      `• App Version: ${appVersion}\n` +
      `• Date/Time: ${new Date().toLocaleString()}\n` +
      `• Active Theme: ${theme}\n` +
      `• Weekly Goal: $${weeklyGoal.toFixed(2)}\n` +
      `• Distance Unit: ${distanceUnit}\n` +
      `• Active Platforms: ${platformCount}\n` +
      `• Shifts Logged: ${shiftCount}\n` +
      `• Expenses Logged: ${expenseCount}\n` +
      `• Connection: ${isOnline}\n` +
      `• User Agent: ${userAgent}\n` +
      `----------------------------------------\n`;

    const mailto = `mailto:me@rajkumarneupane.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });

  root.appendChild(wrap);
}
