export default {
  id: 'chart',
  label: 'Year in review card',
  defaultIncluded: true,
  renderHTML: async () =>
    '<p style="color:var(--color-text-secondary);">Year-in-review card is rendered in the dedicated panel below when enabled.</p>',
  renderText: () => '',
  renderCSV: () => [],
};
