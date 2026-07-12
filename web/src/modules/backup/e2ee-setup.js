/**
 * COMMA — Full-page "turn on end-to-end encryption" flow (web mirror of mobile's
 * `src/components/sync/E2EESetupScreen.tsx`).
 *
 * Deliberately a full-page TAKEOVER, not a small dialog. Enabling E2EE is the only action in
 * the app that can render the user's data PERMANENTLY unrecoverable — no server, no reset
 * link, no support path. If the password is forgotten, the cloud copy is mathematically gone.
 *
 * Two gates, in order:
 *   1. RISK   — the consequence stated plainly, behind an explicit "I understand" checkbox.
 *               Continue stays disabled until it's ticked.
 *   2. CREATE — set + confirm, with a reveal toggle and a save-it-now reminder.
 *
 * @returns {Promise<string|null>} the chosen password, or null if the user backed out.
 */

export const MIN_E2EE_PW = 8;

export function showE2EESetup() {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = 'e2ee-takeover';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.setAttribute('aria-label', 'Turn on end-to-end encryption');

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey);
      host.remove();
      document.body.style.overflow = prevOverflow;
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') finish(null); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    const renderRisk = () => {
      host.innerHTML = `
        <div class="e2ee-bar">
          <button type="button" class="e2ee-close" data-cancel aria-label="Cancel">✕</button>
        </div>
        <div class="e2ee-body">
          <div class="e2ee-hero">
            <div class="e2ee-hero-icon">🛡️</div>
            <h1 class="e2ee-title">End-to-end encryption</h1>
            <p class="e2ee-sub">Your backup gets locked with a password only you know. Not even Google can read it.</p>
          </div>

          <div class="e2ee-card">
            <div class="e2ee-row">
              <span class="e2ee-row-icon">🔒</span>
              <div>
                <p class="e2ee-row-title">Your data is scrambled before it leaves this browser</p>
                <p class="e2ee-row-sub">Google stores a locked box it has no key to.</p>
              </div>
            </div>
            <div class="e2ee-row e2ee-row-bordered">
              <span class="e2ee-row-icon">🔑</span>
              <div>
                <p class="e2ee-row-title">You'll need this password on every device</p>
                <p class="e2ee-row-sub">Signing into Google is no longer enough on its own.</p>
              </div>
            </div>
          </div>

          <div class="e2ee-warn">
            <p class="e2ee-warn-head">⚠️ If you lose it, your data is gone</p>
            <p class="e2ee-warn-text">
              There is no reset link and no support recovery. Comma runs no server and never sees
              your password — so nobody, including us, can unlock your backup for you.
            </p>
            <ul class="e2ee-warn-list">
              <li>We cannot email you a new one.</li>
              <li>Google cannot recover it.</li>
              <li>Reinstalling the app will not help.</li>
            </ul>
            <p class="e2ee-warn-text" style="margin-top:8px">
              Write it down, or save it in a password manager, before you continue.
            </p>
          </div>

          <label class="e2ee-ack" data-ack-row>
            <input type="checkbox" data-ack />
            <span>I understand that if I forget this password, my cloud backup can never be recovered.</span>
          </label>
        </div>
        <div class="e2ee-footer">
          <button type="button" class="e2ee-primary" data-continue disabled>Continue</button>
        </div>
      `;

      const ack = host.querySelector('[data-ack]');
      const cont = host.querySelector('[data-continue]');
      const ackRow = host.querySelector('[data-ack-row]');
      ack.addEventListener('change', () => {
        cont.disabled = !ack.checked;
        ackRow.classList.toggle('is-checked', ack.checked);
      });
      cont.addEventListener('click', () => { if (ack.checked) renderCreate(); });
      host.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
    };

    const renderCreate = () => {
      host.innerHTML = `
        <div class="e2ee-bar">
          <button type="button" class="e2ee-close" data-cancel aria-label="Cancel">✕</button>
        </div>
        <div class="e2ee-body">
          <div class="e2ee-hero">
            <div class="e2ee-hero-icon">🔑</div>
            <h1 class="e2ee-title">Create your password</h1>
            <p class="e2ee-sub">
              This is the only key to your backup. Save it somewhere safe right now — you'll need
              it on every other device.
            </p>
          </div>

          <div class="e2ee-field">
            <span class="e2ee-label">PASSWORD</span>
            <div class="e2ee-input-wrap">
              <input class="e2ee-input" type="password" data-pw autocomplete="new-password"
                     placeholder="At least ${MIN_E2EE_PW} characters" />
              <button type="button" class="e2ee-reveal" data-reveal aria-label="Show password">👁</button>
            </div>
            <p class="e2ee-hint" data-hint></p>
          </div>

          <div class="e2ee-field">
            <span class="e2ee-label">CONFIRM PASSWORD</span>
            <input class="e2ee-input" type="password" data-pw2 autocomplete="new-password"
                   placeholder="Type it again" />
          </div>

          <p class="e2ee-err" data-err></p>

          <div class="e2ee-reminder">
            ☁️ Comma has no copy of this password. If it's lost, the backup can't be opened
            again — by anyone.
          </div>
        </div>
        <div class="e2ee-footer">
          <button type="button" class="e2ee-primary" data-submit disabled>Turn on encryption</button>
          <button type="button" class="e2ee-secondary" data-back>Back</button>
        </div>
      `;

      const pw = host.querySelector('[data-pw]');
      const pw2 = host.querySelector('[data-pw2]');
      const submit = host.querySelector('[data-submit]');
      const errEl = host.querySelector('[data-err]');
      const hintEl = host.querySelector('[data-hint]');
      const revealBtn = host.querySelector('[data-reveal]');

      const sync = () => {
        errEl.textContent = '';
        const short = pw.value.length > 0 && pw.value.length < MIN_E2EE_PW;
        hintEl.textContent = short
          ? `${MIN_E2EE_PW - pw.value.length} more character${MIN_E2EE_PW - pw.value.length === 1 ? '' : 's'} needed`
          : '';
        submit.disabled = !(pw.value.length >= MIN_E2EE_PW && pw2.value.length > 0);
      };
      pw.addEventListener('input', sync);
      pw2.addEventListener('input', sync);

      revealBtn.addEventListener('click', () => {
        const show = pw.type === 'password';
        pw.type = show ? 'text' : 'password';
        pw2.type = show ? 'text' : 'password';
        revealBtn.textContent = show ? '🙈' : '👁';
      });

      submit.addEventListener('click', () => {
        if (pw.value.length < MIN_E2EE_PW) {
          errEl.textContent = `Use at least ${MIN_E2EE_PW} characters.`;
          return;
        }
        if (pw.value !== pw2.value) {
          errEl.textContent = "The two passwords don't match.";
          return;
        }
        finish(pw.value);
      });

      host.querySelector('[data-back]').addEventListener('click', renderRisk);
      host.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      pw.focus();
    };

    renderRisk();
    document.body.appendChild(host);
  });
}
