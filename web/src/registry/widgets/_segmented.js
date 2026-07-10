import { esc } from './esc.js';

const KEY_PREFIX = 'comma-widget-seg-';

function loadSeg(id, fallback) {
  try {
    return sessionStorage.getItem(KEY_PREFIX + id) || fallback;
  } catch {
    return fallback;
  }
}

function saveSeg(id, key) {
  try {
    sessionStorage.setItem(KEY_PREFIX + id, key);
  } catch {
    // sessionStorage unavailable (private mode, etc.) — tab selection just won't persist.
  }
}

/**
 * Wraps several existing widget definitions behind one segmented control so
 * they render as a single card instead of one card each. Each inner widget's
 * `render`/`afterRender` run completely unmodified — `afterRenderWidgets()`
 * already recurses into every nested `[data-widget-id]`, so hidden panes get
 * their own afterRender (canvas draws, count-up animations, ...) for free.
 * @param {{ id: string, label: string, category: string, defaultVisible?: boolean, segments: { label: string, widget: any }[] }} opts
 */
export function createSegmentedWidget({ id, label, category, defaultVisible = false, segments }) {
  return {
    id,
    label,
    defaultSize: '1x1',
    defaultVisible,
    category,

    render: async (ctx) => {
      const fallbackKey = segments[0].widget.id;
      const stored = loadSeg(id, fallbackKey);
      const activeKey = segments.some((s) => s.widget.id === stored) ? stored : fallbackKey;

      const panes = await Promise.all(segments.map(async (s) => {
        const html = await s.widget.render(ctx);
        const isActive = s.widget.id === activeKey;
        return `<div class="wseg-pane${isActive ? ' is-active' : ''}" data-seg-pane="${esc(s.widget.id)}" data-widget-id="${esc(s.widget.id)}">${html}</div>`;
      }));

      const tabs = segments.map((s) => `
        <button type="button" class="wseg-tab${s.widget.id === activeKey ? ' is-active' : ''}" data-seg-tab="${esc(s.widget.id)}">${esc(s.label)}</button>
      `).join('');

      return `
        <div class="wseg-wrap">
          <div class="wseg-title">${esc(label)}</div>
          <div class="wseg-tabs" role="tablist">${tabs}</div>
          <div class="wseg-panes">${panes.join('')}</div>
        </div>
      `;
    },

    afterRender: (el, _ctx) => {
      const wrap = el.querySelector('.wseg-wrap');
      if (!wrap) return;

      wrap.addEventListener('click', (ev) => {
        const target = /** @type {HTMLElement} */ (ev.target);
        const btn = target.closest('[data-seg-tab]');
        if (!btn || !wrap.contains(btn)) return;
        const key = btn.getAttribute('data-seg-tab');
        if (!key) return;

        wrap.querySelectorAll('[data-seg-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
        wrap.querySelectorAll('[data-seg-pane]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-seg-pane') === key);
        });

        saveSeg(id, key);
      });
    },

    destroy: (el) => {
      for (const s of segments) {
        if (typeof s.widget.destroy === 'function') {
          try { s.widget.destroy(el); } catch { /* best-effort teardown */ }
        }
      }
    },
  };
}
