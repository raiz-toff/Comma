/**
 * Step-by-step form wizard — turns a single-block form into the phone app's
 * multi-step Add flow (see `app/expense/add.tsx` / `app/shift/add.tsx`).
 *
 * The form's markup keeps every field it always had; the caller just wraps each
 * group of fields in a `<div class="wizard-step">…</div>`. This helper then adds
 * a progress header (dots + "Step X of Y · Title") above the steps and a
 * Back / Continue / Save footer below, and shows one step at a time.
 *
 * Native submit is preserved: the footer's primary button is a real
 * `type="submit"` on the LAST step, so the caller's own `form.addEventListener
 * ('submit', …)` still fires and saves. On earlier steps (or if the user hits
 * Enter in a field) submit is intercepted and advances to the next step instead.
 * The interception listener is registered here, before the caller attaches its
 * own, so `stopImmediatePropagation` reliably blocks a premature save.
 */

import { t } from '../utils/strings.js';

/**
 * @param {HTMLFormElement} form
 * @param {{
 *   steps: Array<{ title: string, validate?: () => (string | null | undefined) }>,
 *   submitLabel?: string,
 *   onCancel?: () => void,
 *   onStepChange?: (index: number) => void,
 * }} opts
 * @returns {{ getStep: () => number, goTo: (i: number) => void, stepCount: number }}
 */
export function initFormWizard(form, opts) {
  const { steps = [], submitLabel = t('common.save'), onCancel, onStepChange } = opts;
  const stepEls = /** @type {HTMLElement[]} */ (Array.from(form.querySelectorAll('.wizard-step')));
  const count = stepEls.length;
  if (count === 0) return { getStep: () => 0, goTo: () => {}, stepCount: 0 };

  let current = 0;

  const header = document.createElement('div');
  header.className = 'wizard-head';
  header.innerHTML = `
    <div class="wizard-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="1">
      ${stepEls.map((_, i) => `<span class="wizard-dot" data-dot="${i}"></span>`).join('')}
    </div>
    <span class="wizard-steplabel" data-wizard-steplabel></span>
    <p class="wizard-error is-hidden" data-wizard-error role="alert"></p>
  `;
  form.insertBefore(header, form.firstChild);

  const footer = document.createElement('div');
  footer.className = 'wizard-foot';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost wizard-back" data-wizard-back></button>
    <button type="submit" class="btn btn-primary wizard-next" data-wizard-next></button>
  `;
  form.appendChild(footer);

  const dotsWrap = /** @type {HTMLElement} */ (header.querySelector('.wizard-dots'));
  const dotEls = /** @type {HTMLElement[]} */ (Array.from(header.querySelectorAll('[data-dot]')));
  const labelEl = header.querySelector('[data-wizard-steplabel]');
  const errorEl = /** @type {HTMLElement | null} */ (header.querySelector('[data-wizard-error]'));
  const backBtn = /** @type {HTMLButtonElement} */ (footer.querySelector('[data-wizard-back]'));
  const nextBtn = /** @type {HTMLButtonElement} */ (footer.querySelector('[data-wizard-next]'));

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('is-hidden');
  }
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('is-hidden');
  }

  function render() {
    const isLast = current === count - 1;
    stepEls.forEach((el, i) => el.classList.toggle('is-hidden', i !== current));
    dotEls.forEach((el, i) => el.classList.toggle('is-active', i <= current));
    if (dotsWrap) dotsWrap.setAttribute('aria-valuenow', String(current + 1));

    const title = steps[current]?.title || '';
    const stepText = t('common.stepOf')
      .replace('{current}', String(current + 1))
      .replace('{total}', String(count));
    if (labelEl) labelEl.textContent = title ? `${stepText} · ${title}` : stepText;

    backBtn.textContent = current === 0 ? t('common.cancel') : t('common.back');
    nextBtn.textContent = isLast ? submitLabel : t('common.continue');
    // Only the final step's button submits the form (and reaches the caller's
    // save handler); earlier steps advance without submitting.
    nextBtn.setAttribute('type', isLast ? 'submit' : 'button');

    onStepChange?.(current);
  }

  /** @returns {boolean} true when the current step passed validation. */
  function validateCurrent() {
    clearError();
    const err = steps[current]?.validate?.();
    if (err) {
      showError(err);
      return false;
    }
    return true;
  }

  function goTo(i) {
    const next = Math.max(0, Math.min(count - 1, i));
    if (next === current) return;
    current = next;
    clearError();
    render();
    // Bring the freshly shown step into view within the scrolling sheet.
    const host = form.closest('.expenses-m-sheet-body, .shift-sheet-body') || form;
    if (host && typeof host.scrollTo === 'function') host.scrollTo({ top: 0, behavior: 'auto' });
  }

  function advance() {
    if (!validateCurrent()) return;
    if (current < count - 1) goTo(current + 1);
  }

  backBtn.addEventListener('click', () => {
    if (current === 0) onCancel?.();
    else goTo(current - 1);
  });

  nextBtn.addEventListener('click', (e) => {
    // On the last step this is a real submit button — let it submit.
    if (current === count - 1) return;
    e.preventDefault();
    advance();
  });

  // Registered before the caller's submit listener: on any non-final submit
  // (e.g. Enter in a text field) advance instead of saving.
  form.addEventListener('submit', (e) => {
    if (current < count - 1) {
      e.preventDefault();
      e.stopImmediatePropagation();
      advance();
      return;
    }
    // Final step: validate before letting the caller's handler run.
    if (!validateCurrent()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  render();

  return { getStep: () => current, goTo, stepCount: count };
}
