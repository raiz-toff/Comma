import { renderScheduleModule } from '../modules/schedule/schedule.js';

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  void ctx;
  await renderScheduleModule(root, ctx);
}
