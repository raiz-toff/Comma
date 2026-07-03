/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'bonus_hunter',
  name: "Bonus Hunter",
  description: "Bonus earnings over 15% of gross on a shift.",
  icon: "🎯",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => num(s.shift.customFields?.bonusAmount, 0) > 0 && s.gross > 0 && num(s.shift.customFields?.bonusAmount, 0) / s.gross >= 0.15)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
