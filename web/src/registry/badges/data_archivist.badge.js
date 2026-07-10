/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'data_archivist',
  name: "Data Archivist",
  description: "Export a backup.",
  icon: "📦",
  category: 'milestone',
  condition: () => false,
  checkFromSweep: async () => false,
};
