'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { DriversSummary } from '../../types/drivers';

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, BarElement,
  LineController, PointElement, LineElement,
  Tooltip, Legend,
);

const LEGEND = [
  { color: '#22c55e', label: 'Joined', shape: 'bar' as const },
  { color: '#ef4444', label: 'Left', shape: 'bar' as const },
  { color: '#3b82f6', label: 'Active headcount', shape: 'line' as const },
];

export default function DriversMovementChart({
  summary,
  source,
}: {
  summary: DriversSummary;
  source: 'live' | 'sample';
}) {
  const data = summary.movement;
  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
        No start/leave dates available to build movement
      </div>
    );
  }

  const labels = data.map(d => d.month.replace(/ 20\d{2}$/, ''));
  const firstHc = data[0].headcount;
  const lastHc = data[data.length - 1].headcount;
  const net = lastHc - firstHc;

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Joined',
        data: data.map(d => d.onboarded),
        backgroundColor: 'rgba(34,197,94,0.85)',
        borderRadius: 4,
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Left',
        data: data.map(d => -d.departed),
        backgroundColor: 'rgba(239,68,68,0.8)',
        borderRadius: 4,
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Active headcount',
        data: data.map(d => d.headcount),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderWidth: 2.5,
        pointRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2,
        tension: 0.3,
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar' | 'line'>) => {
            const v = ctx.parsed.y ?? 0;
            if (ctx.dataset.label === 'Left') return ` Left: ${Math.abs(v)}`;
            return ` ${ctx.dataset.label}: ${v}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (v: string | number) => (typeof v === 'number' && v < 0 ? '' : String(v)),
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Workforce Movement</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            joined vs left vs active headcount
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {source === 'sample' && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              background: '#fff7ed', color: '#c2410c',
              border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 10px',
            }}>SAMPLE</div>
          )}
          <div style={{
            fontSize: 11, fontWeight: 600,
            background: net >= 0 ? '#f0fdf4' : '#fef2f2',
            color: net >= 0 ? '#15803d' : '#dc2626',
            border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {net >= 0 ? '▲' : '▼'} Net {Math.abs(net)} drivers
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {LEGEND.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.shape === 'bar' ? (
              <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            ) : (
              <div style={{ width: 18, height: 2, background: item.color, borderRadius: 1 }} />
            )}
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 180 }}>
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}
