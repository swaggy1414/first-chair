import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { inputStyle, btnPrimary, btnSecondary, btnDanger } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DeadlinesTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', due_date: '', description: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/deadlines?case_id=${caseId}`)
      .then((res) => setItems(Array.isArray(res) ? res : res.deadlines || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/deadlines', { ...form, case_id: caseId });
      setForm({ title: '', due_date: '', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.put(`/deadlines/${id}`, { status: 'completed' });
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/deadlines/${id}`);
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, width: 200 }} placeholder="Deadline title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input style={{ ...inputStyle, width: 160 }} type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
        <input style={{ ...inputStyle, width: 250 }} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Deadline'}</button>
      </form>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No deadlines</p>
      ) : (
        <table>
          <thead><tr><th>Title</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{formatDate(d.due_date)}</td>
                <td><span style={{ textTransform: 'capitalize' }}>{d.status || 'pending'}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  {d.status !== 'completed' && <button style={btnSecondary} onClick={() => handleComplete(d.id)}>Complete</button>}
                  <button style={btnDanger} onClick={() => handleDelete(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
