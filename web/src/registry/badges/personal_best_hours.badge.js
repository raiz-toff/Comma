/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'personal_best_hours',
  name: "Hour Hero",
  description: "Beat your best net hourly rate.",
  icon: "⚡",
  category: 'milestone',
  condition: () => false,
  checkFromPersonalRecords: async (r) => ((r) => r.changedNetHourly)(r),
};
