import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { inputStyle, btnPrimary } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TreatmentTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider_name: '', treatment_type: '', treatment_date: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/treatments?case_id=${caseId}`)
      .then((res) => setItems(Array.isArray(res) ? res : res.treatments || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/treatments', { ...form, case_id: caseId });
      setForm({ provider_name: '', treatment_type: '', treatment_date: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/treatments/${id}`, { status });
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, width: 200 }} placeholder="Provider" value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} required />
        <input style={{ ...inputStyle, width: 200 }} placeholder="Treatment type" value={form.treatment_type} onChange={(e) => setForm({ ...form, treatment_type: e.target.value })} required />
        <input style={{ ...inputStyle, width: 160 }} type="date" value={form.treatment_date} onChange={(e) => setForm({ ...form, treatment_date: e.target.value })} />
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Treatment'}</button>
      </form>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No treatments</p>
      ) : (
        <table>
          <thead><tr><th>Provider</th><th>Type</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.provider_name}</td>
                <td>{t.treatment_type}</td>
                <td>{formatDate(t.treatment_date)}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.status || 'ongoing'}</td>
                <td>
                  <select style={{ ...inputStyle, width: 'auto' }} value={t.status || 'ongoing'} onChange={(e) => handleStatus(t.id, e.target.value)}>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="discharged">Discharged</option>
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
