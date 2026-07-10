/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'night_owl',
  name: "Night Owl",
  description: "Complete a shift ending after midnight.",
  icon: "🦉",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
