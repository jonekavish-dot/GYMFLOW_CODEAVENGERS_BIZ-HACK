// Chart.js on demand, with the portal's palette baked into the defaults so every
// chart matches the dark UI without repeating options at each call site.
let ready;

export async function chartLib() {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
      s.onload = () => {
        const { Chart } = window;
        Chart.defaults.color = '#8b98a5';
        Chart.defaults.font.family = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        Chart.defaults.font.size = 11;
        Chart.defaults.plugins.legend.labels.boxWidth = 12;
        Chart.defaults.maintainAspectRatio = false;
        resolve(Chart);
      };
      s.onerror = () => reject(new Error('Could not load Chart.js — check your connection.'));
      document.head.append(s);
    });
  }
  return ready;
}

export const PALETTE = ['#39e56a', '#4da6ff', '#f5a623', '#c084fc', '#e56339', '#4dd0e1', '#e5d439'];

const GRID = { color: 'rgba(255,255,255,.06)' };

/** Creates or updates a chart in place — safe to call from a live listener. */
export function paint(store, key, canvas, config) {
  const existing = store.get(key);
  if (existing) {
    existing.data = config.data;
    existing.update();
    return existing;
  }
  const chart = new store.Chart(canvas, {
    ...config,
    options: {
      ...config.options,
      scales: config.type === 'doughnut' ? undefined : {
        x: { grid: { display: false }, ...config.options?.scales?.x },
        y: { grid: GRID, beginAtZero: true, ...config.options?.scales?.y },
      },
    },
  });
  store.set(key, chart);
  return chart;
}

/** A small registry so a view can repaint its charts without leaking instances. */
export async function chartStore() {
  const Chart = await chartLib();
  const map = new Map();
  return {
    Chart,
    get: (k) => map.get(k),
    set: (k, v) => map.set(k, v),
    destroyAll() { map.forEach((c) => c.destroy()); map.clear(); },
  };
}
