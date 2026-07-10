/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'streak_100',
  name: "Century Streak",
  description: "100-day work streak.",
  icon: "🌋",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.streakCount >= 100)(stats),
};
