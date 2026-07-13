import { t } from '../../utils/strings.js';
import { showNumericKeypad } from '../../ui/components.js';
import { ExpenseCategoryRegistry } from '../../registry/expense-categories/index.js';

/** @deprecated Use `ExpenseCategoryRegistry.getAll()` — kept for bundle callers expecting this export. */
export const PRESET_EXPENSE_CATEGORIES = ExpenseCategoryRegistry.getAll().map((c) => ({ id: c.id, emoji: c.emoji }));

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function nowYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readReceiptAsBase64(file) {
  if (!file) return null;
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
    fr.onerror = () => reject(new Error('receipt:read_failed'));
    fr.readAsDataURL(file);
  });
  if (!dataUrl || !file.type.startsWith('image/')) return dataUrl;

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('receipt:decode_failed'));
    el.src = dataUrl;
  });
  const maxW = 1280;
  const maxH = 1280;
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/**
 * @param {{
 *   initial?: Record<string, unknown>;
 *   platforms?: Array<{ id: string; name?: string }>;
 *   categories?: Array<{ id: string; name: string; emoji?: string; custom?: boolean }>;
 *   isHstRegistered?: boolean;
 *   currencySymbol?: string;
 *   submitLabel?: string;
 *   onCancel?: () => void;
 * }} options
 */
