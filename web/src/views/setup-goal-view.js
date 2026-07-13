/**
 * "Set a weekly goal" — the dashboard checklist's goal step. Web mirror of the phone app's
 * `app/setup/goal.tsx`.
 *
 * A dedicated screen rather than the full Goals manager: the checklist promises one
 * decision, and the Goals screen offers goal types, periods, units and a list to manage —
 * which is why tapping the item there appeared to do nothing useful. This asks for one
 * number. upsertGoal() marks the checklist item done itself on save.
 */

import { db } from '../core/db.js';
import { store } from '../core/store.js';
import { showToast } from '../ui/components.js';
import { getIcon } from '../ui/icons.js';
import { upsertGoal } from '../modules/goals/goals.js';

const PRESETS = [400, 500, 750, 1000];

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/dashboard';
}

/** @param {HTMLElement} root */
export async function render(root) {
  const user = store.get('user');
  const currency = user?.locale?.currencySymbol || '$';

  root.innerHTML = `
    <div class="setup-view">
      <button type="button" class="setup-back" data-setup-back>${getIcon('chevron-left', 16)} Back</button>
      <div class="setup-head">
        <h1 class="setup-title">What's your weekly target?</h1>
        <p class="setup-sub">Every shift gets measured against this, so you know mid-week whether you're on pace — instead of finding out on Sunday.</p>
      </div>
      <div class="setup-amount-row">
        <span class="setup-amount-currency">${esc(currency)}</span>
        <input type="text" inputmode="numeric" class="setup-amount-input" data-setup-amount placeholder="500" autofocus />
      </div>
      <div class="setup-preset-row" data-setup-presets>
        ${PRESETS.map((v) => `<button type="button" class="setup-preset-chip" data-preset="${v}">${esc(currency)}${v.toLocaleString()}</button>`).join('')}
      </div>
      <p class="setup-projection" data-setup-projection hidden></p>
      <div class="setup-error" data-setup-error hidden></div>
      <div class="setup-cta-row">
        <ion-button data-setup-save>Set my goal</ion-button>
      </div>
    </div>
  `;

  root.querySelector('[data-setup-back]')?.addEventListener('click', goBack);

  const amountEl = /** @type {HTMLInputElement} */ (root.querySelector('[data-setup-amount]'));
  const presetsEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-presets]'));
  const projectionEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-projection]'));
  const errorEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-error]'));
  const saveBtn = /** @type {HTMLElement} */ (root.querySelector('[data-setup-save]'));

  let existingId = null;
  try {
    const goals = await db.goals.toArray();
    const weekly = goals.find((g) => g.type === 'earnings' && g.scope === 'weekly' && g.syncDeletedAt == null);
    if (weekly) {
      existingId = weekly.id;
      amountEl.value = String(Math.round(Number(weekly.target) || 0));
    }
  } catch (err) {
    console.warn('[comma setup] goal lookup failed', err);
  }

  function paintDerived() {
    presetsEl.querySelectorAll('[data-preset]').forEach((chip) => {
      chip.classList.toggle('is-on', chip.getAttribute('data-preset') === amountEl.value);
    });
    const parsed = Number(amountEl.value) || 0;
    if (parsed > 0) {
      projectionEl.hidden = false;
      projectionEl.textContent = `That's about ${currency}${Math.round(parsed * 4.33).toLocaleString()} a month, or ${currency}${(parsed * 52).toLocaleString()} a year.`;
    } else {
      projectionEl.hidden = true;
    }
  }

  amountEl.addEventListener('input', () => {
    amountEl.value = amountEl.value.replace(/[^0-9]/g, '');
    errorEl.hidden = true;
    paintDerived();
  });

  presetsEl.addEventListener('click', (e) => {
    const chip = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-preset]') : null);
    if (!chip) return;
    amountEl.value = chip.getAttribute('data-preset') || '';
    errorEl.hidden = true;
    paintDerived();
  });

  saveBtn.addEventListener('click', async () => {
    const target = Number(amountEl.value);
    if (!(target > 0)) {
      errorEl.textContent = 'Enter a weekly target above zero.';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    /** @type {any} */ (saveBtn).disabled = true;
    try {
      await upsertGoal({ id: existingId || undefined, type: 'earnings', scope: 'weekly', target, active: true });
      showToast({ type: 'success', message: 'Weekly goal set', duration: 1800 });
      goBack();
    } catch (err) {
      console.warn('[comma setup] goal save failed', err);
      errorEl.textContent = "Couldn't save that. Try again.";
      errorEl.hidden = false;
    } finally {
      /** @type {any} */ (saveBtn).disabled = false;
    }
  });

  paintDerived();
  amountEl.focus();
}
