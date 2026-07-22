'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { DriversSummary } from '../../types/drivers';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DriversStatusChart({ summary }: { summary: DriversSummary }) {
  const total = summary.total || 1;
  const chartData = {
    labels: ['Active', 'Left'],
    datasets: [{
      data: [summary.active, summary.left],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => {
            const n = Number(ctx.raw ?? 0);
            return ` ${ctx.label}: ${n} (${((n / total) * 100).toFixed(0)}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Active vs Left</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>current retention split</div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, minHeight: 0 }}>
        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
          <Doughnut data={chartData} options={options} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{summary.total}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>drivers</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {[
            { label: 'Active', value: summary.active, color: '#22c55e', bg: '#f0fdf4' },
            { label: 'Left', value: summary.left, color: '#ef4444', bg: '#fef2f2' },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg, borderRadius: 8, padding: '10px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {((item.value / total) * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          ))}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '10px 12px', display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Avg tenure</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{summary.avgWeeks} wks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
