/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'rain_rider',
  name: "Rain Rider",
  description: "Log shifts in tagged bad weather.",
  icon: "🌧️",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => String(s.shift.weather || "").toLowerCase().includes("rain"))({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
