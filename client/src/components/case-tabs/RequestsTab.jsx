import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { inputStyle, btnPrimary } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RequestsTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', priority: 'standard' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/cases/${caseId}/requests`)
      .then((res) => setItems(Array.isArray(res) ? res : res.requests || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post(`/cases/${caseId}/requests`, form);
      setForm({ title: '', description: '', priority: 'standard' });
      load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  const handleUpdate = async (id, updates) => {
    try {
      await api.put(`/cases/${caseId}/requests/${id}`, updates);
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, width: 200 }} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input style={{ ...inputStyle, width: 250 }} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select style={{ ...inputStyle, width: 140 }} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="standard">Standard</option>
          <option value="deferred">Deferred</option>
        </select>
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Request'}</button>
      </form>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No attorney requests</p>
      ) : (
        <table>
          <thead><tr><th>Title</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.priority}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.status || 'open'}</td>
                <td>{formatDate(r.created_at)}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...inputStyle, width: 'auto' }} value={r.status || 'open'} onChange={(e) => handleUpdate(r.id, { status: e.target.value })}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select style={{ ...inputStyle, width: 'auto' }} value={r.priority || 'standard'} onChange={(e) => handleUpdate(r.id, { priority: e.target.value })}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="standard">Standard</option>
                    <option value="deferred">Deferred</option>
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
