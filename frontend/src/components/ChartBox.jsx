import { useEffect, useRef } from 'react';
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Legend, LinearScale, Tooltip,
} from 'chart.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, Tooltip);
Chart.defaults.color = '#8b98a5';
Chart.defaults.font.family = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.maintainAspectRatio = false;

export const PALETTE = ['#39e56a', '#4da6ff', '#f5a623', '#c084fc', '#e56339', '#4dd0e1', '#e5d439'];

function buildOptions(type, { stacked = false, legend = true } = {}) {
  if (type === 'doughnut') return { plugins: { legend: { display: legend } } };
  return {
    plugins: { legend: { display: legend } },
    scales: {
      x: { grid: { display: false }, stacked },
      y: { grid: { color: 'rgba(255,255,255,.06)' }, beginAtZero: true, stacked, ticks: { precision: 0 } },
    },
  };
}

/** Thin Chart.js wrapper: creates once, then updates in place when `data` changes. */
export function ChartBox({ type, data, stacked, legend }) {
  const canvas = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    chart.current = new Chart(canvas.current, { type, data, options: buildOptions(type, { stacked, legend }) });
    return () => { chart.current?.destroy(); chart.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, stacked, legend]);

  useEffect(() => {
    if (!chart.current) return;
    chart.current.data = data;
    chart.current.update();
  }, [data]);

  return <div className="chart-box"><canvas ref={canvas} /></div>;
}
