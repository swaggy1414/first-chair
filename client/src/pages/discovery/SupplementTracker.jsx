import { useState, useEffect, useCallback } from 'react';
import { useActiveCase } from '../../context/ActiveCaseContext';
import { api } from '../../api/client';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusColors = {
  draft: { bg: '#F7FAFC', color: 'var(--text-light)' },
  sent: { bg: '#FEFCE8', color: '#B7791F' },
  responded: { bg: '#C6F6D5', color: 'var(--green)' },
  closed: { bg: '#E2E8F0', color: '#4A5568' },
};

export default function SupplementTracker() {
  const { activeCaseId, activeCase, refreshCase } = useActiveCase();
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    api.get(`/supplements/${activeCaseId}`)
      .then((res) => setSupplements(Array.isArray(res) ? res : []))
      .catch(() => setSupplements([]))
      .finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id) => {
    await api.patch(`/supplements/${id}/send`, {});
    setMsg('Supplement sent');
    load(); refreshCase();
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRespond = async (id) => {
    await api.patch(`/supplements/${id}/respond`, { client_response: 'Client response received' });
    setMsg('Marked as responded');
    load(); refreshCase();
    setTimeout(() => setMsg(''), 3000);
  };

  const handleClose = async (id) => {
    await api.patch(`/supplements/${id}/close`, {});
    setMsg('Supplement closed');
    load(); refreshCase();
    setTimeout(() => setMsg(''), 3000);
  };

  if (!activeCase) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Select a case</p>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Supplement Tracker</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 20 }}>
        {activeCase.case_number} — {activeCase.client_name} — {supplements.length} supplement{supplements.length !== 1 ? 's' : ''}
      </p>
      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, background: '#C6F6D5', color: 'var(--green)', fontSize: '0.85rem', marginBottom: 16 }}>{msg}</div>}

      {loading ? <p style={{ color: 'var(--text-light)' }}>Loading...</p> : supplements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)', background: 'var(--light-gray)', borderRadius: 8 }}>
          No supplementation requests for this case yet. Upload a discovery response and generate a supplementation email to get started.
        </div>
      ) : (
        supplements.map((s) => {
          const sc = statusColors[s.status] || statusColors.draft;
          return (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: s.is_overdue ? '#FFF5F5' : 'var(--white)' }}>
                <div>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, background: sc.bg, color: sc.color, textTransform: 'uppercase' }}>
                    {s.status}
                  </span>
                  {s.is_overdue && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, background: '#FED7D7', color: 'var(--red)', marginLeft: 6 }}>OVERDUE</span>}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text)', marginLeft: 10 }}>
                    {s.response_file_name || 'Supplement Request'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {s.days_outstanding != null && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{s.days_outstanding}d</span>}
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{formatDate(s.created_at)}</span>
                </div>
              </div>

              {expandedId === s.id && (
                <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                  {s.generated_email_text && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Email Text</div>
                      <pre style={{ fontSize: '0.82rem', color: 'var(--text)', background: 'var(--light-gray)', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', margin: 0 }}>{s.generated_email_text}</pre>
                    </div>
                  )}
                  {s.client_response && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>Client Response</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{s.client_response}</div>
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 10 }}>
                    {s.sent_by_name && <span>Sent by: {s.sent_by_name} · </span>}
                    {s.sent_at && <span>Sent: {formatDate(s.sent_at)} · </span>}
                    {s.client_responded_at && <span>Responded: {formatDate(s.client_responded_at)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {s.status === 'draft' && <button onClick={() => handleSend(s.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>}
                    {s.status === 'sent' && <button onClick={() => handleRespond(s.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer' }}>Mark Responded</button>}
                    {s.status !== 'closed' && <button onClick={() => handleClose(s.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--text-light)', color: '#fff', border: 'none', cursor: 'pointer' }}>Close</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
