import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const flagColors = { red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)' };

const statusColors = {
  active: { bg: '#EBF5FF', color: 'var(--blue)' },
  intake: { bg: '#FEFCE8', color: 'var(--yellow)' },
  settled: { bg: '#F0FFF4', color: 'var(--green)' },
  closed: { bg: 'var(--light-gray)', color: 'var(--text-light)' },
  litigation: { bg: '#FFF5F5', color: 'var(--red)' },
};

function StatusBadge({ status }) {
  const s = statusColors[status?.toLowerCase()] || statusColors.active;
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: '0.78rem',
      fontWeight: 600,
      background: s.bg,
      color: s.color,
      textTransform: 'capitalize',
    }}>
      {status || 'Unknown'}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const searchStyle = {
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
  width: 280,
  outline: 'none',
};

const filterStyle = {
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
  background: 'var(--white)',
  outline: 'none',
};

export default function CaseList() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/cases')
      .then((res) => setCases(Array.isArray(res) ? res : res.cases || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) => {
    const matchSearch = !search ||
      (c.case_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (c.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(cases.map((c) => c.status).filter(Boolean))];

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading cases...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 20 }}>Cases</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          style={searchStyle}
          type="text"
          placeholder="Search cases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={filterStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-light)', padding: 20 }}>No cases found</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Flag</th>
              <th>Case #</th>
              <th>Client</th>
              <th>Type</th>
              <th>Status</th>
              <th>Paralegal</th>
              <th>Attorney</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: flagColors[c.flag_color] || 'var(--green)',
                  }} />
                </td>
                <td style={{ fontWeight: 600 }}>{c.case_number}</td>
                <td>{c.client_name}</td>
                <td>{c.case_type}</td>
                <td><StatusBadge status={c.status} /></td>
                <td>{c.paralegal_name || '—'}</td>
                <td>{c.attorney_name || '—'}</td>
                <td style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>{formatDate(c.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
