/**
 * "Add your other apps" — the dashboard checklist's platform step. Web mirror of the
 * phone app's `app/setup/platforms.tsx`.
 *
 * A dedicated screen rather than a jump into Settings: the checklist promises one specific
 * job, and dropping the driver into a page of unrelated toggles makes them hunt for it (and
 * often leave without doing it). This does exactly the one thing, saves, and comes back.
 */

import { db } from '../core/db.js';
import { showToast } from '../ui/components.js';
import { getIcon } from '../ui/icons.js';
import { getPlatformConfig } from '../registry/platforms/terminology.js';
import { addPlatform, deactivatePlatform } from '../modules/platforms/platforms.js';
import { markActivationDone } from '../modules/onboarding/activation.js';

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/dashboard';
}

/** @param {HTMLElement} root */
export async function render(root) {
  root.innerHTML = `
    <div class="setup-view">
      <button type="button" class="setup-back" data-setup-back>${getIcon('chevron-left', 16)} Back</button>
      <div class="setup-head">
        <h1 class="setup-title">Which apps do you drive for?</h1>
        <p class="setup-sub">Pick every one you earn on. Comma works out what each really pays you per hour, after costs — which is usually not the one you'd guess.</p>
      </div>
      <div class="setup-platform-list" data-setup-list>
        <div class="dashboard-activation-empty">Loading…</div>
      </div>
      <div class="setup-error" data-setup-error hidden></div>
      <div class="setup-cta-row">
        <ion-button data-setup-save disabled>Pick at least one</ion-button>
      </div>
    </div>
  `;

  root.querySelector('[data-setup-back]')?.addEventListener('click', goBack);

  const listEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-list]'));
  const errorEl = /** @type {HTMLElement} */ (root.querySelector('[data-setup-error]'));
  const saveBtn = /** @type {HTMLElement & { disabled: boolean }} */ (root.querySelector('[data-setup-save]'));

  /** @type {{ id: string, active: boolean }[]} */
  let rows = await db.platforms.toArray();
  /** @type {Set<string>} */
  const selected = new Set(rows.filter((p) => p.active).map((p) => String(p.id)));

  function paintList() {
    listEl.innerHTML = rows
      .map((p) => {
        const id = String(p.id);
        const cfg = getPlatformConfig(id);
        const name = String(p.name || cfg.name || id);
        const color = String(p.color || cfg.color || 'var(--color-other)');
        const on = selected.has(id);
        return `<button type="button" class="setup-platform-row${on ? ' is-on' : ''}" data-platform-id="${esc(id)}" role="checkbox" aria-checked="${on ? 'true' : 'false'}">
          <span class="setup-platform-ident">
            <span class="setup-platform-dot" style="background:${esc(color)}"></span>
            <span class="setup-platform-name">${esc(name)}</span>
          </span>
          ${on ? `<span class="setup-platform-check">${getIcon('check', 16)}</span>` : ''}
        </button>`;
      })
      .join('');
    paintCta();
  }

  function paintCta() {
    const n = selected.size;
    saveBtn.disabled = n === 0;
    saveBtn.textContent = n === 0 ? 'Pick at least one' : `Save ${n} app${n === 1 ? '' : 's'}`;
  }

  listEl.addEventListener('click', (e) => {
    const btn = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('[data-platform-id]') : null);
    if (!btn) return;
    const id = btn.getAttribute('data-platform-id');
    if (!id) return;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    paintList();
  });

  saveBtn.addEventListener('click', async () => {
    if (/** @type {any} */ (saveBtn).disabled) return;
    errorEl.hidden = true;
    /** @type {any} */ (saveBtn).disabled = true;
    try {
      // Write every platform's state, not just the additions — an unticked app has to
      // actually switch off, or the driver's per-platform comparison keeps counting
      // somewhere they quit. Deactivating the last active one throws — skip it rather than
      // let the whole save fail; the driver is still mid-decision on that one.
      for (const p of rows) {
        const id = String(p.id);
        const wantOn = selected.has(id);
        if (wantOn === !!p.active) continue;
        if (wantOn) await addPlatform(id);
        else {
          try {
            await deactivatePlatform(id);
          } catch (err) {
            if (err instanceof Error && err.message === 'last_platform') continue;
            throw err;
          }
        }
      }
      await markActivationDone('platforms');
      showToast({ type: 'success', message: 'Apps updated', duration: 1800 });
      goBack();
    } catch (err) {
      console.warn('[comma setup] platform save failed', err);
      errorEl.textContent = "Couldn't save that. Try again.";
      errorEl.hidden = false;
    } finally {
      /** @type {any} */ (saveBtn).disabled = selected.size === 0;
    }
  });

  paintList();
}
