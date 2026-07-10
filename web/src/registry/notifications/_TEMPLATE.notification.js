/**
 * Copy to `{id}.notification.js`, register in `./index.js`.
 * @see docs/feature_modularity.md — Notification registry (Category B).
 */

export default {
  id: 'example',
  type: 'toast',
  cooldown: '7d',
  message: () => '',
  priority: 5,
  userToggleable: true,
  /** @returns {Promise<boolean>} */
  condition: async () => false,
};
