/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'goal_month_hit',
  name: "Monthly Goal",
  description: "Hit your monthly earnings goal.",
  icon: "📅",
  category: 'milestone',
  condition: () => false,
  checkFromGoalHistory: async (g) => ((g) => g.goal.scope === 'monthly' && g.goal.type === 'earnings' && g.hit)(g),
};
