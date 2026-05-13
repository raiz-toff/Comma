import { esc } from './esc.js';

export default {
  id: 'taxJar',
  label: 'Tax',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'misc',
  /** @param {unknown} _ctx */
  render: async (_ctx) =>
    `<span class="stat-label">${esc('Tax')}</span><span class="stat-value is-placeholder">—</span>`,
  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
