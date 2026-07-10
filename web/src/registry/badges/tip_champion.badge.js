/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'tip_champion',
  name: "Tip Champion",
  description: "Tip rate above 25% on a shift.",
  icon: "💜",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => num(s.shift.tipsRevenue, 0) > 0 && s.gross > 0 && num(s.shift.tipsRevenue, 0) / s.gross >= 0.25)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
