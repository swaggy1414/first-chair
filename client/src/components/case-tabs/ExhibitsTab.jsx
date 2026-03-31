import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { btnPrimary, btnSecondary } from './styles';

const EXHIBIT_CATEGORIES = ['Medical Records', 'Police Report', 'Photos', 'Bills and Invoices', 'Correspondence', 'Expert Reports', 'Deposition', 'Other'];

const categoryBadge = (cat) => {
  const colors = {
    'Medical Records': '#38A169', 'Police Report': '#2A6DB5', 'Photos': '#805AD5',
    'Bills and Invoices': '#D69E2E', 'Correspondence': '#718096', 'Expert Reports': '#DD6B20',
    'Deposition': '#E53E3E', 'Other': '#A0AEC0',
  };
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem',
    fontWeight: 600, color: '#fff', background: colors[cat] || '#A0AEC0',
  };
};

export default function ExhibitsTab({ caseId }) {
  const [exhibits, setExhibits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(null);

  const load = useCallback(() => {
    api.get(`/exhibits/case/${caseId}`)
      .then((res) => setExhibits(Array.isArray(res) ? res : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/exhibits/upload/${caseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleReclassify = async (id) => {
    setClassifying(id);
    try {
      await api.post(`/exhibits/classify/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setClassifying(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/exhibits/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCategoryChange = async (id, category) => {
    try {
      await api.put(`/exhibits/${id}`, { category });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading exhibits...</p>;

  return (
    <div>
      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Exhibits ({exhibits.length})</h3>
        <label style={{ ...btnPrimary, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {exhibits.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No exhibits uploaded yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>File</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>AI Summary</th>
              <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>Confidence</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>Size</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exhibits.map((ex) => (
              <tr key={ex.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600 }}>{ex.file_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {ex.uploaded_by_name} &middot; {new Date(ex.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={ex.category || 'Other'}
                    onChange={(e) => handleCategoryChange(ex.id, e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: 4, border: '1px solid var(--border)' }}
                  >
                    {EXHIBIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-light)', maxWidth: 250 }}>
                  {ex.ai_summary || '\u2014'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {ex.ai_confidence != null ? (
                    <span style={categoryBadge(ex.ai_confidence >= 70 ? 'Medical Records' : ex.ai_confidence >= 40 ? 'Bills and Invoices' : 'Other')}>
                      {ex.ai_confidence}%
                    </span>
                  ) : '\u2014'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  {formatSize(ex.file_size)}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleReclassify(ex.id)}
                    disabled={classifying === ex.id}
                    style={{ ...btnSecondary, marginRight: 6, fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    {classifying === ex.id ? 'Classifying...' : 'Re-classify'}
                  </button>
                  <button
                    onClick={() => handleDelete(ex.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
