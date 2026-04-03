import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCase } from '../../context/ActiveCaseContext';
import { api, API_URL } from '../../api/client';

const statBox = (label, value, color) => ({
  textAlign: 'center', padding: '14px 10px', borderRadius: 8,
  background: color === 'red' ? '#FFF5F5' : color === 'green' ? '#F0FFF4' : color === 'blue' ? '#EBF5FF' : '#F7FAFC',
  flex: 1, minWidth: 100,
});
const statNum = (color) => ({ fontSize: '1.4rem', fontWeight: 700, color: `var(--${color})` });
const statLabel = { fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' };

export default function DiscoveryDashboard() {
  const { activeCaseId, activeCase, refreshCase } = useActiveCase();
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSide, setUploadSide] = useState('defendant');
  const [uploadMsg, setUploadMsg] = useState('');
  const [recentGaps, setRecentGaps] = useState([]);

  useEffect(() => {
    if (!activeCaseId) return;
    api.get(`/discovery-workspace/${activeCaseId}/readiness`).then(setReadiness).catch(() => {});
    api.get(`/discovery-workspace/${activeCaseId}/gaps`).then(d => setRecentGaps((d.gaps || []).slice(0, 5))).catch(() => {});
  }, [activeCaseId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeCaseId) return;
    setUploading(true);
    setUploadMsg('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('response_party', uploadSide);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/upload/${activeCaseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadMsg(`Uploaded — analyzing...`);
      await api.post(`/discovery/analyze/${data.id}`, {});
      setUploadMsg('Analysis complete');
      refreshCase();
      api.get(`/discovery-workspace/${activeCaseId}/gaps`).then(d => setRecentGaps((d.gaps || []).slice(0, 5))).catch(() => {});
      api.get(`/discovery-workspace/${activeCaseId}/readiness`).then(setReadiness).catch(() => {});
      setTimeout(() => setUploadMsg(''), 3000);
    } catch (err) {
      setUploadMsg(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (!activeCase) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Select a case from the sidebar</p>;

  const c = activeCase;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
        Discovery Dashboard
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 20 }}>
        {c.case_number} — {c.client_name} — {c.incident_type}
      </p>

      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={statBox('Open Gaps', c.open_gap_count, 'red')}>
          <div style={statNum('red')}>{c.open_gap_count}</div>
          <div style={statLabel}>Open Gaps</div>
        </div>
        <div style={statBox('Pending Supplements', c.pending_supplement_count, 'blue')}>
          <div style={statNum('blue')}>{c.pending_supplement_count}</div>
          <div style={statLabel}>Supplements</div>
        </div>
        <div style={statBox('Resolved', c.resolved_gap_count, 'green')}>
          <div style={statNum('green')}>{c.resolved_gap_count}</div>
          <div style={statLabel}>Resolved</div>
        </div>
        <div style={statBox('Exhibits', c.exhibit_count, 'gray')}>
          <div style={statNum('text')}>{c.exhibit_count}</div>
          <div style={statLabel}>Exhibits</div>
        </div>
      </div>

      {/* Readiness */}
      {readiness && (
        <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 8, background: readiness.ready ? '#C6F6D5' : '#FFF5F5', border: `1px solid ${readiness.ready ? '#9AE6B4' : '#FED7D7'}` }}>
          <span style={{ fontWeight: 700, color: readiness.ready ? 'var(--green)' : 'var(--red)', fontSize: '0.9rem' }}>
            {readiness.ready ? 'Ready to File' : `Not Ready — ${readiness.blocker_count} blocker${readiness.blocker_count !== 1 ? 's' : ''}`}
          </span>
          {!readiness.ready && readiness.blockers?.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.8rem', color: 'var(--text)' }}>
              {readiness.blockers.slice(0, 4).map((b, i) => <li key={i}>{b.message}</li>)}
              {readiness.blockers.length > 4 && <li>...and {readiness.blockers.length - 4} more</li>}
            </ul>
          )}
        </div>
      )}

      {/* Upload Zone */}
      <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 20, marginBottom: 24, border: '2px dashed var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)', marginBottom: 10 }}>Upload Discovery Response</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }} value={uploadSide} onChange={(e) => setUploadSide(e.target.value)}>
            <option value="defendant">Defendant Response</option>
            <option value="plaintiff">Plaintiff Response</option>
          </select>
          <input type="file" accept=".pdf,.docx,.txt,.doc" onChange={handleUpload} disabled={uploading} style={{ fontSize: '0.85rem' }} />
          {uploadMsg && <span style={{ fontSize: '0.82rem', color: uploadMsg.includes('fail') ? 'var(--red)' : 'var(--green)' }}>{uploadMsg}</span>}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button onClick={() => navigate('/discovery/gaps')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, background: 'var(--blue)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          View All Gaps ({c.open_gap_count})
        </button>
        <button onClick={() => navigate('/discovery/supplements')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Supplements ({c.pending_supplement_count})
        </button>
        <button onClick={() => navigate('/discovery/deficiency-letters')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, background: '#DD6B20', color: '#fff', border: 'none', cursor: 'pointer' }}>
          Deficiency Letters
        </button>
      </div>

      {/* Recent Gaps Preview */}
      {recentGaps.length > 0 && (
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 10 }}>Recent Gaps</h3>
          {recentGaps.map((g) => (
            <div key={g.id} style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--white)', border: '1px solid var(--border)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: g.priority === 'high' ? 'var(--red)' : 'var(--blue)' }}>
                  {g.request_type} #{g.request_number}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: 8 }}>
                  {g.gap_type?.replace(/_/g, ' ')}
                </span>
                {g.gap_description && <div style={{ fontSize: '0.78rem', color: 'var(--text)', marginTop: 2 }}>{g.gap_description.slice(0, 100)}</div>}
              </div>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: g.status === 'open' ? '#FED7D7' : '#C6F6D5', color: g.status === 'open' ? 'var(--red)' : 'var(--green)' }}>
                {g.gap_action || g.status}
              </span>
            </div>
          ))}
          {c.open_gap_count > 5 && (
            <button onClick={() => navigate('/discovery/gaps')} style={{ fontSize: '0.82rem', color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>
              View all {c.open_gap_count} gaps →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
