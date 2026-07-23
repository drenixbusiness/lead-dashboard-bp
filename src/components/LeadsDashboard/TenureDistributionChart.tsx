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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import type { DriverRecord } from '../../types/roster';
import { calcDriverTenureWeeks } from '../../utils/tenure';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Legend);

const BUCKET_DEFS = [
  { label: '1–4 wks',   min: 0,  max: 4,  color: 'rgba(99,102,241,0.55)' },
  { label: '5–8 wks',   min: 5,  max: 8,  color: 'rgba(99,102,241,0.7)'  },
  { label: '9–16 wks',  min: 9,  max: 16, color: 'rgba(99,102,241,0.85)' },
  { label: '17–24 wks', min: 17, max: 24, color: 'rgba(67,56,202,0.9)'   },
  { label: '25+ wks',   min: 25, max: null as number | null, color: 'rgba(49,46,129,0.95)' },
];

export default function TenureDistributionChart({
  drivers,
  title = 'Tenure Distribution',
  subtitle = 'weeks since hire · active → today · left → termination date',
}: {
  drivers: DriverRecord[];
  title?: string;
  subtitle?: string;
}) {
  const weeks = drivers
    .map(d => calcDriverTenureWeeks(d))
    .filter((w): w is number => w !== null);
  const buckets = BUCKET_DEFS.map(b => ({
    ...b,
    count: weeks.filter(w => (b.max == null ? w >= b.min : w >= b.min && w <= b.max)).length,
  }));
  const total = weeks.length || 1;
  const dominant = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);

  if (weeks.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
        No tenure data yet
      </div>
    );
  }

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
    layout: { padding: { top: 16 } },
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
      datalabels: {
        display: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          return typeof v === 'number' && v > 0;
        },
        formatter: (value: number) => String(value),
        color: '#312e81',
        font: { size: 11, weight: 'bold' as const },
        anchor: 'end' as const,
        align: 'top' as const,
        offset: 2,
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          background: '#eef2ff', color: '#4338ca',
          border: '1px solid #c7d2fe', borderRadius: 20, padding: '3px 10px',
        }}>
          {weeks.length} total tracked
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

      <div style={{ flex: 1, minHeight: 0 }}>
        <Bar data={chartData} options={options as never} plugins={[ChartDataLabels] as never} />
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
