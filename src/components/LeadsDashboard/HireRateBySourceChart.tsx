'use client';

export default function HireRateBySourceChart() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
          Hire rate by source
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          % of leads from each source that resulted in a hire
        </div>
      </div>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 10,
        padding: 24, textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No live source data yet</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>
            Connect Instagram / Facebook / LinkedIn (etc.) hire counts to populate this chart.
          </div>
        </div>
      </div>
    </div>
  );
}
