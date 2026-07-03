import { formatCurrency } from '../../utils/formatters.js';
import { t } from '../../utils/strings.js';
import { esc } from './esc.js';
import { calcTaxSetAside } from '../../utils/calculations.js';

const _IC_JAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5"></path><path d="M5 12a7 7 0 0 0 14 0"></path><path d="M12 7v5"></path><rect x="8" y="2" width="8" height="3" rx="1"></rect></svg>`;

export default {
  id: 'taxJar',
  label: 'Tax Jar',
  defaultSize: '1x1',
  defaultVisible: true,
  category: 'financial',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const c = /** @type {{ data?: { financial?: { gross?: number, expense?: number } }; taxRatePct?: number; localeCountry?: string; currency?: string }} */ (ctx);

    const gross = Number(c?.data?.financial?.gross || 0);
    const expense = Number(c?.data?.financial?.expense || 0);
    const net = Math.max(0, gross - expense);

    // Real configured withholding rate (same source the Dashboard's Tax
    // Set-Aside KPI card uses) rather than a hardcoded guess.
    const taxRate = Number(c?.taxRatePct) || 0;
    const estimatedTax = calcTaxSetAside(gross, taxRate);
    const postTax = net - estimatedTax;

    const country = String(c?.localeCountry || 'US');
    const currency = String(c?.currency || 'USD');

    const fmtTax = formatCurrency(estimatedTax, country, { currency });
    const fmtPostTax = formatCurrency(postTax, country, { currency });

    const scopedStyles = `
      <style>
        @keyframes jarFill {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes jarLiquid {
          0%, 100% { transform: translateY(0) scaleY(1); }
          50% { transform: translateY(-2px) scaleY(1.02); }
        }

        .tj-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: space-between;
          padding: 4px;
        }

        .tj-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tj-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
          color: var(--color-warning, #f59e0b);
        }

        .tj-body {
          margin-top: 8px;
        }

        .tj-val {
          font-size: 1.8rem;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--color-text-main);
          font-variant-numeric: tabular-nums;
        }

        .tj-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 2px;
        }

        .tj-viz {
          position: relative;
          height: 40px;
          width: 100%;
          background: var(--color-surface-raised);
          border-radius: 8px;
          overflow: hidden;
          margin-top: auto;
          display: flex;
          align-items: flex-end;
        }

        .tj-fill {
          width: 100%;
          height: ${Math.min(100, (estimatedTax / (gross || 1)) * 300)}%; /* Scale visually */
          background: linear-gradient(to top, var(--color-warning), color-mix(in srgb, var(--color-warning) 70%, white));
          transform-origin: bottom;
          animation: jarFill 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .tj-post-tax {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--color-success);
          margin-top: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tj-post-tax-val { font-weight: 800; font-variant-numeric: tabular-nums; }
      </style>
    `;

    return `
      ${scopedStyles}
      <div class="tj-container">
        <div class="tj-header">
          <div class="tj-icon-wrap">${_IC_JAR}</div>
          <span class="stat-label">Tax Jar</span>
        </div>

        <div class="tj-body">
          <div class="tj-val">${esc(fmtTax)}</div>
          <div class="tj-label">Estimated Set-Aside (${esc(String(taxRate))}%)</div>
        </div>

        <div class="tj-viz">
          <div class="tj-fill"></div>
        </div>

        <div class="tj-post-tax">
          <span>Net After Tax</span>
          <span class="tj-post-tax-val">${esc(fmtPostTax)}</span>
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
