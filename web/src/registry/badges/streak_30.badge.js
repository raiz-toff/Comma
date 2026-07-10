/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'streak_30',
  name: "30-Day Streak",
  description: "Work 30 days in a row.",
  icon: "🔥",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.streakCount >= 30)(stats),
};
