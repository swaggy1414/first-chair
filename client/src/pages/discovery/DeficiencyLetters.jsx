import { useState, useEffect, useCallback } from 'react';
import { useActiveCase } from '../../context/ActiveCaseContext';
import { api } from '../../api/client';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const statusColors = {
  draft: { bg: '#FEFCE8', color: '#B7791F' },
  sent: { bg: '#C6F6D5', color: 'var(--green)' },
  cancelled: { bg: '#E2E8F0', color: '#718096' },
};

export default function DeficiencyLetters() {
  const { activeCaseId, activeCase } = useActiveCase();
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [msg, setMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    api.get(`/deficiency-letters/${activeCaseId}`)
      .then((res) => setLetters(Array.isArray(res) ? res : []))
      .catch(() => setLetters([]))
      .finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (gapId) => {
    setGenerating(true);
    setMsg('');
    try {
      const body = gapId ? { gap_id: gapId } : {};
      const res = await api.post(`/deficiency-letters/${activeCaseId}/generate`, body);
      setMsg(`Generated ${res.count} letter${res.count !== 1 ? 's' : ''}`);
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (id) => {
    try {
      await api.patch(`/deficiency-letters/${id}/send`, {});
      setMsg('Letter marked as sent');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  const handleCancel = async (id) => {
    try {
      await api.patch(`/deficiency-letters/${id}/cancel`, {});
      setMsg('Letter cancelled');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  const handleSaveEdit = async (id) => {
    try {
      await api.put(`/deficiency-letters/${id}`, { letter_text: editText });
      setEditingId(null);
      setMsg('Letter updated');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message); }
  };

  if (!activeCase) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Select a case</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>Deficiency Letters</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>
            {activeCase.case_number} — {activeCase.client_name} — {letters.length} letter{letters.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => handleGenerate()} disabled={generating} style={{
          padding: '8px 18px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600,
          background: generating ? '#ccc' : '#DD6B20', color: '#fff', border: 'none', cursor: generating ? 'default' : 'pointer',
        }}>
          {generating ? 'Generating...' : 'Generate Letters for Open Gaps'}
        </button>
      </div>

      {msg && <div style={{ padding: '8px 14px', borderRadius: 6, background: msg.includes('fail') || msg.includes('error') ? '#FED7D7' : '#C6F6D5', color: msg.includes('fail') || msg.includes('error') ? 'var(--red)' : 'var(--green)', fontSize: '0.85rem', marginBottom: 16 }}>{msg}</div>}

      {loading ? <p style={{ color: 'var(--text-light)' }}>Loading...</p> : letters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)', background: 'var(--light-gray)', borderRadius: 8 }}>
          No deficiency letters yet. Click "Generate Letters" to create letters for all open gaps.
        </div>
      ) : (
        letters.map((l) => {
          const sc = statusColors[l.status] || statusColors.draft;
          const isExpanded = expandedId === l.id;
          const isEditing = editingId === l.id;

          return (
            <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div onClick={() => { setExpandedId(isExpanded ? null : l.id); setEditingId(null); }} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, background: sc.bg, color: sc.color, textTransform: 'uppercase' }}>
                    {l.status}
                  </span>
                  {l.request_type && l.request_number && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy)' }}>
                      {l.request_type} #{l.request_number}
                    </span>
                  )}
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                    {l.gap_type?.replace(/_/g, ' ') || 'General'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {l.generated_by_name && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>by {l.generated_by_name}</span>}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{formatDate(l.created_at)}</span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
                  {isEditing ? (
                    <div>
                      <textarea value={editText} onChange={(e) => setEditText(e.target.value)} style={{ width: '100%', minHeight: 250, padding: 12, border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={() => handleSaveEdit(l.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', background: 'var(--light-gray)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre style={{ fontSize: '0.85rem', color: 'var(--text)', background: 'var(--light-gray)', padding: 14, borderRadius: 6, whiteSpace: 'pre-wrap', margin: '0 0 12px', lineHeight: 1.5 }}>{l.letter_text}</pre>
                      {l.gap_description && <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 10 }}>Gap: {l.gap_description}</div>}
                      {l.sent_at && <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 10 }}>Sent: {formatDate(l.sent_at)} by {l.sent_by_name || 'unknown'}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {l.status === 'draft' && (
                          <>
                            <button onClick={() => handleSend(l.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer' }}>Mark Sent</button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(l.id); setEditText(l.letter_text); }} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => handleCancel(l.id)} style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.8rem', background: 'var(--light-gray)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}>Cancel</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
