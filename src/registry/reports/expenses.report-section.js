export default {
  id: 'expenses',
  label: 'Expense list',
  defaultIncluded: true,
  /** @param {unknown} report @param {unknown} [_user] */
  renderHTML: async (report) => {
    const r = /** @type {{ expenses?: unknown[] }} */ (report);
    const n = Array.isArray(r.expenses) ? r.expenses.length : 0;
    return `<p style="color:var(--color-text-secondary);">${n} expense row${n === 1 ? '' : 's'} in range (detail export: expenses CSV).</p>`;
  },
  /** @param {unknown} report @param {unknown} [_user] */
  renderText: (report) => {
    const r = /** @type {{ expenses?: unknown[] }} */ (report);
    const n = Array.isArray(r.expenses) ? r.expenses.length : 0;
    return `Expense rows: ${n}`;
  },
  /** @param {unknown} report @param {unknown} [_user] */
  renderCSV: (report) => {
    const r = /** @type {{ expenses?: Array<Record<string, unknown>> }} */ (report);
    const rows = Array.isArray(r.expenses) ? r.expenses : [];
    const header = ['id', 'date', 'category', 'platformId', 'amount', 'businessPct', 'notes', 'hstPaid', 'confirmedPaid', 'customCategory', 'source', 'businessAmount'];
    
    const getDollars = (cents) => {
      if (cents == null) return 0;
      const n = Number(cents);
      return Number.isFinite(n) ? n / 100 : 0;
    };

    const body = rows.map((e) => {
      const amount = getDollars(e.amount);
      const pct = Number(e.businessPct ?? 100);
      const businessAmount = Math.round(amount * pct) / 100;
      
      return [
        e.id,
        e.date,
        e.category,
        e.platformId ?? '',
        amount,
        pct,
        e.notes ?? '',
        getDollars(e.hstPaid),
        e.confirmedPaid ? 'true' : 'false',
        e.customCategory ?? '',
        e.source ?? '',
        businessAmount,
      ];
    });
    return [header, ...body];
  },
};
