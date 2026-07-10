/**
 * Copy to `{id}.widget.js`, register in `./index.js`.
 * @see docs/feature_modularity.md — Widget registry (Category B).
 */

export default {
  id: 'example',
  label: 'Example widget',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'misc',

  /** @param {unknown} _ctx */
  render: async (_ctx) => '<div class="widget-card"></div>',

  /** @param {HTMLElement} _el @param {unknown} _ctx */
  afterRender: (_el, _ctx) => {},

  /** @param {HTMLElement} _el */
  destroy: (_el) => {},
};
