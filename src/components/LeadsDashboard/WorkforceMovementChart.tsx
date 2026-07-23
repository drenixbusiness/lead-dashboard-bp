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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { Context } from 'chartjs-plugin-datalabels';
import { Chart } from 'react-chartjs-2';
import type { DriverRecord } from '../../types/roster';

ChartJS.register(
  CategoryScale, LinearScale,
  BarController, BarElement,
  LineController, PointElement, LineElement,
  Tooltip, Legend,
);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LEGEND_ITEMS = [
  { color: '#22c55e', label: 'New Drivers', shape: 'bar' as const },
  { color: '#ef4444', label: 'Departed', shape: 'bar' as const },
  { color: '#3b82f6', label: 'Active Headcount', shape: 'line' as const },
];

export type MovementRow = {
  month: string;
  sort: string;
  onboarded: number;
  departed: number;
  headcount: number;
};

function monthKey(iso: string): { label: string; sort: string } | null {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const mi = Number(m[2]) - 1;
  if (mi < 0 || mi > 11) return null;
  return { label: `${MONTH_NAMES[mi]} ${m[1]}`, sort: `${m[1]}-${m[2]}` };
}

export function buildMovement(drivers: DriverRecord[]): MovementRow[] {
  const map = new Map<string, { onboarded: number; departed: number; sort: string; label: string }>();

  for (const d of drivers) {
    if (d.hiredDate) {
      const mk = monthKey(d.hiredDate);
      if (mk) {
        const cur = map.get(mk.sort) ?? { onboarded: 0, departed: 0, sort: mk.sort, label: mk.label };
        cur.onboarded += 1;
        map.set(mk.sort, cur);
      }
    }
    if (d.terminationDate) {
      const mk = monthKey(d.terminationDate);
      if (mk) {
        const cur = map.get(mk.sort) ?? { onboarded: 0, departed: 0, sort: mk.sort, label: mk.label };
        cur.departed += 1;
        map.set(mk.sort, cur);
      }
    }
  }

  const sorted = [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  let headcount = 0;
  return sorted.map(v => {
    headcount += v.onboarded - v.departed;
    return {
      month: v.label,
      sort: v.sort,
      onboarded: v.onboarded,
      departed: v.departed,
      headcount: Math.max(0, headcount),
    };
  });
}

/** Align series to a shared month axis (fill missing months with zeros / carried headcount). */
export function alignMovementToMonths(drivers: DriverRecord[], monthSortKeys: string[]): MovementRow[] {
  const raw = buildMovement(drivers);
  const bySort = new Map(raw.map(r => [r.sort, r]));
  let headcount = 0;

  return monthSortKeys.map(sort => {
    const hit = bySort.get(sort);
    const onboarded = hit?.onboarded ?? 0;
    const departed = hit?.departed ?? 0;
    headcount = Math.max(0, headcount + onboarded - departed);
    const [y, m] = sort.split('-');
    const mi = Number(m) - 1;
    return {
      month: hit?.month ?? `${MONTH_NAMES[mi] ?? m} ${y}`,
      sort,
      onboarded,
      departed,
      headcount,
    };
  });
}

function ceilToStep(n: number, step = 5): number {
  if (n <= 0) return step;
  return Math.ceil(n / step) * step;
}

/** Shared Y scale + month axis across several HR driver lists (ticks of 5). */
export function getSharedMovementScale(driverGroups: DriverRecord[][]): {
  monthSortKeys: string[];
  yMax: number;
  yMin: number;
} {
  const monthSet = new Set<string>();
  for (const group of driverGroups) {
    for (const row of buildMovement(group)) monthSet.add(row.sort);
  }
  const monthSortKeys = [...monthSet].sort();

  let maxPos = 0;
  let maxNeg = 0;
  for (const group of driverGroups) {
    for (const row of alignMovementToMonths(group, monthSortKeys)) {
      maxPos = Math.max(maxPos, row.onboarded, row.headcount);
      maxNeg = Math.max(maxNeg, row.departed);
    }
  }

  return {
    monthSortKeys,
    yMax: ceilToStep(maxPos, 5),
    yMin: -ceilToStep(maxNeg, 5),
  };
}

export default function WorkforceMovementChart({
  drivers,
  title = 'Workforce Movement',
  subtitle = 'onboarding vs departures vs net headcount',
  monthSortKeys,
  yMax,
  yMin,
}: {
  drivers: DriverRecord[];
  title?: string;
  subtitle?: string;
  /** Shared month axis so every HR chart looks the same width/shape */
  monthSortKeys?: string[];
  /** Shared Y max (steps of 5) so sparse HRs don't inflate bars */
  yMax?: number;
  yMin?: number;
}) {
  const data = monthSortKeys?.length
    ? alignMovementToMonths(drivers, monthSortKeys)
    : buildMovement(drivers);

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
        No movement data yet
      </div>
    );
  }

  const labels = data.map(d => d.month.replace(/ 20\d{2}$/, ''));
  const totalJoined = data.reduce((s, d) => s + d.onboarded, 0);
  const totalLeft = data.reduce((s, d) => s + d.departed, 0);
  const net = totalJoined - totalLeft;

  const localMax = Math.max(...data.map(d => Math.max(d.onboarded, d.headcount)), 1);
  const localMin = -Math.max(...data.map(d => d.departed), 1);
  const axisMax = yMax ?? ceilToStep(localMax, 5);
  const axisMin = yMin ?? -ceilToStep(Math.abs(localMin), 5);

  const chartData = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'New Drivers',
        data: data.map(d => d.onboarded),
        backgroundColor: 'rgba(34,197,94,0.85)',
        borderRadius: 4,
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Departed',
        data: data.map(d => -d.departed),
        backgroundColor: 'rgba(239,68,68,0.8)',
        borderRadius: 4,
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Active Headcount',
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
    layout: { padding: { top: 18, bottom: 8 } },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar' | 'line'>) => {
            const v = ctx.parsed.y ?? 0;
            if (ctx.dataset.label === 'Departed') return ` Departed: ${Math.abs(v)}`;
            return ` ${ctx.dataset.label}: ${v}`;
          },
        },
      },
      datalabels: {
        display: (ctx: Context) => {
          const v = ctx.dataset.data[ctx.dataIndex];
          const n = typeof v === 'number' ? v : 0;
          return n !== 0;
        },
        formatter: (value: number, ctx: Context) => {
          const label = ctx.dataset.label ?? '';
          if (label === 'Departed') return String(Math.abs(value));
          return String(value);
        },
        color: (ctx: Context) => {
          const label = ctx.dataset.label ?? '';
          if (label === 'Active Headcount') return '#1d4ed8';
          if (label === 'Departed') return '#991b1b';
          return '#14532d';
        },
        font: { size: 10, weight: 'bold' as const },
        anchor: (ctx: Context) => {
          const label = ctx.dataset.label ?? '';
          if (label === 'Departed') return 'start' as const;
          return 'end' as const;
        },
        align: (ctx: Context) => {
          const label = ctx.dataset.label ?? '';
          if (label === 'Active Headcount') return 'top' as const;
          if (label === 'Departed') return 'bottom' as const;
          return 'top' as const;
        },
        offset: 2,
        clamp: true,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        min: axisMin,
        max: axisMax,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          stepSize: 5,
          callback: (v: string | number) => (typeof v === 'number' && v < 0 ? '' : String(v)),
        },
        border: { display: false },
      },
    },
  };

  const rangeLabel = data.length > 1
    ? `${labels[0]}→${labels[labels.length - 1]}`
    : labels[0] ?? '';

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
          background: net >= 0 ? '#f0fdf4' : '#fef2f2',
          color: net >= 0 ? '#15803d' : '#dc2626',
          border: `1px solid ${net >= 0 ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 20, padding: '3px 10px',
        }}>
          {net >= 0 ? '▲' : '▼'} Net {Math.abs(net)} drivers {rangeLabel}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {LEGEND_ITEMS.map(item => (
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

      <div style={{ flex: 1, minHeight: 0 }}>
        <Chart type="bar" data={chartData} options={options as never} plugins={[ChartDataLabels] as never} />
      </div>
    </div>
  );
}
