/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'five_hundred_week',
  name: "Power Week",
  description: "Earn $500+ in one week.",
  icon: "💵",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => s.weekGross >= 500)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
