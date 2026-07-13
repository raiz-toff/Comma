import { db, getAppState, setAppState } from '../core/db.js';
import { Router } from '../core/router.js';
import { getIcon } from '../ui/icons.js';
import { showToast, showModal } from '../ui/components.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export async function render(root, ctx) {
  root.textContent = '';

  const debugUnlocked = await getAppState('debug_mode_unlocked');
  
  if (!debugUnlocked) {
    // Access Denied State
    const deniedCard = document.createElement('div');
    deniedCard.className = 'card card-raised';
    deniedCard.style.cssText = `
      max-width: 500px;
      margin: 100px auto;
      text-align: center;
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
    `;
    deniedCard.innerHTML = `
      <div style="color: var(--color-danger);">${getIcon('warning', 48)}</div>
      <h2 style="font-size: var(--text-xl); font-weight: 800; margin: 0;">Developer Access Denied</h2>
      <p class="text-secondary" style="font-size: var(--text-sm); line-height: 1.6; margin: 0;">
        This page is locked by default. To access these tools, navigate to <strong>Settings &gt; About</strong> and tap the app version 5 times.
      </p>
      <ion-button size="small" fill="outline" href="#/settings">
        <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('settings', 16)}</span>
        Go to Settings
      </ion-button>
    `;
    root.appendChild(deniedCard);
    return;
  }

  // Retrieve current database stats for UI display
  const tableStats = {};
  for (const table of db.tables) {
    tableStats[table.name] = await table.count();
  }

  const wrap = document.createElement('div');
  wrap.className = 'debug-view-container';
  wrap.style.cssText = `
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4) var(--space-6);
  `;

  wrap.innerHTML = `
    <header style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-2);">
      <div>
        <h1 class="app-header-title" style="font-size: var(--text-2xl); font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: var(--space-2);">
          <span style="color: var(--color-brand); display: flex;">${getIcon('vault', 28)}</span> Developer Debug Tools
        </h1>
        <p class="text-secondary" style="margin-top: var(--space-1); font-size: var(--text-sm);">
          On-device database inspections, performance benchmarks, and diagnostic helpers.
        </p>
      </div>
      <ion-button id="lock-debug-btn" size="small" color="danger">
        <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('x', 14)}</span>
        Lock Debug Mode
      </ion-button>
    </header>

    <div style="display: grid; grid-template-columns: 1fr; gap: var(--space-4); @media (min-width: 768px) { grid-template-columns: 1fr 1fr; }">
      
      <!-- Vault Statistics Card -->
      <section class="card card-raised" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-brand);">
          ${getIcon('database', 22)}
          <h2 style="font-size: var(--text-lg); font-weight: 700; margin: 0;">Local Database Stats</h2>
        </div>
        <p class="text-secondary" style="font-size: var(--text-sm); margin: 0;">
          Row count statistics of IndexedDB tables stored securely on your browser.
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); background: var(--color-surface-raised); padding: var(--space-3); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: var(--text-xs);">
          ${Object.entries(tableStats).map(([table, count]) => `
            <div style="border-bottom: 1px dashed var(--color-border); padding-bottom: 4px;">
              <strong>${esc(table)}:</strong>
            </div>
            <div style="text-align: right; border-bottom: 1px dashed var(--color-border); padding-bottom: 4px; color: var(--color-text-secondary);">
              ${esc(count)} rows
            </div>
          `).join('')}
        </div>
        <div style="display: flex; gap: var(--space-2); margin-top: auto; padding-top: var(--space-2);">
          <ion-button id="inspect-vault-btn" size="small" fill="outline" style="flex: 1;">
            <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('search', 16)}</span>
            Inspect DB JSON
          </ion-button>
        </div>
      </section>

      <!-- Diagnostic Operations Card -->
      <section class="card card-raised" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
        <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-brand);">
          ${getIcon('bolt', 22)}
          <h2 style="font-size: var(--text-lg); font-weight: 700; margin: 0;">Diagnostic Helpers</h2>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div>
            <h3 style="font-size: var(--text-sm); font-weight: 700; margin: 0 0 var(--space-1) 0;">Generate Mock Shifts</h3>
            <p class="text-secondary" style="font-size: var(--text-xs); margin: 0 0 var(--space-2) 0; line-height: 1.4;">
              Instantly inserts 7 days of sample shift activity into the DB to test calculations and visual charts.
            </p>
            <ion-button id="gen-synthetic-btn" size="small" fill="outline" expand="block">
              <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('plus', 16)}</span>
              Seed Synthetic Data
            </ion-button>
          </div>

          <div style="border-top: 1px dashed var(--color-border); padding-top: var(--space-3);">
            <h3 style="font-size: var(--text-sm); font-weight: 700; margin: 0 0 var(--space-1) 0;">Performance Benchmark</h3>
            <p class="text-secondary" style="font-size: var(--text-xs); margin: 0 0 var(--space-2) 0; line-height: 1.4;">
              Measure search / indexing latency of your shifts. Logs execution benchmarks.
            </p>
            <div style="display: flex; gap: var(--space-2); align-items: center;">
              <ion-button id="run-benchmark-btn" size="small" fill="outline" style="flex: 1;">
                <span slot="start" aria-hidden="true" style="display: inline-flex;">${getIcon('trending-up', 16)}</span>
                Run Benchmark
              </ion-button>
              <div id="benchmark-result" style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-secondary); min-width: 80px; text-align: center;">-- ms</div>
            </div>
          </div>
        </div>
      </section>

    </div>

    <!-- API Reference Console Card -->
    <section class="card" style="padding: var(--space-4); background: var(--color-surface-raised);">
      <h3 style="font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); margin: 0 0 var(--space-2) 0; display: flex; align-items: center; gap: var(--space-1);">
        ${getIcon('code', 14)} Console Dev Commands
      </h3>
      <p class="text-secondary" style="font-size: var(--text-xs); margin: 0 0 var(--space-3) 0; line-height: 1.4;">
        Open your browser Developer Tools (F12 or inspect element) and type any of these global commands to interact directly with the database:
      </p>
      <pre style="margin: 0; background: var(--color-surface); border: 1px solid var(--color-border); padding: var(--space-3); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: var(--text-xs); overflow-x: auto; color: var(--color-text-secondary); line-height: 1.6;">
// Dumps full IndexedDB tables into console
await window.__comma.debug.inspectVault();

// Benchmarks IndexedDB query latency (limit 50)
await window.__comma.debug.timedQuery('shifts');

// Returns structural schema snapshot
window.__comma.debug.schemaDump();
      </pre>
    </section>
  `;

  // 1. Lock Debug Button Listener
  wrap.querySelector('#lock-debug-btn')?.addEventListener('click', async () => {
    await setAppState('debug_mode_unlocked', false);
    showToast({ type: 'info', message: 'Debug mode locked successfully.' });
    Router.navigate('settings');
  });

  // 2. Synthetic Data Seeder Button Listener
  wrap.querySelector('#gen-synthetic-btn')?.addEventListener('click', async () => {
    try {
      const addedCount = await window.__comma.debug.generateSyntheticData();
      showToast({ type: 'success', message: `Successfully seeded ${addedCount} synthetic shifts! 🚀` });
      Router.navigate('dashboard');
    } catch (e) {
      console.error(e);
      showToast({ type: 'error', message: 'Failed to generate synthetic data.' });
    }
  });

  // 3. Inspect Vault JSON Button Listener
  wrap.querySelector('#inspect-vault-btn')?.addEventListener('click', async () => {
    try {
      const payload = await window.__comma.debug.inspectVault();
      
      const content = document.createElement('div');
      content.style.cssText = 'max-height: 400px; overflow-y: auto; padding: var(--space-2);';
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-family: var(--font-mono); font-size: 11px; margin: 0; white-space: pre-wrap; word-break: break-all;';
      pre.textContent = JSON.stringify(payload, null, 2);
      content.appendChild(pre);

      showModal({
        title: 'Vault JSON Database Export',
        content,
        size: 'lg',
        actions: [
          {
            label: 'Copy JSON',
            class: 'btn btn-primary',
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(payload));
                showToast({ type: 'success', message: 'Database JSON copied to clipboard!' });
              } catch {
                showToast({ type: 'warning', message: 'Failed to copy to clipboard.' });
              }
            }
          },
          { label: 'Close', class: 'btn btn-ghost' }
        ]
      });
    } catch (e) {
      showToast({ type: 'error', message: 'Could not fetch database vault.' });
    }
  });

  // 4. Benchmark Button Listener
  wrap.querySelector('#run-benchmark-btn')?.addEventListener('click', async () => {
    const resultEl = wrap.querySelector('#benchmark-result');
    if (resultEl) resultEl.textContent = 'Running...';
    try {
      const res = await window.__comma.debug.timedQuery('shifts', 50);
      if (resultEl) resultEl.textContent = `${res.elapsedMs.toFixed(2)} ms`;
      showToast({ type: 'success', message: 'Benchmark completed successfully.' });
    } catch (e) {
      if (resultEl) resultEl.textContent = 'Error';
      showToast({ type: 'error', message: 'Benchmark failed.' });
    }
  });

  root.appendChild(wrap);
}
