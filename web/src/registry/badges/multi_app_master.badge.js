/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'multi_app_master',
  name: "Multi-App",
  description: "Log a multi-app shift.",
  icon: "📱",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => s.shift.isMultiApp === true)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
