/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'streak_7',
  name: "7-Day Streak",
  description: "Work 7 days in a row.",
  icon: "🔥",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.streakCount >= 7)(stats),
};
