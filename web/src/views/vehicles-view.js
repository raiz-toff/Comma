import { renderVehiclesView } from '../modules/vehicles/vehicles.js';
import '../css/views/vehicles.css';

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export function render(root, ctx) {
  void ctx;
  return renderVehiclesView(root);
}
