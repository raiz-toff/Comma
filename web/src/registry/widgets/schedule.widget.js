import { t } from '../../utils/strings.js';
import { esc } from './esc.js';
import { getAppState } from '../../core/db.js';

const _IC_CAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;

export default {
  id: 'schedule',
  label: 'Schedule',
  defaultSize: '1x1',
  defaultVisible: false,
  category: 'analytics',

  /** @param {unknown} ctx */
  render: async (ctx) => {
    const planningRaw = await getAppState('schedule_planning_shifts');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const upcoming = Array.isArray(planningRaw) 
      ? planningRaw
          .filter(p => p.date >= todayStr)
          .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`))
          .slice(0, 3)
      : [];

    const scopedStyles = `
      <style>
        .sch-container { display: flex; flex-direction: column; height: 100%; gap: 10px; padding: 2px; }
        .sch-list { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow: hidden; }
        .sch-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          border-radius: 8px;
          background: var(--color-surface-raised);
          font-size: 0.75rem;
        }
        .sch-date-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          padding: 4px;
          border-radius: 6px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
        }
        .sch-day-num { font-size: 0.85rem; font-weight: 800; color: var(--color-text-main); line-height: 1; }
        .sch-day-name { font-size: 0.55rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; }
        
        .sch-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sch-time { font-weight: 800; color: var(--color-text-main); }
        .sch-platform { font-size: 0.65rem; color: var(--color-text-muted); font-weight: 700; text-transform: capitalize; }
        
        .sch-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; text-align: center; gap: 8px;
          opacity: 0.6; padding: 0 10px;
        }
        .sch-empty-text { font-size: 0.7rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .sch-empty-cta { font-size: 0.65rem; font-weight: 600; color: var(--color-brand); text-decoration: underline; }
      </style>
    `;

    if (!upcoming.length) {
      return `
        ${scopedStyles}
        <div class="wr">
          <div class="wh">
            <div class="wi">${_IC_CAL}</div>
            <span class="wl">Schedule</span>
          </div>
          <div class="sch-empty">
            <span class="sch-empty-text">No upcoming plans</span>
            <a href="#/schedule" class="sch-empty-cta">Plan a shift</a>
          </div>
        </div>
      `;
    }

    const listItems = upcoming.map(p => {
      const d = new Date(`${p.date}T12:00:00`);
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNum = d.getDate();
      const color = `var(--color-${p.platformId}, var(--color-other))`;

      return `
        <div class="sch-item">
          <div class="sch-date-box" style="border-left: 3px solid ${color};">
            <span class="sch-day-num">${dayNum}</span>
            <span class="sch-day-name">${esc(dayName)}</span>
          </div>
          <div class="sch-info">
            <span class="sch-time">${esc(p.startTime)} – ${esc(p.endTime)}</span>
            <span class="sch-platform">${esc(p.platformId)}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      ${scopedStyles}
      <div class="wr">
        <div class="wh" style="margin-bottom: 8px;">
          <div class="wi">${_IC_CAL}</div>
          <span class="wl">Schedule</span>
          <span class="wb">Upcoming</span>
        </div>
        <div class="sch-list">
          ${listItems}
        </div>
      </div>
    `;
  },

  afterRender: (_el, _ctx) => {},
  destroy: (_el) => {},
};
