/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'goal_week_hit',
  name: "Weekly Goal",
  description: "Hit your weekly earnings goal.",
  icon: "✅",
  category: 'milestone',
  condition: () => false,
  checkFromGoalHistory: async (g) => ((g) => g.hit && g.goal.scope === 'weekly' && g.goal.type === 'earnings')(g),
};
