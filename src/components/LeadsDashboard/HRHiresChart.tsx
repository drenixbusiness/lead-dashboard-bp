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
import type { HRMonthData } from '../../types/hr';

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, BarElement,
  LineController, PointElement, LineElement,
  Tooltip, Legend,
);

const HR_COLORS: Record<string, { bar: string; light: string }> = {
  Fred:    { bar: '#22c55e', light: 'rgba(34,197,94,0.12)'  },
  Alex:    { bar: '#3b82f6', light: 'rgba(59,130,246,0.12)' },
  Ethan:   { bar: '#a855f7', light: 'rgba(168,85,247,0.12)' },
  Jesicaa: { bar: '#f59e0b', light: 'rgba(245,158,11,0.12)' },
  Nick:    { bar: '#ec4899', light: 'rgba(236,72,153,0.12)' },
  Michael: { bar: '#06b6d4', light: 'rgba(6,182,212,0.12)'  },
};
const DEFAULT_COLOR = { bar: '#94a3b8', light: 'rgba(148,163,184,0.12)' };

function getColor(hr: string) {
  return HR_COLORS[hr] ?? DEFAULT_COLOR;
}

export default function HRHiresChart({ data }: { data: HRMonthData[] }) {
  if (data.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:13 }}>
      No HR data available
    </div>
  );

  const hrTotals: Record<string, number> = {};
  for (const m of data) {
    for (const [hr, n] of Object.entries(m.hires)) {
      hrTotals[hr] = (hrTotals[hr] ?? 0) + n;
    }
  }
  const hrs = Object.entries(hrTotals).sort((a, b) => b[1] - a[1]).map(([hr]) => hr);

  const labels     = data.map(d => d.month.replace(/ 20\d{2}$/, ''));
  const totals     = data.map(d => d.total);
  const grandTotal = totals.reduce((s, v) => s + v, 0);
  const rangeLabel = labels.length > 0
    ? `${labels[0]}–${labels[labels.length - 1]} 2026`
    : '2026';

  const datasets = [
    ...hrs.map(hr => ({
      type:            'bar' as const,
      label:           hr,
      data:            data.map(d => d.hires[hr] ?? 0),
      backgroundColor: getColor(hr).bar,
      borderRadius:    4,
      stack:           'hires',
      order:           2,
    })),
    {
      type:                 'line' as const,
      label:                'Monthly Total',
      data:                 totals,
      borderColor:          '#0f172a',
      backgroundColor:      'rgba(15,23,42,0.06)',
      borderWidth:          2.5,
      pointRadius:          5,
      pointBackgroundColor: '#fff',
      pointBorderColor:     '#0f172a',
      pointBorderWidth:     2,
      tension:              0.3,
      fill:                 false,
      stack:                undefined,
      order:                1,
    },
  ];

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction:         { mode: 'index' as const, intersect: false },
    plugins: {
      legend:  { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar' | 'line'>) =>
            ` ${ctx.dataset.label}: ${ctx.parsed.y ?? 0}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid:   { display: false },
        ticks:  { color: '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        stacked: true,
        grid:   { color: 'rgba(0,0,0,0.04)' },
        ticks:  { color: '#94a3b8', font: { size: 11 }, stepSize: 5 },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Hires by HR Rep — Monthly</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
            Who hired how many drivers each month · {rangeLabel}
          </div>
        </div>
        <div style={{
          fontSize:11, fontWeight:600,
          background:'#f0fdf4', color:'#15803d',
          border:'1px solid #bbf7d0',
          borderRadius:20, padding:'3px 10px',
        }}>
          {grandTotal} total hires
        </div>
      </div>

      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        {hrs.map(hr => (
          <div key={hr} style={{
            display:'flex', alignItems:'center', gap:6,
            background:'#f8fafc', border:'1px solid #e2e8f0',
            borderRadius:20, padding:'4px 10px',
          }}>
            <div style={{ width:10, height:10, borderRadius:2, background:getColor(hr).bar, flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{hr}</span>
            <span style={{ fontSize:11, color:'#94a3b8' }}>{hrTotals[hr]}</span>
          </div>
        ))}
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          background:'#f8fafc', border:'1px solid #e2e8f0',
          borderRadius:20, padding:'4px 10px',
        }}>
          <div style={{ width:18, height:2, background:'#0f172a', borderRadius:1, flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>Monthly Total</span>
        </div>
      </div>

      <div style={{ height:260, minHeight:260, position:'relative' }}>
        <Chart type="bar" data={{ labels, datasets }} options={options} />
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${Math.min(hrs.length, 6)}, minmax(0, 1fr))`,
        gap:8,
      }}>
        {hrs.map((hr, rank) => (
          <div key={hr} style={{
            background: getColor(hr).light,
            border:`1px solid ${getColor(hr).bar}33`,
            borderRadius:8, padding:'8px 10px', textAlign:'center',
          }}>
            <div style={{ fontSize:9, fontWeight:700, color:getColor(hr).bar, letterSpacing:'0.06em', marginBottom:2 }}>
              #{rank + 1}
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:getColor(hr).bar, lineHeight:1 }}>
              {hrTotals[hr]}
            </div>
            <div style={{ fontSize:10, fontWeight:600, color:'#374151', marginTop:2 }}>{hr}</div>
            <div style={{ fontSize:9, color:'#94a3b8', marginTop:1 }}>
              {grandTotal > 0 ? Math.round((hrTotals[hr] / grandTotal) * 100) : 0}% of total
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX:'auto', borderRadius:10, border:'1px solid #e2e8f0' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:700, color:'#374151', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>
                HR Rep
              </th>
              {data.map(m => (
                <th key={m.month} style={{ padding:'8px 10px', textAlign:'center', fontWeight:600, color:'#64748b', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>
                  {m.month.replace(/ 20\d{2}$/, '')}
                </th>
              ))}
              <th style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'#0f172a', borderBottom:'1px solid #e2e8f0', background:'#ecfdf5' }}>
                Total
              </th>
              <th style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'#0f172a', borderBottom:'1px solid #e2e8f0', background:'#ecfdf5' }}>
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {hrs.map((hr, i) => {
              const share = grandTotal > 0 ? Math.round((hrTotals[hr] / grandTotal) * 100) : 0;
              return (
                <tr key={hr} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, borderRadius:2, background:getColor(hr).bar, flexShrink:0 }} />
                      <span style={{ fontWeight:600, color:'#374151' }}>{hr}</span>
                      <span style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>#{i + 1}</span>
                    </div>
                  </td>
                  {data.map(m => {
                    const n = m.hires[hr] ?? 0;
                    return (
                      <td key={m.month} style={{ padding:'7px 10px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>
                        {n > 0
                          ? <span style={{ fontWeight:600, color:getColor(hr).bar }}>{n}</span>
                          : <span style={{ color:'#cbd5e1' }}>—</span>
                        }
                      </td>
                    );
                  })}
                  <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:800, color:getColor(hr).bar, borderBottom:'1px solid #f1f5f9', background:'#f0fdf4' }}>
                    {hrTotals[hr]}
                  </td>
                  <td style={{ padding:'7px 12px', textAlign:'center', fontWeight:700, color:'#64748b', borderBottom:'1px solid #f1f5f9', background:'#f0fdf4' }}>
                    {share}%
                  </td>
                </tr>
              );
            })}
            <tr style={{ background:'#f1f5f9' }}>
              <td style={{ padding:'8px 12px', fontWeight:700, color:'#0f172a' }}>Monthly Total</td>
              {data.map(m => (
                <td key={m.month} style={{ padding:'8px 10px', textAlign:'center', fontWeight:700, color:'#0f172a' }}>
                  {m.total}
                </td>
              ))}
              <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:800, color:'#0f172a', fontSize:12, background:'#ecfdf5' }}>
                {grandTotal}
              </td>
              <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700, color:'#0f172a', background:'#ecfdf5' }}>
                100%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
