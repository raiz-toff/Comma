/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'first_shift',
  name: "First Shift",
  description: "Log your first shift.",
  icon: "🚗",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.shiftCount >= 1)(stats),
};
