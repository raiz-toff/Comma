/**
 * COMMA — Full-page "forgot your backup password" confirmation (web mirror of mobile's
 * `src/components/sync/ForgotPasswordScreen.tsx`).
 *
 * A forgotten password is mathematically unrecoverable — that's what makes it secure, and it's
 * why backup-password-setup.js makes the user read this consequence before they ever set one.
 * This is where that consequence actually lands: the only way forward is to give up on
 * whatever's still locked behind the old password by wiping this browser's vault and
 * restarting Cloud Sync fresh, on the same Google Drive account, with a new password. Full
 * screen + an explicit "I understand" gate, same weight as backup-password-setup.js — not a
 * dialog you can click through without reading, because the consequence (this browser's data,
 * gone) is permanent.
 *
 * Reuses the `.e2ee-*` CSS scaffolding — generic full-screen takeover styling, not
 * encryption-specific.
 *
 * @returns {Promise<boolean>} true if the user confirmed (caller still runs the actual wipe).
 */

export function showForgotPassword() {
  return new Promise((resolve) => {
    document.querySelectorAll('ion-modal.e2ee-modal').forEach((n) => n.remove());
    const modal = /** @type {HTMLElement & { present: () => Promise<void>; dismiss: () => Promise<boolean> }} */ (
      document.createElement('ion-modal')
    );
    modal.classList.add('e2ee-modal');
    /** @type {any} */ (modal).breakpoints = [0, 0.92];
    /** @type {any} */ (modal).initialBreakpoint = 0.92;
    /** @type {any} */ (modal).handle = true;
    modal.setAttribute('aria-label', 'Forgot your backup password');

    const host = document.createElement('div');
    host.className = 'e2ee-takeover';
    modal.appendChild(host);

    let confirmed = false;
    const finish = (value) => {
      confirmed = value;
      void modal.dismiss();
    };
    modal.addEventListener('ionModalDidDismiss', () => {
      modal.remove();
      resolve(confirmed);
    });

    host.innerHTML = `
      <div class="e2ee-bar">
        <ion-button fill="clear" size="small" color="medium" data-cancel aria-label="Cancel">✕</ion-button>
      </div>
      <div class="e2ee-body">
        <div class="e2ee-hero">
          <div class="e2ee-hero-icon" style="background:color-mix(in srgb, var(--color-danger) 12%, transparent);border-color:var(--color-danger);">⚠️</div>
          <h1 class="e2ee-title">Forgot your password?</h1>
          <p class="e2ee-sub">We can't recover an encrypted password — that's what makes it secure.</p>
        </div>

        <div class="e2ee-warn">
          <p class="e2ee-warn-head">This wipes this browser's vault and starts fresh</p>
          <p class="e2ee-warn-text">
            Cloud Sync restarts on the same Google Drive account with a new password.
          </p>
          <ul class="e2ee-warn-list">
            <li>Everything currently on this browser is erased.</li>
            <li>Anything still on another device stays safe there.</li>
            <li>Anything that only existed under the old password is gone for good.</li>
          </ul>
        </div>

        <label class="e2ee-ack" data-ack-row>
          <input type="checkbox" data-ack />
          <span>I understand this browser's vault will be wiped and this cannot be undone.</span>
        </label>
      </div>
      <div class="e2ee-footer">
        <ion-button expand="block" color="danger" data-reset disabled>Reset &amp; Restart</ion-button>
        <ion-button expand="block" fill="clear" color="medium" data-cancel-btn>Cancel</ion-button>
      </div>
    `;

    const ack = host.querySelector('[data-ack]');
    const resetBtn = host.querySelector('[data-reset]');
    const ackRow = host.querySelector('[data-ack-row]');
    ack.addEventListener('change', () => {
      resetBtn.disabled = !ack.checked;
      ackRow.classList.toggle('is-checked', ack.checked);
    });
    resetBtn.addEventListener('click', () => { if (ack.checked) finish(true); });
    host.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    host.querySelector('[data-cancel-btn]').addEventListener('click', () => finish(false));

    document.body.appendChild(modal);
    void modal.present();
  });
}
