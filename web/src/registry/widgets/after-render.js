import { WidgetRegistry } from './index.js';

/**
 * Executes the afterRender lifecycle method for all widgets found within a container.
 * @param {HTMLElement} root The container element to search for widgets.
 * @param {unknown} ctx The data context to pass to the afterRender method.
 */
export function afterRenderWidgets(root, ctx) {
  if (!root) return;
  const cards = root.querySelectorAll('[data-widget-id]');
  for (const card of cards) {
    const id = card.getAttribute('data-widget-id');
    const w = WidgetRegistry.getById(id);
    if (w && typeof w.afterRender === 'function') {
      try {
        // Many widgets expect the first argument to be an element inside the card, 
        // or the card itself. We'll pass the card.
        w.afterRender(card, ctx);
      } catch (err) {
        console.warn(`[comma] afterRender failed for widget "${id}":`, err);
      }
    }
  }
}
