/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'weekend_warrior',
  name: "Weekend Warrior",
  description: "10+ weekend shifts logged.",
  icon: "🎉",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async (stats) => ((s) => s.weekendShifts >= 10)(stats),
};
