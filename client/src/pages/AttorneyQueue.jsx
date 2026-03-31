import { useState, useEffect } from 'react';
import { api } from '../api/client';

const columns = [
  { key: 'critical', label: 'CRITICAL', color: 'var(--red)' },
  { key: 'high', label: 'HIGH', color: 'var(--yellow)' },
  { key: 'standard', label: 'STANDARD', color: 'var(--blue)' },
  { key: 'deferred', label: 'DEFERRED', color: 'var(--text-light)' },
];

const boardStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1fr',
  gap: 20,
  minHeight: 400,
};

const colStyle = {
  background: 'var(--light-gray)',
  borderRadius: 8,
  padding: 16,
};

const colHeader = (color) => ({
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: color,
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const cardStyle = {
  background: 'var(--white)',
  borderRadius: 6,
  padding: '12px 14px',
  marginBottom: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  cursor: 'pointer',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AttorneyQueue() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = () => {
    api.get('/attorney-requests')
      .then((res) => setRequests(Array.isArray(res) ? res : res.requests || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (id, updates) => {
    try {
      await api.put(`/attorney-requests/${id}`, updates);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const grouped = {
    critical: requests.filter((r) => r.priority === 'critical'),
    high: requests.filter((r) => r.priority === 'high'),
    standard: requests.filter((r) => r.priority === 'standard'),
    deferred: requests.filter((r) => r.priority === 'deferred'),
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading queue...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 20 }}>Attorney Queue</h1>

      {requests.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No attorney requests</p>
      ) : (
        <div style={boardStyle}>
          {columns.map((col) => (
            <div key={col.key} style={colStyle}>
              <div style={colHeader(col.color)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                {col.label}
                <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-light)' }}>
                  {grouped[col.key].length}
                </span>
              </div>
              {grouped[col.key].map((req) => (
                <div key={req.id} style={cardStyle} onClick={() => setEditing(editing === req.id ? null : req.id)}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{req.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
                    {req.case_number || ''} {req.due_date ? `| Due: ${formatDate(req.due_date)}` : ''}
                  </div>
                  {req.requester_name && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 2 }}>
                      from {req.requester_name}
                    </div>
                  )}
                  {editing === req.id && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <select
                        style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid var(--border)' }}
                        value={req.priority}
                        onChange={(e) => handleUpdate(req.id, { priority: e.target.value })}
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="standard">Standard</option>
                        <option value="deferred">Deferred</option>
                      </select>
                      <select
                        style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid var(--border)' }}
                        value={req.status || 'open'}
                        onChange={(e) => handleUpdate(req.id, { status: e.target.value })}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {grouped[col.key].length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>
                  No items
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
