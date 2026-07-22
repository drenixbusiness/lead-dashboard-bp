'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { DriversSummary } from '../../types/drivers';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Legend);

export default function DriversTenureChart({
  summary,
  source,
}: {
  summary: DriversSummary;
  source: 'live' | 'sample';
}) {
  const buckets = summary.buckets;
  const total = summary.total || 1;
  const dominant = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  const chartData = {
    labels: buckets.map(b => b.label),
    datasets: [{
      label: 'Drivers',
      data: buckets.map(b => b.count),
      backgroundColor: buckets.map(b => b.color),
      borderRadius: 6,
      borderSkipped: false as const,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const n = ctx.parsed.y ?? 0;
            return ` ${n} drivers (${((n / total) * 100).toFixed(0)}%)`;
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
        ticks: { color: '#94a3b8', font: { size: 11 }, stepSize: 5 },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Tenure Distribution</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            how many weeks each driver has been with us
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
            background: '#eef2ff', color: '#4338ca',
            border: '1px solid #c7d2fe', borderRadius: 20, padding: '3px 10px',
          }}>
            {summary.total} tracked
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length},1fr)`, gap: 8 }}>
        {buckets.map(b => (
          <div key={b.label} style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: '8px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#4338ca', lineHeight: 1 }}>{b.count}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{b.label}</div>
            <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>
              {((b.count / total) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 160 }}>
        <Bar data={chartData} options={options} />
      </div>

      {dominant && (
        <div style={{
          background: '#eef2ff', border: '1px solid #c7d2fe',
          borderRadius: 8, padding: '8px 12px',
          fontSize: 11, color: '#4338ca', lineHeight: 1.5,
        }}>
          <strong>{dominant.label}</strong> is the largest group ({dominant.count} drivers, {((dominant.count / total) * 100).toFixed(0)}% of total).
        </div>
      )}
    </div>
  );
}
