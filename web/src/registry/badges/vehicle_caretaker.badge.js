/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'vehicle_caretaker',
  name: "Vehicle Care",
  description: "Add a maintenance log entry.",
  icon: "🔧",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
