import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_URL } from '../../api/client';
import { btnPrimary, btnSecondary } from './styles';

const GAP_TYPE_LABELS = { missing_document: 'Missing Document', incomplete_answer: 'Incomplete Answer', no_answer: 'No Answer', evasive_answer: 'Evasive Answer', objection_only: 'Objection Only' };
const PRIORITY_COLORS = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--green)' };
const GAP_STATUSES = ['open', 'client_notified', 'response_received', 'resolved', 'waived'];

const STATUS_BADGE_COLORS = {
  responded: { bg: 'var(--green)', color: '#fff' },
  complied: { bg: 'var(--green)', color: '#fff' },
  served: { bg: 'var(--blue)', color: '#fff' },
  issued: { bg: 'var(--blue)', color: '#fff' },
  draft: { bg: 'var(--light-gray)', color: 'var(--text)' },
  deficient: { bg: 'var(--yellow)', color: '#000' },
  quashed: { bg: 'var(--red)', color: '#fff' },
};

export default function DiscoveryTab({ caseId }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ responses: [], gaps: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [subpoenas, setSubpoenas] = useState([]);
  const [subpoenasLoading, setSubpoenasLoading] = useState(true);

  const load = useCallback(() => {
    api.get(`/discovery/case/${caseId}/gaps`)
      .then((res) => setData({ responses: res.responses || [], gaps: res.gaps || [] }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get(`/subpoenas/case/${caseId}`)
      .then((res) => {
        const list = res.subpoenas || res || [];
        setSubpoenas(Array.isArray(list) ? list : []);
      })
      .catch(() => setSubpoenas([]))
      .finally(() => setSubpoenasLoading(false));
  }, [caseId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.elements.file;
    const file = fileInput?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/upload/${caseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); throw new Error(err2.message || 'Upload failed'); }
      fileInput.value = '';
      load();
    } catch (err2) { setError(err2.message); }
    finally { setUploading(false); }
  };

  const handleAnalyze = async (responseId) => {
    setAnalyzing(responseId);
    try {
      await api.post(`/discovery/analyze/${responseId}`);
      load();
    } catch (err) { setError(err.message); }
    finally { setAnalyzing(null); }
  };

  const handleGenerateEmail = async (responseId) => {
    setGenerating(responseId);
    try {
      const result = await api.post(`/discovery/generate-email/${responseId}`);
      setEmailPreview(result);
    } catch (err) { setError(err.message); }
    finally { setGenerating(null); }
  };

  const handleDeleteResponse = async (responseId, fileName) => {
    if (!window.confirm(`Delete "${fileName}" and all associated gaps? This cannot be undone.`)) return;
    try {
      await api.del(`/discovery/response/${responseId}`);
      load();
    } catch (err2) { setError(err2.message); }
  };

  const handleGapUpdate = async (gapId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/gaps/${gapId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Update failed'); }
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading discovery data...</p>;

  return (
    <div>
      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Discovery Responses ({data.responses.length})</h3>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="file" name="file" accept=".pdf,.doc,.docx,.txt" required style={{ fontSize: '0.85rem' }} />
          <button type="submit" disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      {data.responses.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No discovery responses uploaded yet</p>
      ) : (
        data.responses.map((resp) => {
          const respGaps = data.gaps.filter((g) => g.discovery_response_id === resp.id);
          const openGaps = respGaps.filter((g) => g.status === 'open');
          return (
            <div key={resp.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resp.file_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>
                    {resp.responding_party || 'Party not set'} &middot; {resp.uploaded_by_name || ''} &middot; {new Date(resp.created_at).toLocaleDateString()}
                  </div>
                  {resp.status === 'complete' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                      Interrogatories: {resp.interrogatory_count} &middot; RFAs: {resp.rfa_count} &middot; RPDs: {resp.rpd_count}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {resp.status === 'processing' && (
                    <button onClick={() => handleAnalyze(resp.id)} disabled={analyzing === resp.id} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>
                      {analyzing === resp.id ? 'Analyzing...' : 'Run AI Analysis'}
                    </button>
                  )}
                  {resp.status === 'complete' && openGaps.length > 0 && (
                    <button onClick={() => handleGenerateEmail(resp.id)} disabled={generating === resp.id} style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px' }}>
                      {generating === resp.id ? 'Generating...' : 'Generate Client Email'}
                    </button>
                  )}
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: resp.status === 'complete' ? 'var(--green)' : resp.status === 'error' ? 'var(--red)' : 'var(--yellow)' }}>
                    {resp.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteResponse(resp.id, resp.file_name)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.78rem', cursor: 'pointer', padding: '6px 8px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {respGaps.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Req #</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Gap</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Priority</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respGaps.map((gap) => (
                      <tr key={gap.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', background: 'var(--light-gray)', fontWeight: 600 }}>
                            {GAP_TYPE_LABELS[gap.gap_type] || gap.gap_type}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>{gap.request_type?.toUpperCase()} #{gap.request_number}</td>
                        <td style={{ padding: '8px', fontSize: '0.8rem', maxWidth: 300 }}>{gap.gap_description}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[gap.priority] || '#ccc', display: 'inline-block' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={gap.status} onChange={(e) => handleGapUpdate(gap.id, { status: e.target.value })} style={{ padding: '3px 6px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--border)' }}>
                            {GAP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })
      )}

      {/* Subpoenas Section */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Subpoenas ({subpoenas.length})</h3>
          <button type="button" onClick={() => navigate('/subpoena-manager')} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>
            Issue Subpoena
          </button>
        </div>
        {subpoenasLoading ? (
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Loading subpoenas...</p>
        ) : subpoenas.length === 0 ? (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>No subpoenas for this case</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Recipient</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>State</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Response Due</th>
              </tr>
            </thead>
            <tbody>
              {subpoenas.map((sub) => {
                const badge = STATUS_BADGE_COLORS[sub.status] || { bg: 'var(--light-gray)', color: 'var(--text)' };
                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontSize: '0.8rem' }}>{sub.recipient_name || sub.entity_name || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '0.8rem' }}>{sub.subpoena_type || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '0.8rem' }}>{sub.state || '-'}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, color: badge.color, background: badge.bg }}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px', fontSize: '0.8rem' }}>{sub.response_due_date ? new Date(sub.response_due_date).toLocaleDateString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {emailPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700 }}>Generated Client Email</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>{emailPreview.generated_email_text}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setEmailPreview(null)} style={btnSecondary}>Close</button>
              <button onClick={() => { navigator.clipboard.writeText(emailPreview.generated_email_text); }} style={btnPrimary}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
