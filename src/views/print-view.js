function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPrintPlatformBreakdown(report) {
  const shifts = Array.isArray(report?.shifts) ? report.shifts : [];
  if (!shifts.length) return '<p>No shifts logged in this period.</p>';

  const map = new Map();

  for (const s of shifts) {
    const pId = s.platformId || 'unknown';
    if (!map.has(pId)) {
      map.set(pId, {
        platformId: pId,
        gross: 0,
        tips: 0,
        bonus: 0,
        clockMinutes: 0,
        activeMinutes: 0,
        orders: 0,
      });
    }
    const data = map.get(pId);
    const durationMin = s.durationSeconds != null ? Math.round(Number(s.durationSeconds) / 60) : undefined;
    data.gross += Number(s.grossRevenue || 0);
    data.tips += Number(s.tipsRevenue || 0);
    data.bonus += Number(s.customFields?.bonusAmount) || 0;
    data.clockMinutes += Number(durationMin ?? s.onlineMinutes ?? s.activeMinutes ?? 0);
    data.activeMinutes += Number(s.activeMinutes ?? durationMin ?? s.onlineMinutes ?? 0);
    data.orders += Number(s.deliveryCount ?? 0);
  }

  let html = `
    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:10px;">
      <thead>
        <tr style="border-bottom:1px solid #ccc; text-align:left;">
          <th style="padding:6px 0;">Platform</th>
          <th style="padding:6px 0; text-align:right;">Gross</th>
          <th style="padding:6px 0; text-align:right;">Tips</th>
          <th style="padding:6px 0; text-align:right;">Total</th>
          <th style="padding:6px 0; text-align:right;">Clock Hours</th>
          <th style="padding:6px 0; text-align:right;">Active Hours</th>
          <th style="padding:6px 0; text-align:right;">Orders</th>
          <th style="padding:6px 0; text-align:right;">Clock Hourly</th>
          <th style="padding:6px 0; text-align:right;">Active Hourly</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const p of map.values()) {
    const total = p.gross + p.tips + p.bonus;
    const clockHours = p.clockMinutes > 0 ? p.clockMinutes / 60 : 0;
    const activeHours = p.activeMinutes > 0 ? p.activeMinutes / 60 : 0;
    const hourly = clockHours > 0 ? p.gross / clockHours : 0;
    const activeHourly = activeHours > 0 ? p.gross / activeHours : 0;

    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:6px 0; text-transform:capitalize; font-weight:bold;">${esc(p.platformId)}</td>
        <td style="padding:6px 0; text-align:right;">$${p.gross.toFixed(2)}</td>
        <td style="padding:6px 0; text-align:right;">$${p.tips.toFixed(2)}</td>
        <td style="padding:6px 0; text-align:right; font-weight:bold;">$${total.toFixed(2)}</td>
        <td style="padding:6px 0; text-align:right;">${clockHours.toFixed(1)}h</td>
        <td style="padding:6px 0; text-align:right;">${activeHours.toFixed(1)}h</td>
        <td style="padding:6px 0; text-align:right;">${p.orders}</td>
        <td style="padding:6px 0; text-align:right;">$${hourly.toFixed(2)}/hr</td>
        <td style="padding:6px 0; text-align:right;">$${activeHourly.toFixed(2)}/hr</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;
  return html;
}

/** @param {HTMLElement} root @param {Record<string, unknown>} ctx */
export function render(root, ctx) {
  const container = document.createElement('div');
  container.className = 'print-view-container';
  root.appendChild(container);

  void ctx;
  let payload = null;
  try {
    payload = JSON.parse(sessionStorage.getItem('comma_print_payload') || 'null');
  } catch {
    payload = null;
  }

  if (!payload?.report) {
    container.innerHTML = `
      <section class="card card-raised">
        <h1>Print report</h1>
        <p style="margin-top:var(--space-2);color:var(--color-text-secondary);">
          No report payload found. Open reports and choose "Open print view".
        </p>
      </section>
    `;
    return;
  }

  const template = payload.template?.sections || {};
  const report = payload.report;
  const summary = report.summary || {};
  container.innerHTML = `
    <section class="print-view">
      <header class="card card-raised">
        <h1>Printable report</h1>
        <p>${esc(report.startDate)} to ${esc(report.endDate)}</p>
      </header>
      ${
        template.overview !== false
          ? `<section class="card" style="margin-top:var(--space-3);">
              <h2>Overview</h2>
              <p>Gross: <strong>${esc(Number(summary.gross || 0).toFixed(2))}</strong></p>
              <p>Expenses: <strong>${esc(Number(summary.expenseTotal || 0).toFixed(2))}</strong></p>
              <p>Net: <strong>${esc(Number(summary.net || 0).toFixed(2))}</strong></p>
              <p>Shifts: <strong>${esc(summary.shiftCount || 0)}</strong></p>
            </section>`
          : ''
      }
      ${
        template.platform_breakdown
          ? `<section class="card" style="margin-top:var(--space-3);">
              <h2>Platform Breakdown</h2>
              ${renderPrintPlatformBreakdown(report)}
            </section>`
          : ''
      }
      ${
        template.notes
          ? `<section class="card" style="margin-top:var(--space-3);">
              <h2>Notes</h2>
              <pre style="white-space:pre-wrap;">${esc(payload.summaryText || '')}</pre>
            </section>`
          : ''
      }
      <style>
        @media print {
          .print-controls { display: none !important; }
          .print-view { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
          .print-view h1 { font-size: 24pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 4px; }
          .print-view h2 { font-size: 18pt; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 24px; }
          .print-view .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin-top: 16px !important; }
          .print-view table th { background-color: #f5f5f5 !important; border-bottom: 2px solid #ccc !important; }
          .print-view table td { border-bottom: 1px solid #eee !important; }
          .print-view p { font-size: 12pt; line-height: 1.5; margin: 8px 0; }
        }
      </style>
      <section class="card print-controls" style="margin-top:var(--space-3); border: 2px solid var(--color-brand); background: var(--color-bg-secondary);">
        <h2 style="margin-top:0;">Ready to print</h2>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">The print dialog should open automatically. If not, click the button below.</p>
        <div style="display:flex; gap: var(--space-2);">
          <button class="btn btn-primary" type="button" data-action="print">Print now</button>
          <button class="btn btn-secondary" type="button" data-action="close">Close window</button>
        </div>
      </section>
    </section>
  `;

  container.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target.closest('[data-action]') : null;
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'print') {
      window.print();
    }
    if (action === 'close') {
      window.close();
    }
  });

  // Auto-trigger print after render
  setTimeout(() => {
    window.print();
  }, 500);
}
