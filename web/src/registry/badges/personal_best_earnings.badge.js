/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'personal_best_earnings',
  name: "Personal Best",
  description: "Beat your best single-shift gross.",
  icon: "📈",
  category: 'milestone',
  condition: () => false,
  checkFromPersonalRecords: async (r) => ((r) => r.changedGross)(r),
};
