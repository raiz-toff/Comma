import { getCommunityTips, toggleZenMode } from '../modules/p13/p13.js';

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export function render(root, ctx) {
  root.textContent = '';
  const article = document.createElement('article');
  article.className = 'card card-raised p13-about';
  article.innerHTML = `
    <header>
      <h1 class="app-header-title" style="font-size:var(--text-xl)">Polish & Community</h1>
      <p class="text-secondary">Final-phase quality features and driver-focused references.</p>
      <p class="text-xs text-mono">${String(ctx.hash || '')}</p>
    </header>
    <section class="p13-about-section">
      <h2>Competitor comparison</h2>
      <p>COMMA is local-first, offline-capable, and privacy-focused. Most alternatives require account sync and cloud storage.</p>
      <ul>
        <li>Local-first vault with export/restore support</li>
        <li>No required login to use core features</li>
        <li>Platform terminology and tax estimators built-in</li>
      </ul>
    </section>
    <section class="p13-about-section">
      <h2>Driver community tips board</h2>
      <ul data-community-tips></ul>
    </section>
    <section class="p13-about-section">
      <h2>Focus tools</h2>
      <ion-button fill="outline" data-zen-toggle>Toggle Zen Mode</ion-button>
    </section>
  `;
  const tipsEl = article.querySelector('[data-community-tips]');
  if (tipsEl) {
    tipsEl.innerHTML = getCommunityTips().map((tip) => `<li>${tip}</li>`).join('');
  }
  article.querySelector('[data-zen-toggle]')?.addEventListener('click', () => {
    toggleZenMode();
  });
  root.appendChild(article);
}
