/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'peak_collector',
  name: "Peak Pay",
  description: "Log platform peak/surge bonus fields.",
  icon: "📊",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
