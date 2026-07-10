/**
 * Copy to `{id}.report-section.js`, register in `./index.js`.
 * @see docs/feature_modularity.md — Report section registry (Category B).
 */

export default {
  id: 'example',
  label: 'Example section',
  defaultIncluded: true,
  /** @param {unknown} _data @param {unknown} [_options] */
  renderHTML: async (_data, _options) => '',
  /** @param {unknown} _data @param {unknown} [_options] */
  renderText: (_data, _options) => '',
  /** @param {unknown} _data @param {unknown} [_options] */
  renderCSV: (_data, _options) => [],
};
