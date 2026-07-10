export default {
  id: 'placeholder',
  label: 'Placeholder',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'misc',
  render:      async (_ctx)      => '<div class="widget-card" data-registry-widget="placeholder"></div>',
  afterRender: (_el, _ctx)       => {},
  destroy:     (_el)             => {},
};
