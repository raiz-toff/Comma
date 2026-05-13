import {
  renderBarChart,
  renderDonutChart,
  renderGitHubHeatmap,
  renderLineChart,
  renderScatterChart,
} from '../../ui/charts.js';
import { t } from '../../utils/strings.js';

function moneyTick(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (abs < 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(0)}`;
}

export function renderHourlyTrendChart(canvas, labels, values) {
  return renderLineChart(canvas, {
    labels,
    datasets: [
      {
        label: t('analytics.hourlyRate'),
        data: values,
        borderColor: 'var(--color-brand)',
        backgroundColor: 'color-mix(in srgb, var(--color-brand) 22%, transparent)',
        fill: true,
      },
    ],
  });
}

export function renderWeekComparisonChart(canvas, thisWeek, lastWeek) {
  return renderBarChart(canvas, {
    labels: [t('analytics.lastPeriod'), t('analytics.thisPeriod')],
    datasets: [
      {
        label: t('analytics.earnings'),
        data: [lastWeek, thisWeek],
        backgroundColor: ['var(--color-surface-raised)', 'var(--color-brand)'],
      },
    ],
  });
}

export function renderIncomeSourceChart(canvas, breakdown) {
  return renderDonutChart(canvas, {
    labels: [t('analytics.baseIncome'), t('analytics.tips'), t('analytics.bonus')],
    datasets: [
      {
        data: [breakdown.base || 0, breakdown.tips || 0, breakdown.bonus || 0],
        backgroundColor: ['var(--color-brand)', 'var(--color-info)', 'var(--color-success)'],
        borderWidth: 0,
      },
    ],
  });
}

export function renderYtdCumulativeChart(canvas, labels, values) {
  return renderLineChart(
    canvas,
    {
      labels,
      datasets: [
        {
          label: 'YTD',
          data: values,
          borderColor: 'var(--color-success)',
          backgroundColor: 'color-mix(in srgb, var(--color-success) 22%, transparent)',
          fill: true,
          pointRadius: 0,
        },
      ],
    },
    {
      scales: {
        x: {
          ticks: {
            callback: (_v, idx) => {
              if (idx % 30 !== 0) return '';
              return String(labels[idx] || '').slice(5);
            },
          },
        },
        y: { ticks: { callback: moneyTick } },
      },
    },
  );
}

export function renderEarningsVsHoursChart(canvas, points) {
  return renderScatterChart(
    canvas,
    {
      datasets: [
        {
          label: t('analytics.earningsVsHours'),
          data: points,
          backgroundColor: 'var(--color-brand)',
        },
      ],
    },
    {
      scales: {
        x: { title: { display: true, text: 'Hours' } },
        y: {
          title: { display: true, text: t('analytics.earnings') },
          ticks: { callback: moneyTick },
        },
      },
    },
  );
}

export function renderEarningsHeatmap(container, points) {
  return renderGitHubHeatmap(container, points, { label: t('analytics.heatmap') });
}
