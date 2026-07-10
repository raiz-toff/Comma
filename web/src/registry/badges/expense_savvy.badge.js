/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'expense_savvy',
  name: "Expense Savvy",
  description: "Log 10 expenses.",
  icon: "🧾",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.expenseCount >= 10)(stats),
};
