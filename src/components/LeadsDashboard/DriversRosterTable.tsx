'use client';

import { useMemo, useState } from 'react';
import type { DriverRow } from '../../types/drivers';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m) - 1] ?? m} ${Number(d)}, ${y}`;
}

type SortKey = 'name' | 'startDate' | 'endDate' | 'weeks' | 'status';
type Filter = 'all' | 'active' | 'left';

export default function DriversRosterTable({
  drivers,
  source,
}: {
  drivers: DriverRow[];
  source: 'live' | 'sample';
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('weeks');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = drivers;
    if (filter !== 'all') rows = rows.filter(d => d.status === filter);
    if (q) rows = rows.filter(d => d.name.toLowerCase().includes(q));

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'weeks') return (a.weeks - b.weeks) * dir;
      if (sortKey === 'status') return a.status.localeCompare(b.status) * dir;
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [drivers, query, filter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  }

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        style={{
          padding: '8px 12px', textAlign: k === 'name' ? 'left' : 'center',
          fontWeight: 700, color: active ? '#0f172a' : '#64748b',
          borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Driver Roster &amp; Retention</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            start date · leave date · weeks with us · {filtered.length} shown
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {source === 'sample' && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              background: '#fff7ed', color: '#c2410c',
              border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 10px',
            }}>SAMPLE DATA</div>
          )}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, gap: 2 }}>
            {(['all', 'active', 'left'] as Filter[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  border: 'none', cursor: 'pointer',
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: filter === f ? '#fff' : 'transparent',
                  color: filter === f ? '#0f172a' : '#64748b',
                  boxShadow: filter === f ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search driver…"
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '6px 10px', fontSize: 12, outline: 'none',
              minWidth: 160, background: '#fff', color: '#0f172a',
            }}
          />
        </div>
      </div>

      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', flex: 1, maxHeight: 420 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
              <SortTh label="Driver" k="name" />
              <SortTh label="Came (start)" k="startDate" />
              <SortTh label="Left" k="endDate" />
              <SortTh label="Weeks" k="weeks" />
              <SortTh label="Status" k="status" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={`${d.name}-${d.startDate}-${i}`} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#374151' }}>
                  {d.name}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  {fmtDate(d.startDate)}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                  {d.endDate ? fmtDate(d.endDate) : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{
                    fontWeight: 700,
                    color: d.weeks <= 4 ? '#dc2626' : d.weeks <= 8 ? '#d97706' : '#15803d',
                  }}>
                    {d.weeks}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                    background: d.status === 'active' ? '#f0fdf4' : '#fef2f2',
                    color: d.status === 'active' ? '#15803d' : '#dc2626',
                    border: `1px solid ${d.status === 'active' ? '#bbf7d0' : '#fecaca'}`,
                    textTransform: 'capitalize',
                  }}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                  No drivers match this filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
