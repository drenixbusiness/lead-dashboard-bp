'use client';

import { useMemo, useState } from 'react';
import type { DriverRecord } from '../../types/roster';
import { calcDriverTenureWeeks } from '../../utils/tenure';
import TenureDistributionChart from './TenureDistributionChart';

const HR_COLORS: Record<string, string> = {
  FRED:    '#14b8a6',
  ALEX:    '#22c55e',
  ETHAN:   '#6366f1',
  NICK:    '#f97316',
  MICHAEL: '#84cc16',
  WINSTON: '#3b82f6',
  ISAAC:   '#f59e0b',
  JESSICA: '#a855f7',
  ALFRED:  '#ec4899',
};

const CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 18px',
  border: '1px solid rgba(0,0,0,0.05)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
};

function hrColor(hr: string) {
  return HR_COLORS[hr.toUpperCase()] ?? '#64748b';
}

function tenureStats(drivers: DriverRecord[]) {
  const weeks = drivers
    .map(d => calcDriverTenureWeeks(d))
    .filter((w): w is number => w !== null);
  const active = drivers.filter(d => !d.terminationDate);
  const left = drivers.filter(d => d.terminationDate);
  const avg = weeks.length > 0
    ? Math.round((weeks.reduce((s, w) => s + w, 0) / weeks.length) * 10) / 10
    : 0;
  const activeWeeks = active
    .map(d => calcDriverTenureWeeks(d))
    .filter((w): w is number => w !== null);
  const avgActive = activeWeeks.length > 0
    ? Math.round((activeWeeks.reduce((s, w) => s + w, 0) / activeWeeks.length) * 10) / 10
    : 0;
  const median = (() => {
    if (weeks.length === 0) return 0;
    const s = [...weeks].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  })();
  return {
    total: drivers.length,
    active: active.length,
    left: left.length,
    avg,
    avgActive,
    median,
  };
}

function KpiRow({
  stats,
  accent,
  scopeLabel,
}: {
  stats: ReturnType<typeof tenureStats>;
  accent: string;
  scopeLabel: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {[
        { label: 'Drivers tracked', value: String(stats.total), sub: scopeLabel, color: accent },
        { label: 'Avg tenure', value: `${stats.avg.toFixed(1)} wks`, sub: 'all drivers', color: '#4338ca' },
        { label: 'Avg (still working)', value: `${stats.avgActive.toFixed(1)} wks`, sub: 'active only', color: '#15803d' },
        { label: 'Median tenure', value: `${stats.median} wks`, sub: `${stats.active} active · ${stats.left} left`, color: '#7c3aed' },
      ].map(k => (
        <div key={k.label} style={{
          background: '#fff', borderRadius: 12, padding: '14px 16px',
          border: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{k.label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1.2, marginTop: 4 }}>
            {k.value}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

export default function HRTenureSection({ drivers }: { drivers: DriverRecord[] }) {
  const hrNames = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const d of drivers) {
      const hr = (d.hr ?? '').trim();
      if (!hr) continue;
      totals[hr] = (totals[hr] ?? 0) + 1;
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([hr]) => hr);
  }, [drivers]);

  const [selected, setSelected] = useState<string>('all');
  const activeHR = selected === 'all' || hrNames.includes(selected) ? selected : 'all';
  const showAll = activeHR === 'all';

  const filtered = useMemo(() => {
    if (showAll) return drivers;
    return drivers.filter(d => (d.hr ?? '').toLowerCase() === activeHR.toLowerCase());
  }, [drivers, activeHR, showAll]);

  const stats = tenureStats(filtered);
  const accent = showAll ? '#4338ca' : hrColor(activeHR);

  if (drivers.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        No driver data yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HR tabs — kept for focusing one HR */}
      <div style={{
        display: 'flex', gap: 6, flexWrap: 'wrap',
        background: '#fff', borderRadius: 12, padding: 8,
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <button
          type="button"
          onClick={() => setSelected('all')}
          style={{
            border: showAll ? '1px solid #6366f1' : '1px solid #e2e8f0',
            background: showAll ? '#eef2ff' : '#f8fafc',
            color: showAll ? '#4338ca' : '#64748b',
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          All HRs
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 700,
            background: showAll ? '#c7d2fe' : '#e2e8f0',
            color: showAll ? '#4338ca' : '#64748b',
            borderRadius: 10, padding: '1px 7px',
          }}>
            {drivers.length}
          </span>
        </button>
        {hrNames.map(hr => {
          const count = drivers.filter(d => (d.hr ?? '').toLowerCase() === hr.toLowerCase()).length;
          const on = activeHR === hr;
          const color = hrColor(hr);
          return (
            <button
              key={hr}
              type="button"
              onClick={() => setSelected(hr)}
              style={{
                border: on ? `1px solid ${color}` : '1px solid #e2e8f0',
                background: on ? `${color}18` : '#f8fafc',
                color: on ? color : '#64748b',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {hr}
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: on ? `${color}22` : '#e2e8f0',
                color: on ? color : '#64748b',
                borderRadius: 10, padding: '1px 7px',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <KpiRow
        stats={stats}
        accent={accent}
        scopeLabel={showAll ? 'all reps combined' : `hired by ${activeHR}`}
      />

      {showAll ? (
        <>
          {/* Company overview */}
          <div style={{ ...CARD, height: 400 }}>
            <TenureDistributionChart
              drivers={drivers}
              title="Tenure Distribution — Company (all HRs)"
              subtitle="combined · weeks since hire · still working → today · left → leave date"
            />
          </div>

          {/* Every HR chart on one page */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Tenure by HR — all reps
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}>
            {hrNames.map(hr => {
              const subset = drivers.filter(d => (d.hr ?? '').toLowerCase() === hr.toLowerCase());
              const s = tenureStats(subset);
              const color = hrColor(hr);
              return (
                <div
                  key={hr}
                  style={{
                    ...CARD,
                    height: 380,
                    borderTop: `3px solid ${color}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelected(hr)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(hr); }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 4, gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{hr}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                      avg {s.avg.toFixed(1)}w · {s.active} active · {s.left} left
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <TenureDistributionChart
                      drivers={subset}
                      title={`Tenure — ${hr}`}
                      subtitle={`${subset.length} drivers hired by ${hr}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Single HR focus (selection kept) */
        <div style={{ ...CARD, height: 440 }}>
          <TenureDistributionChart
            drivers={filtered}
            title={`Tenure Distribution — ${activeHR}`}
            subtitle={`drivers hired by ${activeHR} · still working → today · left → leave date`}
          />
        </div>
      )}
    </div>
  );
}
