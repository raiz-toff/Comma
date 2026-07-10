/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'perfect_week',
  name: "Perfect Week",
  description: "Hit goal every day of the week.",
  icon: "⭐",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
