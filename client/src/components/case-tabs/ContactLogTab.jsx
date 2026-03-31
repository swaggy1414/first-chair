import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { inputStyle, btnPrimary } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ContactLogTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ contact_type: 'phone', direction: 'outgoing', summary: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/contacts?case_id=${caseId}`)
      .then((res) => setItems(Array.isArray(res) ? res : res.contacts || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/contacts', { ...form, case_id: caseId });
      setForm({ contact_type: 'phone', direction: 'outgoing', summary: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select style={{ ...inputStyle, width: 140 }} value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })}>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="in_person">In Person</option>
          <option value="text">Text</option>
        </select>
        <select style={{ ...inputStyle, width: 140 }} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
        </select>
        <input style={{ ...inputStyle, width: 300 }} placeholder="Summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required />
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Entry'}</button>
      </form>
      {items.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No contact log entries</p>
      ) : (
        <div>
          {items.map((entry) => (
            <div key={entry.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize' }}>{entry.contact_type}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', textTransform: 'capitalize' }}>{entry.direction}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginLeft: 'auto' }}>{formatDate(entry.created_at)}</span>
              </div>
              <div style={{ fontSize: '0.9rem' }}>{entry.summary}</div>
              {entry.user_name && <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>by {entry.user_name}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
