/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'thousand_month',
  name: "Thousand Club",
  description: "Earn $1,000+ in a month.",
  icon: "🏆",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => s.monthGross >= 1000)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
