/**
 * Copy to `{id}.metric.js`, register in `./index.js`.
 * @see docs/feature_modularity.md — Analytics metric registry (Category B).
 */

export default {
  id: 'example',
  label: 'Example metric',
  shortLabel: 'Ex',
  format: 'number',
  showInAnalytics: false,
  /** @param {unknown} _shift @param {unknown} [_vehicle] */
  calcPerShift: (_shift, _vehicle) => null,
};
