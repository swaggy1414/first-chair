import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
};

const btnPrimary = {
  padding: '8px 18px',
  background: 'var(--blue)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnDanger = {
  padding: '6px 14px',
  background: 'var(--red)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: 4 };
const fieldGroup = { marginBottom: 16 };

const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' };
const tdStyle = { padding: '10px 12px', fontSize: '0.85rem' };

const statCard = {
  background: 'var(--light-gray)',
  borderRadius: 8,
  padding: 16,
};

function formatCurrency(val) {
  if (!val && val !== 0) return '-';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function KnowledgeBase() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    case_id: '', incident_type: '', injury_types: '', liability_factors: '',
    outcome: '', settlement_amount: '', duration_days: '', lessons_learned: '',
  });

  const loadEntries = useCallback(() => {
    const params = new URLSearchParams();
    if (filterType) params.set('incident_type', filterType);
    if (filterOutcome) params.set('outcome', filterOutcome);
    if (search) params.set('search', search);
    const qs = params.toString();
    api.get(`/knowledge${qs ? '?' + qs : ''}`)
      .then((res) => setEntries(Array.isArray(res) ? res : res.entries || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filterType, filterOutcome, search]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  useEffect(() => {
    api.get('/knowledge/stats')
      .then((res) => setStats(res))
      .catch(() => {});
    api.get('/cases')
      .then((res) => setCases(Array.isArray(res) ? res : res.cases || []))
      .catch(() => {});
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      await api.post('/knowledge', {
        ...form,
        settlement_amount: form.settlement_amount ? Number(form.settlement_amount) : null,
        duration_days: form.duration_days ? Number(form.duration_days) : null,
      });
      setForm({ case_id: '', incident_type: '', injury_types: '', liability_factors: '', outcome: '', settlement_amount: '', duration_days: '', lessons_learned: '' });
      loadEntries();
      api.get('/knowledge/stats').then((res) => setStats(res)).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/knowledge/${id}`);
      loadEntries();
      api.get('/knowledge/stats').then((res) => setStats(res)).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading knowledge base...</p>;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 24 }}>Knowledge Base</h1>

      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      {/* Search / Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, width: 280 }}
          placeholder="Search entries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          style={{ ...inputStyle, width: 180 }}
          placeholder="Filter by incident type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        />
        <input
          style={{ ...inputStyle, width: 180 }}
          placeholder="Filter by outcome"
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
        />
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 16 }}>Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            {(stats.by_type || stats.by_incident_type || []).map((s, i) => (
              <div key={i} style={statCard}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{s.incident_type || 'Unknown'}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)' }}>{s.count} cases</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                  Avg Settlement: {formatCurrency(s.avg_settlement)} | Avg Duration: {s.avg_duration ? Math.round(s.avg_duration) + 'd' : '-'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {(stats.by_outcome || stats.outcomes || []).length > 0 && (
              <div style={statCard}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Outcomes</div>
                {(stats.by_outcome || stats.outcomes || []).map((o, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{o.outcome}: {o.count}</div>
                ))}
              </div>
            )}
            {(stats.duration_stats || stats.duration) && (
              <div style={statCard}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Duration</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Avg: {Math.round((stats.duration_stats || stats.duration)?.avg_duration || (stats.duration_stats || stats.duration)?.avg || 0)} days</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Min: {(stats.duration_stats || stats.duration)?.min_duration || (stats.duration_stats || stats.duration)?.min || 0} days</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Max: {(stats.duration_stats || stats.duration)?.max_duration || (stats.duration_stats || stats.duration)?.max || 0} days</div>
              </div>
            )}
            {stats.top_lessons && stats.top_lessons.length > 0 && (
              <div style={statCard}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Top Lessons Learned</div>
                {stats.top_lessons.map((l, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 4 }}>{l}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No knowledge entries found</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Case #</th>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Incident Type</th>
                <th style={thStyle}>Injuries</th>
                <th style={thStyle}>Outcome</th>
                <th style={thStyle}>Settlement</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Lessons Learned</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{e.case_number || '-'}</td>
                  <td style={tdStyle}>{e.client_name || '-'}</td>
                  <td style={tdStyle}>{e.incident_type || '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 160 }}>{e.injury_types || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ textTransform: 'capitalize' }}>{e.outcome || '-'}</span>
                  </td>
                  <td style={tdStyle}>{formatCurrency(e.settlement_amount)}</td>
                  <td style={tdStyle}>{e.duration_days ? e.duration_days + 'd' : '-'}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, fontSize: '0.8rem' }}>{e.lessons_learned || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button style={btnDanger} onClick={() => handleDelete(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Entry Form */}
      <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 16 }}>Add Knowledge Entry</h2>
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Case</label>
              <select style={inputStyle} value={form.case_id} onChange={set('case_id')} required>
                <option value="">Select case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.case_number} - {c.client_name}</option>
                ))}
              </select>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Incident Type</label>
              <input style={inputStyle} value={form.incident_type} onChange={set('incident_type')} required />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Injury Types</label>
              <input style={inputStyle} value={form.injury_types} onChange={set('injury_types')} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Liability Factors</label>
              <input style={inputStyle} value={form.liability_factors} onChange={set('liability_factors')} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Outcome</label>
              <input style={inputStyle} value={form.outcome} onChange={set('outcome')} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Settlement Amount</label>
              <input style={inputStyle} type="number" value={form.settlement_amount} onChange={set('settlement_amount')} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Duration (days)</label>
              <input style={inputStyle} type="number" value={form.duration_days} onChange={set('duration_days')} />
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Lessons Learned</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.lessons_learned} onChange={set('lessons_learned')} />
          </div>
          <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Entry'}</button>
        </form>
      </div>
    </div>
  );
}
