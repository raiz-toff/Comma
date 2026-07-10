import { t } from '../utils/strings.js';

/**
 * Phase 1 route placeholder — real layouts ship with Phase 2 view modules.
 * @param {HTMLElement} root
 * @param {string} titleKey `t()` key
 * @param {string} bodyKey `t()` key
 * @param {string} [routeDebug]
 */
export function renderViewPlaceholder(root, titleKey, bodyKey, routeDebug = '') {
  root.textContent = '';
  const article = document.createElement('article');
  article.className = 'card card-raised route-placeholder';
  const h1 = document.createElement('h1');
  h1.className = 'app-header-title';
  h1.style.fontSize = 'var(--text-xl)';
  h1.textContent = t(titleKey);
  const p = document.createElement('p');
  p.style.marginTop = 'var(--space-3)';
  p.style.color = 'var(--color-text-secondary)';
  p.textContent = t(bodyKey);
  article.appendChild(h1);
  article.appendChild(p);
  if (routeDebug) {
    const meta = document.createElement('p');
    meta.className = 'text-xs';
    meta.style.marginTop = 'var(--space-2)';
    meta.style.fontFamily = 'var(--font-mono)';
    meta.style.color = 'var(--color-text-muted)';
    meta.textContent = routeDebug;
    article.appendChild(meta);
  }
  root.appendChild(article);
}
