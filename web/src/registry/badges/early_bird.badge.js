/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'early_bird',
  name: "Early Bird",
  description: "Complete a shift starting before 7am.",
  icon: "🌅",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
