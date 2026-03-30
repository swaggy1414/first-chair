import { useState, useEffect } from 'react';
import { api } from '../api/client';

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function ageColor(days) {
  if (days > 60) return 'var(--red)';
  if (days >= 30) return 'var(--yellow)';
  return 'var(--green)';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const aiBtnStyle = {
  padding: '4px 12px',
  background: 'var(--navy)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 600,
};

export default function RecordsTracker() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/records')
      .then((res) => setRecords(Array.isArray(res) ? res : res.records || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading records...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 20 }}>Records Tracker</h1>

      {records.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No records requests</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Case</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Status</th>
              <th>Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const age = daysSince(r.requested_date || r.created_at);
              const showAgeColor = r.status !== 'received' && r.status !== 'reviewed';
              return (
                <tr key={r.id} style={showAgeColor ? { borderLeft: `3px solid ${ageColor(age)}` } : {}}>
                  <td>{r.provider_name}</td>
                  <td>{r.case_number || r.case_id}</td>
                  <td>{r.record_type}</td>
                  <td>{formatDate(r.requested_date || r.created_at)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.status || 'requested'}</td>
                  <td>
                    <span style={{ color: showAgeColor ? ageColor(age) : 'var(--text)', fontWeight: 600 }}>
                      {age}d
                    </span>
                  </td>
                  <td>
                    {showAgeColor && (
                      <button style={aiBtnStyle} onClick={() => alert('Coming soon')}>
                        AI Follow-Up Letter
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
