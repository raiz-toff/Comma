import { renderTaxDashboard } from '../modules/tax/tax.js';
import '../css/views/tax.css';

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export function render(root, ctx) {
  return renderTaxDashboard(root, ctx);
}
