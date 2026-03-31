import { useState, useEffect } from 'react';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

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

const btnSecondary = {
  padding: '8px 18px',
  background: 'var(--light-gray)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-light)',
  marginBottom: 4,
};

const categories = ['General Objections', 'Interrogatory Objections', 'RFA Objections', 'RPD Objections', 'Privilege', 'Other'];

const categoryBadge = (cat) => {
  const colors = {
    'General Objections': '#2A6DB5', 'Interrogatory Objections': '#805AD5',
    'RFA Objections': '#DD6B20', 'RPD Objections': '#38A169',
    'Privilege': '#E53E3E', 'Other': '#718096',
  };
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem',
    fontWeight: 600, color: '#fff', background: colors[cat] || '#718096',
  };
};

export default function DiscoveryLibrary() {
  const { user } = useAuth();
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [addForm, setAddForm] = useState({ title: '', objection_text: '', category: 'General Objections' });
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [activeSection, setActiveSection] = useState('objections');

  const canImport = user?.role === 'admin' || user?.role === 'supervisor';
  const canDeleteLibrary = ['admin', 'supervisor', 'paralegal'].includes(user?.role);

  const loadObjections = () => {
    const query = filterCategory ? `/objections?category=${encodeURIComponent(filterCategory)}` : '/objections';
    api.get(query)
      .then((res) => setObjections(Array.isArray(res) ? res : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadLibrary = () => {
    api.get('/discovery-library')
      .then((res) => setLibraryEntries(Array.isArray(res) ? res : []))
      .catch(() => setLibraryEntries([]));
  };

  useEffect(() => { loadObjections(); loadLibrary(); }, [filterCategory]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg('Importing...');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/objections/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(err.message || 'Import failed');
      }
      const data = await res.json();
      setImportMsg(`${data.imported} objections imported, ${data.skipped} skipped`);
      loadObjections();
      setTimeout(() => setImportMsg(''), 5000);
    } catch (err) {
      setImportMsg(err.message);
    }
    e.target.value = '';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/objections', addForm);
      setAddForm({ title: '', objection_text: '', category: 'General Objections' });
      setShowAddForm(false);
      loadObjections();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this objection?')) return;
    try {
      await api.del(`/objections/${id}`);
      loadObjections();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteLibraryEntry = async (id) => {
    if (!window.confirm('Remove this entry from the library?')) return;
    try {
      await api.del(`/discovery-library/${id}`);
      loadLibrary();
    } catch (err2) { setError(err2.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Discovery Library</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canImport && (
            <label style={btnPrimary}>
              Import .docx
              <input type="file" accept=".docx" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          )}
          <button style={btnSecondary} onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add Objection'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}
      {importMsg && <div style={{ background: importMsg.includes('imported') ? '#C6F6D5' : 'var(--light-gray)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{importMsg}</div>}

      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
        <button
          onClick={() => setActiveSection('objections')}
          style={{ padding: '10px 20px', fontSize: '0.9rem', fontWeight: activeSection === 'objections' ? 600 : 400, color: activeSection === 'objections' ? 'var(--blue)' : 'var(--text-light)', background: 'none', border: 'none', borderBottom: activeSection === 'objections' ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer' }}
        >
          Objections ({objections.length})
        </button>
        <button
          onClick={() => setActiveSection('responses')}
          style={{ padding: '10px 20px', fontSize: '0.9rem', fontWeight: activeSection === 'responses' ? 600 : 400, color: activeSection === 'responses' ? 'var(--blue)' : 'var(--text-light)', background: 'none', border: 'none', borderBottom: activeSection === 'responses' ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer' }}
        >
          Response Library ({libraryEntries.length})
        </button>
      </div>

      {activeSection === 'responses' && (
        <div>
          {libraryEntries.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No discovery responses in library. Responses are auto-added when a case phase is set to closed.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Case #</th><th>Client</th><th>Type</th><th>Responding Party</th><th>File</th><th>Counts</th><th>Notes</th><th></th></tr>
              </thead>
              <tbody>
                {libraryEntries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.case_number}</td>
                    <td>{e.client_name}</td>
                    <td>{e.incident_type}</td>
                    <td>{e.responding_party || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{e.file_name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>I:{e.interrogatory_count} R:{e.rfa_count} P:{e.rpd_count}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{e.notes}</td>
                    <td>
                      {canDeleteLibrary && (
                        <button onClick={() => handleDeleteLibraryEntry(e.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.8rem', cursor: 'pointer' }}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeSection === 'objections' && showAddForm && (
        <form onSubmit={handleAdd} style={{ background: 'var(--light-gray)', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input style={{ ...inputStyle, width: 200 }} value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select style={{ ...inputStyle, width: 200 }} value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Objection Text</label>
            <textarea style={{ ...inputStyle, width: '100%', minHeight: 80, resize: 'vertical' }} value={addForm.objection_text} onChange={(e) => setAddForm({ ...addForm, objection_text: e.target.value })} required />
          </div>
          <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Save Objection'}</button>
        </form>
      )}

      {activeSection === 'objections' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button style={filterCategory === '' ? btnPrimary : btnSecondary} onClick={() => setFilterCategory('')}>All ({objections.length})</button>
            {categories.map((c) => (
              <button key={c} style={filterCategory === c ? btnPrimary : btnSecondary} onClick={() => setFilterCategory(c)}>
                {c}
              </button>
            ))}
          </div>

          {objections.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No objections in library. Import a Word document or add manually.</p>
          ) : (
            <div>
              {objections.map((o) => (
                <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{o.title}</span>
                      <span style={categoryBadge(o.category)}>{o.category}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'capitalize' }}>{o.source}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Used: {o.use_count}</span>
                      {user?.role === 'admin' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.8rem', cursor: 'pointer' }}>Delete</button>
                      )}
                    </div>
                  </div>
                  {expandedId === o.id && (
                    <div style={{ marginTop: 12, padding: 14, background: 'var(--light-gray)', borderRadius: 6, fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {o.objection_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
