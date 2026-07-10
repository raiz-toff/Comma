/**
 * Copy to `{id}.badge.js`, register in `./index.js`.
 * @see docs/feature_modularity.md — Badge registry (Category B).
 */

export default {
  id: 'example',
  name: 'Example',
  description: 'Description',
  icon: '🏅',
  category: 'milestone',
  rarity: 'common',
  secret: false,
  /** @param {unknown} _stats */
  condition: (_stats) => false,
};
