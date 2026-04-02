import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const btnPrimary = { padding: '8px 18px', background: 'var(--blue)', color: 'var(--white)', border: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' };
const btnSecondary = { padding: '6px 14px', background: 'var(--light-gray)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' };
const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' };
const tdStyle = { padding: '10px 12px', fontSize: '0.85rem' };

const tierColors = { day_14: 'var(--blue)', day_30: 'var(--yellow)', day_45: '#DD6B20', day_60: 'var(--red)' };
const tierLabels = { day_14: '14-Day', day_30: '30-Day', day_45: '45-Day', day_60: '60-Day' };
const statusColors = { queued: 'var(--yellow)', sent: 'var(--green)', cancelled: 'var(--text-light)' };

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecordsFollowup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queued, setQueued] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [activeTab, setActiveTab] = useState('queued');
  const [letterModal, setLetterModal] = useState(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

  const loadData = () => {
    Promise.all([
      api.get('/records-followup/queued'),
      api.get('/records-followup/log'),
    ])
      .then(([q, l]) => {
        setQueued(Array.isArray(q) ? q : []);
        setLog(Array.isArray(l) ? l : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await api.post('/records-followup/run');
      setRunResult(result);
      loadData();
    } catch (err) { setError(err.message); }
    finally { setRunning(false); }
  };

  const handleSend = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/records-followup/${id}/send`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleCancel = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/records-followup/${id}/cancel`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      loadData();
    } catch (err) { setError(err.message); }
  };

  const handleViewLetter = async (id) => {
    try {
      const result = await api.get(`/records-followup/${id}/letter`);
      setLetterModal(result);
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading follow-ups...</p>;

  const activeList = activeTab === 'queued' ? queued : log;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Records Follow-Up Queue</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <button onClick={handleRun} disabled={running} style={{ ...btnPrimary, background: 'var(--navy)', opacity: running ? 0.6 : 1 }}>
              {running ? 'Scanning...' : 'Run Follow-Up Check'}
            </button>
          )}
          {runResult && (
            <span style={{ fontSize: '0.85rem', color: 'var(--green)' }}>
              Checked {runResult.checked}, generated {runResult.generated} letters
            </span>
          )}
        </div>
      </div>

      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Queued</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--yellow)', marginTop: 4 }}>{queued.length}</div>
        </div>
        <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Sent</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>{log.filter(l => l.status === 'sent').length}</div>
        </div>
        <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Total Letters</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{log.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {['queued', 'all'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', fontSize: '0.9rem', fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? 'var(--blue)' : 'var(--text-light)', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer',
          }}>
            {tab === 'queued' ? `Ready to Send (${queued.length})` : `All Follow-Ups (${log.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {activeList.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
          {activeTab === 'queued' ? 'No follow-ups queued. Run a check to scan for outstanding records.' : 'No follow-up letters generated yet.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Case</th>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Days Out</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Queued</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeList.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: tierColors[item.followup_type] || 'gray' }}>
                    {tierLabels[item.followup_type] || item.followup_type}
                  </span>
                </td>
                <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)}>
                  <div style={{ fontWeight: 600 }}>{item.case_number}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{item.client_name}</div>
                </td>
                <td style={tdStyle}>{item.provider_name}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: item.days_outstanding >= 60 ? 'var(--red)' : item.days_outstanding >= 45 ? '#DD6B20' : 'var(--text)' }}>
                  {item.days_outstanding}d
                </td>
                <td style={tdStyle}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: statusColors[item.status] || 'gray' }}>
                    {item.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-light)' }}>{formatDate(item.queued_at || item.created_at)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => handleViewLetter(item.id)} style={btnSecondary}>View Letter</button>
                    {item.status === 'queued' && (
                      <>
                        <button onClick={() => handleSend(item.id)} style={{ ...btnPrimary, fontSize: '0.8rem', padding: '6px 12px' }}>Mark Sent</button>
                        <button onClick={() => handleCancel(item.id)} style={{ ...btnSecondary, color: 'var(--red)' }}>Cancel</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Letter Modal */}
      {letterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                {tierLabels[letterModal.followup_type] || ''} Follow-Up Letter
              </h3>
              <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: statusColors[letterModal.status] || 'gray' }}>
                {letterModal.status}
              </span>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>
              {letterModal.letter_text}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setLetterModal(null)} style={btnSecondary}>Close</button>
              <button onClick={() => { navigator.clipboard.writeText(letterModal.letter_text); }} style={btnPrimary}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
