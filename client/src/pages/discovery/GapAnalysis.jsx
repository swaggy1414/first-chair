import { useState, useEffect, useCallback } from 'react';
import { useActiveCase } from '../../context/ActiveCaseContext';
import { api } from '../../api/client';

const GAP_TABS = [
  { key: 'all', label: 'All Gaps' },
  { key: 'missing', label: 'Missing' },
  { key: 'insufficient', label: 'Insufficient' },
  { key: 'confirmed', label: 'Confirmed' },
];

const priorityColor = (p) => p === 'high' ? 'var(--red)' : p === 'medium' ? '#DD6B20' : 'var(--blue)';

export default function GapAnalysis() {
  const { activeCaseId, activeCase, refreshCase } = useActiveCase();
  const [gapData, setGapData] = useState({ gaps: [], missing: [], insufficient: [], confirmed: [] });
  const [tab, setTab] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  const loadGaps = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    api.get(`/discovery-workspace/${activeCaseId}/gaps`)
      .then(setGapData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { loadGaps(); }, [loadGaps]);

  const handleAction = async (gapId, action) => {
    const body = {};
    if (action === 'confirmed') body.gap_action = 'confirmed';
    else if (action === 'objection') body.gap_action = 'objection_applied';
    else if (action === 'dismissed') { body.gap_action = 'dismissed'; body.status = 'waived'; }
    await api.patch(`/discovery/gaps/${gapId}`, body);
    loadGaps();
    refreshCase();
  };

  const handleStatusChange = async (gapId, status) => {
    await api.patch(`/discovery/gaps/${gapId}`, { status });
    loadGaps();
    refreshCase();
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const gaps = tab === 'all' ? gapData.gaps
    : tab === 'missing' ? gapData.missing
    : tab === 'insufficient' ? gapData.insufficient
    : gapData.confirmed;

  if (!activeCase) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Select a case</p>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Gap Analysis</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 20 }}>
        {activeCase.case_number} — {activeCase.client_name} — {gapData.gaps.length} total gaps
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {GAP_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', fontSize: '0.88rem', fontWeight: tab === t.key ? 600 : 400,
            color: tab === t.key ? 'var(--blue)' : 'var(--text-light)', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer',
          }}>
            {t.label} ({(tab === 'all' ? gapData.gaps : gapData[t.key] || []).length})
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: 'var(--text-light)' }}>Loading...</p> : gaps.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No gaps in this category</p>
      ) : (
        gaps.map((g) => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={() => toggleExpand(g.id)} style={{ padding: '12px 16px', background: 'var(--light-gray)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: priorityColor(g.priority), textTransform: 'uppercase' }}>
                  {g.priority}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>
                  {g.request_type} #{g.request_number}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  {g.gap_type?.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: g.gap_action === 'confirmed' ? '#C6F6D5' : g.gap_action === 'dismissed' ? '#E2E8F0' : g.status === 'open' ? '#FED7D7' : '#C6F6D5', color: g.gap_action === 'confirmed' ? 'var(--green)' : g.gap_action === 'dismissed' ? 'var(--text-light)' : g.status === 'open' ? 'var(--red)' : 'var(--green)' }}>
                  {g.gap_action || g.status}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{g.days_open}d</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{expanded[g.id] ? '▾' : '▸'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded[g.id] && (
              <div style={{ padding: 16 }}>
                {g.original_request_text && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Original Request</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', background: '#F7FAFC', padding: 10, borderRadius: 6 }}>{g.original_request_text}</div>
                  </div>
                )}
                {g.response_received && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Response Received</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', background: '#FFF5F5', padding: 10, borderRadius: 6 }}>{g.response_received}</div>
                  </div>
                )}
                {g.gap_description && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Deficiency</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{g.gap_description}</div>
                  </div>
                )}
                {g.ai_reasoning && (
                  <div style={{ marginBottom: 10, background: '#EBF5FF', padding: 12, borderRadius: 6, border: '1px solid rgba(42,109,181,0.2)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)', marginBottom: 4 }}>AI Reasoning</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>{g.ai_reasoning}</div>
                  </div>
                )}

                {/* Status + Actions */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                  <select value={g.status} onChange={(e) => handleStatusChange(g.id, e.target.value)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    {['open', 'client_notified', 'response_received', 'resolved', 'waived'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  {g.status === 'open' && !g.gap_action && (
                    <>
                      <button onClick={() => handleAction(g.id, 'confirmed')} style={{ padding: '5px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer' }}>Confirm</button>
                      <button onClick={() => handleAction(g.id, 'objection')} style={{ padding: '5px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, background: '#DD6B20', color: '#fff', border: 'none', cursor: 'pointer' }}>Apply Objection</button>
                      <button onClick={() => handleAction(g.id, 'dismissed')} style={{ padding: '5px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, background: 'var(--text-light)', color: '#fff', border: 'none', cursor: 'pointer' }}>Dismiss</button>
                    </>
                  )}
                  {g.assigned_to_name && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Assigned: {g.assigned_to_name}</span>}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
