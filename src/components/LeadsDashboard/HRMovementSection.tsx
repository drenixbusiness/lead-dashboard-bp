'use client';

import { useMemo, useState } from 'react';
import type { DriverRecord } from '../../types/roster';
import WorkforceMovementChart from './WorkforceMovementChart';

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

function statsFor(drivers: DriverRecord[]) {
  const hired = drivers.length;
  const active = drivers.filter(d => !d.terminationDate).length;
  const left = hired - active;
  return { hired, active, left };
}

export default function HRMovementSection({ drivers }: { drivers: DriverRecord[] }) {
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

  const stats = statsFor(filtered);
  const accent = showAll ? '#3b82f6' : hrColor(activeHR);

  if (drivers.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        No driver data yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tabs kept for focusing one HR */}
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
            border: showAll ? '1px solid #3b82f6' : '1px solid #e2e8f0',
            background: showAll ? '#eff6ff' : '#f8fafc',
            color: showAll ? '#1d4ed8' : '#64748b',
            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          All HRs
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 700,
            background: showAll ? '#dbeafe' : '#e2e8f0',
            color: showAll ? '#1d4ed8' : '#64748b',
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Hired', value: stats.hired, sub: showAll ? 'all reps' : activeHR, color: accent },
          { label: 'Still working', value: stats.active, sub: 'not terminated', color: '#15803d' },
          { label: 'Departed', value: stats.left, sub: 'left company', color: '#dc2626' },
          { label: 'Retention', value: stats.hired > 0 ? Math.round((stats.active / stats.hired) * 100) : 0, sub: '% still with us', color: '#7c3aed', suffix: '%' },
        ].map(k => (
          <div key={k.label} style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            border: '1px solid rgba(0,0,0,0.05)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1.2, marginTop: 4 }}>
              {k.value}{'suffix' in k ? k.suffix : ''}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {showAll ? (
        <>
          {/* Company overview */}
          <div style={{ ...CARD, height: 400 }}>
            <WorkforceMovementChart
              drivers={drivers}
              title="Workforce Movement — Company (all HRs)"
              subtitle="onboarding vs departures vs net headcount · all reps combined"
            />
          </div>

          {/* Every HR movement chart on one page */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Movement by HR — all reps
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {hrNames.map(hr => {
              const subset = drivers.filter(d => (d.hr ?? '').toLowerCase() === hr.toLowerCase());
              const s = statsFor(subset);
              const color = hrColor(hr);
              return (
                <div
                  key={hr}
                  style={{
                    ...CARD,
                    height: 360,
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
                      {s.active} still working · {s.hired} hired · {s.left} left
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <WorkforceMovementChart
                      drivers={subset}
                      title={`Movement — ${hr}`}
                      subtitle={`drivers hired by ${hr}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ ...CARD, height: 420 }}>
          <WorkforceMovementChart
            drivers={filtered}
            title={`Workforce Movement — ${activeHR}`}
            subtitle={`drivers hired by ${activeHR} · joined vs left vs remaining headcount`}
          />
        </div>
      )}
    </div>
  );
}
