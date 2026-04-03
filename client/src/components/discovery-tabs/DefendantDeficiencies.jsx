import { useState, useEffect, useCallback } from 'react';
import { api, API_URL } from '../../api/client';

const GAP_TYPES = {
  missing_document: { label: 'Missing Document', color: '#E53E3E' },
  no_answer: { label: 'No Answer', color: '#E53E3E' },
  incomplete_answer: { label: 'Incomplete Answer', color: '#DD6B20' },
  evasive_answer: { label: 'Evasive Answer', color: '#DD6B20' },
  objection_only: { label: 'Objection Only', color: '#805AD5' },
};

const ACTION_LABELS = {
  confirmed: { label: 'Confirmed', bg: '#C6F6D5', color: '#276749' },
  objection_applied: { label: 'Objection Applied', bg: '#BEE3F8', color: '#2A6DB5' },
  dismissed: { label: 'Dismissed', bg: '#E2E8F0', color: '#718096' },
};

export default function DefendantDeficiencies({ caseId }) {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(() => {
    api.get(`/discovery-workspace/${caseId}/gaps`)
      .then((res) => {
        const allGaps = res.gaps || [];
        // Only show defendant-side gaps (from responses where response_party = defendant or unset)
        setGaps(allGaps);
      })
      .catch(() => setGaps([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (gapId, updates) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/discovery/gaps/${gapId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      load();
    } catch { /* silent */ }
  };

  if (loading) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Loading deficiencies...</p>;

  const confirmed = gaps.filter(g => g.gap_action === 'confirmed');
  const unreviewed = gaps.filter(g => !g.gap_action && g.status === 'open');
  const objected = gaps.filter(g => g.gap_action === 'objection_applied');
  const dismissed = gaps.filter(g => g.gap_action === 'dismissed');

  const filtered = filter === 'all' ? gaps
    : filter === 'unreviewed' ? unreviewed
    : filter === 'confirmed' ? confirmed
    : filter === 'objected' ? objected
    : dismissed;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1C3557' }}>Defendant Deficiencies</h3>
        <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem' }}>
          <span style={{ color: '#E53E3E', fontWeight: 600 }}>{unreviewed.length} unreviewed</span>
          <span style={{ color: '#38A169', fontWeight: 600 }}>{confirmed.length} confirmed</span>
          <span style={{ color: '#2A6DB5', fontWeight: 600 }}>{objected.length} objected</span>
          <span style={{ color: '#718096', fontWeight: 600 }}>{dismissed.length} dismissed</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${gaps.length})` },
          { key: 'unreviewed', label: `Unreviewed (${unreviewed.length})` },
          { key: 'confirmed', label: `Confirmed (${confirmed.length})` },
          { key: 'objected', label: `Objected (${objected.length})` },
          { key: 'dismissed', label: `Dismissed (${dismissed.length})` },
        ].map(f => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', fontSize: '0.8rem', fontWeight: filter === f.key ? 600 : 400, cursor: 'pointer',
            background: filter === f.key ? '#2A6DB5' : 'var(--white)', color: filter === f.key ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 0,
            ...(f.key === 'all' ? { borderRadius: '6px 0 0 6px' } : {}),
            ...(f.key === 'dismissed' ? { borderRadius: '0 6px 6px 0' } : {}),
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No deficiencies found</p>
      ) : (
        filtered.map(gap => {
          const typeInfo = GAP_TYPES[gap.gap_type] || { label: gap.gap_type, color: '#718096' };
          return (
            <div key={gap.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10, borderLeft: `3px solid ${typeInfo.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, color: '#fff', background: typeInfo.color }}>{typeInfo.label}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1C3557' }}>
                      {(gap.request_type || '').toUpperCase()} #{gap.request_number}
                    </span>
                    {gap.gap_action && (() => {
                      const a = ACTION_LABELS[gap.gap_action];
                      return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, color: a.color, background: a.bg }}>{a.label}</span>;
                    })()}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{gap.days_open}d open</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 4 }}>{gap.gap_description}</div>
                  {gap.ai_reasoning && (
                    <div style={{ fontSize: '0.8rem', color: '#2A6DB5', marginTop: 6, background: '#EBF5FF', padding: 8, borderRadius: 4, lineHeight: 1.5 }}>
                      {gap.ai_reasoning}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 12, display: 'flex', gap: 4 }}>
                  {!gap.gap_action && gap.status === 'open' && (
                    <>
                      <button type="button" onClick={() => handleAction(gap.id, { gap_action: 'confirmed' })} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, background: '#C6F6D5', color: '#276749', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Confirm</button>
                      <button type="button" onClick={() => handleAction(gap.id, { gap_action: 'objection_applied' })} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, background: '#BEE3F8', color: '#2A6DB5', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Object</button>
                      <button type="button" onClick={() => handleAction(gap.id, { gap_action: 'dismissed', status: 'waived' })} style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, background: '#E2E8F0', color: '#718096', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Dismiss</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
