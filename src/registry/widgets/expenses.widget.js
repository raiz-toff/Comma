import { esc } from './esc.js';

export default {
  id: 'expenses',
  label: 'Expenses',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'misc',
  /** @param {unknown} _ctx */
  render: async (_ctx) =>
    `<span class="stat-label">${esc('Expenses')}</span><span class="stat-value is-placeholder">—</span>`,
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
