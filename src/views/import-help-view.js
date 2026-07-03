import { getIcon } from '../ui/icons.js';
import { t } from '../utils/strings.js';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} filename
 * @param {string} content
 */
function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** @param {HTMLElement} root */
export async function render(root) {
  root.innerHTML = `
    <section class="view-body" style="padding: var(--space-8); max-width: 900px; margin: 0 auto;">
      <header style="margin-bottom: var(--space-10); border-bottom: 2px solid var(--color-border); padding-bottom: var(--space-4); display: flex; align-items: center; justify-content: space-between;">
        <h1 style="font-size: var(--text-2xl); font-weight: 950; letter-spacing: -0.04em;">CSV Schema Documentation</h1>
        <a href="#/reports" class="btn btn-secondary btn-sm">${getIcon('arrow-left', 14)} Reports</a>
      </header>

      <div style="display: flex; flex-direction: column; gap: var(--space-12);">
        
        <!-- Guidelines Banner (F150) -->
        <div class="card card-raised" style="background: color-mix(in srgb, var(--color-brand) 6%, var(--color-surface)); border-left: 4px solid var(--color-brand); padding: var(--space-4); display: flex; align-items: flex-start; gap: var(--space-4); line-height: 1.6;">
          <div style="color: var(--color-brand); margin-top: var(--space-1);">
            ${getIcon('info', 22)}
          </div>
          <div style="font-size: var(--text-sm); color: var(--color-text);">
            <strong style="color: var(--color-brand); font-weight: 800; font-size: var(--text-base); display: block; margin-bottom: var(--space-1);">Import Guidelines & Limits</strong>
            To guarantee peak performance and prevent transaction overload in your browser's database vault, COMMA enforces a strict safety limit of <strong>150 data rows per CSV import</strong>. If your ledger or platform statement contains more than 150 rows, please split it into separate, smaller CSV files before uploading.
          </div>
        </div>

        <!-- Shifts Section -->
        <article class="card card-raised">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-6);">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div style="background: var(--color-brand); color: white; padding: var(--space-2); border-radius: var(--radius-md);">
                ${getIcon('calendar', 20)}
              </div>
              <h2 style="margin: 0; font-size: var(--text-lg); font-weight: 800;">Shifts Ledger</h2>
            </div>
            <button class="btn btn-secondary btn-xs" data-action="dl-shift-tpl">${getIcon('download', 12)} Template</button>
          </div>
          
          <div style="background: var(--color-surface-raised); padding: var(--space-4); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 11px; margin-bottom: var(--space-6); border: 1px solid var(--color-border); overflow-x: auto;">
            date,platformId,startTime,endTime,grossRevenue,tipsRevenue,bonus,orders,activeMileage,deadMileage,outOfPocketExpense,notes<br>
            2026-05-10,ubereats,17:00,21:30,120.50,15.00,5.00,8,12.5,4.2,25.50,"Evening rush"
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-sm);">
            <thead>
              <tr style="border-bottom: 2px solid var(--color-border); text-align: left; color: var(--color-text-secondary); font-size: 11px; text-transform: uppercase;">
                <th style="padding: var(--space-2);">Field</th>
                <th style="padding: var(--space-2);">Format</th>
                <th style="padding: var(--space-2);">Aliases</th>
                <th style="padding: var(--space-2);">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">date</td>
                <td><code>YYYY-MM-DD</code></td>
                <td>day</td>
                <td>Required. ISO format.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">platformId</td>
                <td><code>String</code></td>
                <td>platform</td>
                <td>lowercase: ubereats, doordash, etc.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">grossRevenue</td>
                <td><code>Number</code></td>
                <td>gross, earnings</td>
                <td>Base pay in dollars.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">activeMileage</td>
                <td><code>Number</code></td>
                <td>distance, distanceKm</td>
                <td>Active delivery distance, stored in KM.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">deadMileage</td>
                <td><code>Number</code></td>
                <td>—</td>
                <td>Unpaid travel distance, stored in KM. Not currently mapped by the import wizard UI.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">outOfPocketExpense</td>
                <td><code>Number</code></td>
                <td>pocket, oop</td>
                <td>Out-of-pocket order cost (deductibility locked at 0%).</td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Expenses Section -->
        <article class="card card-raised">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-6);">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div style="background: var(--color-brand); color: white; padding: var(--space-2); border-radius: var(--radius-md);">
                ${getIcon('receipt', 20)}
              </div>
              <h2 style="margin: 0; font-size: var(--text-lg); font-weight: 800;">Expense Tracker</h2>
            </div>
            <button class="btn btn-secondary btn-xs" data-action="dl-expense-tpl">${getIcon('download', 12)} Template</button>
          </div>
          
          <div style="background: var(--color-surface-raised); padding: var(--space-4); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 11px; margin-bottom: var(--space-6); border: 1px solid var(--color-border); overflow-x: auto;">
            date,category,amount,deductiblePct,hstPaid,isRecurring,notes<br>
            2026-05-12,fuel,45.00,100,5.40,false,"Full tank"
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: var(--text-sm);">
            <thead>
              <tr style="border-bottom: 2px solid var(--color-border); text-align: left; color: var(--color-text-secondary); font-size: 11px; text-transform: uppercase;">
                <th style="padding: var(--space-2);">Field</th>
                <th style="padding: var(--space-2);">Format</th>
                <th style="padding: var(--space-2);">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">category</td>
                <td><code>String</code></td>
                <td>fuel, maintenance, phone, gear, supplies, etc.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">amount</td>
                <td><code>Number</code></td>
                <td>Total dollars spent.</td>
              </tr>
              <tr style="border-bottom: 1px solid var(--color-border);">
                <td style="padding: var(--space-2); font-weight: 700;">deductiblePct</td>
                <td><code>0-100</code></td>
                <td>Tax deductible percentage.</td>
              </tr>
            </tbody>
          </table>
        </article>

        <!-- Reference Tables -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6);">
          <section class="card" style="padding: var(--space-4);">
            <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: var(--color-text-secondary); margin-bottom: var(--space-3);">Valid Platform IDs</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; font-family: var(--font-mono); font-size: 10px;">
              ${['ubereats', 'doordash', 'instacart', 'amazonflex', 'skip', 'foodora', 'other'].map(p => `<span style="background:var(--color-surface-raised); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border);">${p}</span>`).join('')}
            </div>
          </section>
          <section class="card" style="padding: var(--space-4);">
            <h3 style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: var(--color-text-secondary); margin-bottom: var(--space-3);">Expense Categories</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; font-family: var(--font-mono); font-size: 10px;">
              ${['fuel', 'maintenance', 'insurance', 'phone', 'data_plan', 'supplies', 'accounting', 'other'].map(c => `<span style="background:var(--color-surface-raised); padding:2px 6px; border-radius:4px; border:1px solid var(--color-border);">${c}</span>`).join('')}
            </div>
          </section>
        </div>

      </div>

      <footer style="margin-top: var(--space-12); text-align: center; border-top: 1px solid var(--color-border); padding-top: var(--space-6); color: var(--color-text-secondary); font-size: var(--text-xs);">
        All currency values are stored as real decimal dollars. Always use decimal dollars (not cents) in CSV files.
      </footer>
    </section>
  `;

  root.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest('[data-action]') : null;
    if (!target) return;
    const action = target.getAttribute('data-action');
    
    if (action === 'dl-shift-tpl') {
      const csv = 'date,platformId,startTime,endTime,grossRevenue,tipsRevenue,bonus,orders,activeMileage,deadMileage,outOfPocketExpense,notes\\n2026-05-10,ubereats,17:00,21:30,120.50,15.00,5.00,8,12.5,4.2,25.50,"Morning"';
      downloadCsv('comma_shifts.csv', csv.replace(/\\\\n/g, '\\n'));
    }
    if (action === 'dl-expense-tpl') {
      const csv = 'date,category,amount,deductiblePct,hstPaid,isRecurring,notes\\n2026-05-12,fuel,45.00,100,5.40,false,"Tank"';
      downloadCsv('comma_expenses.csv', csv.replace(/\\\\n/g, '\\n'));
    }
  });
}
