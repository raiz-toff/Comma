/** @param {unknown} _s */
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default {
  id: 'century_day',
  name: "Century Day",
  description: "Earn $100+ in a single day.",
  icon: "💯",
  category: 'milestone',
  condition: () => false,
  checkFromShift: async (ctx) => {
    const shift = ctx.shift;
    const gross = num(shift?.grossRevenue, 0);
    return ((s) => s.gross >= 100)({ shift, gross, weekGross: ctx.weekGross, monthGross: ctx.monthGross });
  },
};
