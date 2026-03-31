import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { inputStyle, btnPrimary } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecordsTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider_name: '', record_type: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/cases/${caseId}/records`)
      .then((res) => setItems(Array.isArray(res) ? res : res.records || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post(`/cases/${caseId}/records`, form);
      setForm({ provider_name: '', record_type: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/cases/${caseId}/records/${id}`, { status });
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input style={{ ...inputStyle, width: 200 }} placeholder="Provider name" value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} required />
        <input style={{ ...inputStyle, width: 200 }} placeholder="Record type" value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value })} required />
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Request'}</button>
      </form>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No records requests</p>
      ) : (
        <table>
          <thead><tr><th>Provider</th><th>Type</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.provider_name}</td>
                <td>{r.record_type}</td>
                <td>{formatDate(r.requested_date || r.created_at)}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.status || 'requested'}</td>
                <td>
                  <select style={{ ...inputStyle, width: 'auto' }} value={r.status || 'requested'} onChange={(e) => handleStatus(r.id, e.target.value)}>
                    <option value="requested">Requested</option>
                    <option value="received">Received</option>
                    <option value="reviewed">Reviewed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