export function renderExpenseForm(options = {}) {
  const {
    initial = {},
    platforms = [],
    categories = [],
    isHstRegistered = false,
    currencySymbol = '$',
    submitLabel = t('common.save'),
    onCancel,
  } = options;

  const catRows = categories.length
    ? categories
    : PRESET_EXPENSE_CATEGORIES.map((c) => ({ id: c.id, name: c.id, emoji: c.emoji, custom: false }));

  const platformOptions = [
    `<option value="all">${esc(t('app.platformAll'))}</option>`,
    ...platforms.map((p) => `<option value="${esc(p.id)}">${esc(p.name || p.id)}</option>`),
  ].join('');

  const root = document.createElement('div');
  root.className = 'expenses-form-inner';
  root.innerHTML = `
    <form class="expenses-form" novalidate>
      <div class="expenses-categories" data-slot="categories"></div>

      <label class="field">
        <span class="field-label">${esc(t('expenses.amount'))}</span>
        <div class="field-inline">
          <input class="input" type="number" step="0.01" min="0" name="amount" inputmode="decimal" />
          <button type="button" class="btn btn-ghost btn-sm" data-action="keypad">${esc(t('ui.keypad.open'))}</button>
        </div>
      </label>

      <label class="field">
        <span class="field-label">${esc(t('expenses.date'))}</span>
        <input class="input" type="date" name="date" />
      </label>

      <label class="field">
        <span class="field-label">${esc(t('expenses.platformAssignment'))}</span>
        <select class="select" name="platformId">${platformOptions}</select>
      </label>

      <label class="field">
        <span class="field-label">${esc(t('expenses.businessUsePct'))}</span>
        <input type="range" min="0" max="100" step="1" name="deductiblePct" />
        <span class="field-hint" data-slot="deductible-pct-label"></span>
      </label>

      <label class="field">
        <span class="field-label">Merchant</span>
        <input class="input" type="text" name="merchant" autocomplete="off" placeholder="e.g. Shell, Tim Hortons" />
      </label>

      <label class="field">
        <span class="field-label">${esc(t('expenses.notes'))}</span>
        <textarea class="input textarea" name="notes" placeholder="${esc(t('expenses.notesPlaceholder'))}"></textarea>
      </label>

      <label class="field">
        <span class="field-label">${esc(t('expenses.receipt'))}</span>
        <input class="input" type="file" accept="image/*" name="receiptFile" />
        <span class="field-hint" data-slot="receipt-label">${esc(t('expenses.receiptHint'))}</span>
      </label>

      <label class="toggle">
        <input type="checkbox" name="isRecurring" />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span>${esc(t('expenses.recurring'))}</span>
      </label>

      <label class="field" data-slot="interval-wrap" hidden>
        <span class="field-label">${esc(t('expenses.recurringInterval'))}</span>
        <select class="select" name="recurringInterval">
          <option value="monthly">${esc(t('expenses.recurringMonthly'))}</option>
          <option value="annual">${esc(t('expenses.recurringAnnual'))}</option>
          <option value="weekly">${esc(t('expenses.recurringWeekly'))}</option>
        </select>
      </label>

      <label class="toggle" data-slot="confirmed-wrap" hidden>
        <input type="checkbox" name="confirmedPaid" />
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span>${esc(t('expenses.confirmedPaid'))}</span>
      </label>

      <label class="field" data-slot="hst-wrap" ${isHstRegistered ? '' : 'hidden'}>
        <span class="field-label">${esc(t('expenses.hstItc'))}</span>
        <input class="input" type="number" name="hstPaid" min="0" step="0.01" inputmode="decimal" />
      </label>

      <div class="shifts-form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel">${esc(t('common.cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
      </div>
    </form>
  `;

  const form = root.querySelector('form');
  const cats = root.querySelector('[data-slot="categories"]');
  const pctLabel = root.querySelector('[data-slot="deductible-pct-label"]');
  const intervalWrap = root.querySelector('[data-slot="interval-wrap"]');
  const confirmedWrap = root.querySelector('[data-slot="confirmed-wrap"]');

  let selectedCategory = String(initial.category || catRows[0]?.id || 'other');
  const customCategory = String(initial.customCategory || '');
  let receiptData = typeof initial.receiptData === 'string' ? initial.receiptData : null;

  function renderCategoryGrid() {
    if (!cats) return;
    cats.innerHTML = catRows
      .map((c) => {
        const active = c.id === selectedCategory;
        return `<button type="button" class="expense-category-btn${active ? ' is-selected' : ''}" data-category-id="${esc(c.id)}">${esc(c.emoji || '🧾')} <span>${esc(c.name)}</span></button>`;
      })
      .join('');
  }

  function updateDeductiblePctLabel() {
    if (!pctLabel || !form) return;
    const pct = Number(form.deductiblePct.value || 0);
    pctLabel.textContent = t('expenses.businessUseLabel').replace('{pct}', String(Math.round(pct)));
  }

  function syncRecurringVisibility() {
    if (!form || !intervalWrap) return;
    const rec = form.isRecurring.checked;
    intervalWrap.hidden = !rec;
    if (confirmedWrap instanceof HTMLElement) confirmedWrap.hidden = !rec;
  }

  function syncDeductiblePctDeductibility() {
    if (!form) return;
    const catDef = ExpenseCategoryRegistry.getById(selectedCategory);
    const deductible = catDef ? catDef.deductible !== false : true;
    if (!deductible) {
      form.deductiblePct.value = '0';
      form.deductiblePct.disabled = true;
      const field = form.deductiblePct.closest('.field');
      if (field) field.style.opacity = '0.5';
    } else {
      form.deductiblePct.disabled = false;
      const field = form.deductiblePct.closest('.field');
      if (field) field.style.opacity = '1';
      if (form.deductiblePct.value === '0') {
        form.deductiblePct.value = initial.deductiblePct != null ? String(initial.deductiblePct) : '100';
      }
    }
    updateDeductiblePctLabel();
  }

  renderCategoryGrid();

  if (form) {
    const amt = Number(initial.amount);
    form.amount.value = initial.amount != null && Number.isFinite(amt) ? String(amt) : '';
    form.date.value = initial.date ? String(initial.date) : nowYmd();
    form.platformId.value = initial.platformId == null ? 'all' : String(initial.platformId || 'all');
    form.deductiblePct.value = initial.deductiblePct != null ? String(initial.deductiblePct) : '100';
    form.merchant.value = initial.merchant ? String(initial.merchant) : '';
    form.notes.value = initial.notes ? String(initial.notes) : '';
    form.isRecurring.checked = Boolean(initial.isRecurring);
    form.recurringInterval.value = String(initial.recurringInterval || 'monthly');
    const hst = Number(initial.hstPaid ?? initial.hstItcAmount ?? 0);
    form.hstPaid.value = Number.isFinite(hst) && hst > 0 ? String(hst) : '';
    if (form.confirmedPaid instanceof HTMLInputElement) {
      form.confirmedPaid.checked =
        initial.id != null && initial.confirmedPaid != null
          ? Boolean(initial.confirmedPaid)
          : false;
    }
    syncDeductiblePctDeductibility();
    syncRecurringVisibility();
  }

  root.addEventListener('click', async (e) => {
    const el = e.target instanceof Element ? e.target.closest('[data-action],[data-category-id]') : null;
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'cancel') {
      onCancel?.();
      return;
    }
    if (action === 'keypad' && form) {
      showNumericKeypad({
        currency: currencySymbol,
        value: form.amount.value,
        onConfirm: (val) => {
          form.amount.value = val;
        },
      });
      return;
    }
    const categoryId = el.getAttribute('data-category-id');
    if (categoryId) {
      selectedCategory = categoryId;
      renderCategoryGrid();
      syncDeductiblePctDeductibility();
    }
  });

  form?.deductiblePct.addEventListener('input', updateDeductiblePctLabel);
  form?.isRecurring.addEventListener('change', () => {
    syncRecurringVisibility();
    if (form.isRecurring.checked && form.confirmedPaid instanceof HTMLInputElement && !initial.id) {
      form.confirmedPaid.checked = false;
    }
  });
  form?.receiptFile.addEventListener('change', async () => {
    const file = form.receiptFile.files && form.receiptFile.files[0];
    if (!file) {
      receiptData = null;
      return;
    }
    receiptData = await readReceiptAsBase64(file);
    const lab = root.querySelector('[data-slot="receipt-label"]');
    if (lab) lab.textContent = t('expenses.receiptAttached');
  });

  return {
    el: root,
    getValue() {
      if (!form) return {};
      const platformValue = String(form.platformId.value || 'all');
      const recurring = Boolean(form.isRecurring.checked);
      return {
        category: selectedCategory,
        customCategory: selectedCategory === 'custom' ? customCategory : '',
        amount: Number(form.amount.value || 0),
        date: String(form.date.value || nowYmd()),
        platformId: platformValue === 'all' ? null : platformValue,
        deductiblePct: Number(form.deductiblePct.value || 0),
        merchant: String(form.merchant.value || '').trim(),
        notes: String(form.notes.value || ''),
        receiptData,
        isRecurring: recurring,
        recurringInterval: recurring ? String(form.recurringInterval.value || 'monthly') : null,
        hstPaid: isHstRegistered ? Number(form.hstPaid.value || 0) : 0,
        confirmedPaid: recurring ? Boolean(form.confirmedPaid.checked) : true,
      };
    },
  };
}
