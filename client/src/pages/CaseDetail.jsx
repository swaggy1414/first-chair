import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const flagColors = { red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)' };

const tabNames = ['Info', 'Deadlines', 'Records', 'Requests', 'Contact Log', 'Treatment', 'Exhibits', 'Discovery'];

const tabBarStyle = {
  display: 'flex',
  borderBottom: '2px solid var(--border)',
  marginBottom: 24,
  gap: 0,
};

const tabStyle = (active) => ({
  padding: '10px 20px',
  fontSize: '0.9rem',
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--blue)' : 'var(--text-light)',
  borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
  marginBottom: -2,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: active ? 'var(--blue)' : 'transparent',
});

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
};

const btnSecondary = {
  padding: '8px 18px',
  background: 'var(--light-gray)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.85rem',
};

const btnDanger = {
  padding: '6px 14px',
  background: 'var(--red)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8rem',
};

const fieldGroup = { marginBottom: 16 };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', marginBottom: 4 };

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  const colors = {
    active: { bg: '#EBF5FF', color: 'var(--blue)' },
    intake: { bg: '#FEFCE8', color: 'var(--yellow)' },
    settled: { bg: '#F0FFF4', color: 'var(--green)' },
    closed: { bg: 'var(--light-gray)', color: 'var(--text-light)' },
    litigation: { bg: '#FFF5F5', color: 'var(--red)' },
  };
  const s = colors[status?.toLowerCase()] || colors.active;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem',
      fontWeight: 600, background: s.bg, color: s.color, textTransform: 'capitalize',
    }}>
      {status || 'Unknown'}
    </span>
  );
}

// ─── Info Tab ───
function InfoTab({ caseData, onSave }) {
  const { user } = useAuth();
  const canEdit = ['admin', 'supervisor', 'paralegal'].includes(user?.role);
  const canAddNotes = ['admin', 'supervisor', 'attorney'].includes(user?.role);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [questionnaireMsg, setQuestionnaireMsg] = useState('');

  // Similar Cases state
  const [similarCases, setSimilarCases] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(true);

  // Attorney Notes state
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteForm, setNoteForm] = useState({ note_text: '', note_type: 'general', is_private: false });
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  useEffect(() => {
    setForm({
      client_name: caseData.client_name || '',
      client_phone: caseData.client_phone || '',
      client_email: caseData.client_email || '',
      case_type: caseData.case_type || '',
      incident_date: caseData.incident_date?.slice(0, 10) || '',
      status: caseData.status || '',
      phase: caseData.phase || 'active',
      notes: caseData.notes || '',
    });
  }, [caseData]);

  // Fetch similar cases
  useEffect(() => {
    if (!caseData.id) return;
    api.get(`/knowledge/similar/${caseData.id}`)
      .then((res) => setSimilarCases(Array.isArray(res) ? res : res.similar || []))
      .catch(() => setSimilarCases([]))
      .finally(() => setSimilarLoading(false));
  }, [caseData.id]);

  // Fetch attorney notes
  const loadNotes = useCallback(() => {
    if (!caseData.id) return;
    api.get(`/attorney-notes/case/${caseData.id}`)
      .then((res) => setNotes(Array.isArray(res) ? res : res.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [caseData.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      await api.put(`/cases/${caseData.id}`, form);
      setMsg('Saved');
      if (onSave) onSave();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    setAddingNote(true);
    setNoteError('');
    try {
      await api.post('/attorney-notes', { case_id: caseData.id, ...noteForm });
      setNoteForm({ note_text: '', note_type: 'general', is_private: false });
      loadNotes();
    } catch (err) {
      setNoteError(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.del(`/attorney-notes/${noteId}`);
      loadNotes();
    } catch (err) {
      setNoteError(err.message);
    }
  };

  const canDeleteNote = (note) => {
    if (['admin', 'supervisor'].includes(user?.role)) return true;
    if (user?.role === 'attorney' && note.attorney_id === user?.id) return true;
    return false;
  };

  const noteTypeBadge = (type) => {
    const colors = { strategy: 'var(--blue)', risk: 'var(--red)', settlement: 'var(--green)', general: '#718096' };
    return {
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem',
      fontWeight: 600, color: '#fff', background: colors[type] || '#718096', marginRight: 6,
    };
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={fieldGroup}><label style={labelStyle}>Client Name</label><input style={inputStyle} value={form.client_name || ''} onChange={set('client_name')} disabled={!canEdit} /></div>
        <div style={fieldGroup}><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.client_phone || ''} onChange={set('client_phone')} disabled={!canEdit} /></div>
        <div style={fieldGroup}><label style={labelStyle}>Email</label><input style={inputStyle} value={form.client_email || ''} onChange={set('client_email')} disabled={!canEdit} /></div>
        <div style={fieldGroup}><label style={labelStyle}>Case Type</label><input style={inputStyle} value={form.case_type || ''} onChange={set('case_type')} disabled={!canEdit} /></div>
        <div style={fieldGroup}><label style={labelStyle}>Incident Date</label><input style={inputStyle} type="date" value={form.incident_date || ''} onChange={set('incident_date')} disabled={!canEdit} /></div>
        <div style={fieldGroup}><label style={labelStyle}>Status</label>
          <select style={inputStyle} value={form.status || ''} onChange={set('status')} disabled={!canEdit}>
            <option value="intake">Intake</option>
            <option value="active">Active</option>
            <option value="litigation">Litigation</option>
            <option value="settled">Settled</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div style={fieldGroup}><label style={labelStyle}>Phase</label>
          <select style={inputStyle} value={form.phase || 'active'} onChange={set('phase')} disabled={!canEdit}>
            <option value="active">Active</option>
            <option value="written_discovery">Written Discovery</option>
            <option value="deposition">Deposition</option>
            <option value="mediation">Mediation</option>
            <option value="trial">Trial</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>
      <div style={fieldGroup}>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} value={form.notes || ''} onChange={set('notes')} disabled={!canEdit} />
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          {form.phase === 'written_discovery' && (
            <button style={{ ...btnPrimary, background: 'var(--green)' }} onClick={async () => {
              setQuestionnaireMsg('');
              try {
                await api.post(`/questionnaires/send/${caseData.id}`);
                setQuestionnaireMsg('Questionnaire sent successfully');
                setTimeout(() => setQuestionnaireMsg(''), 3000);
              } catch (err) {
                setQuestionnaireMsg(err.message);
              }
            }}>Send Discovery Questionnaire</button>
          )}
          {msg && <span style={{ fontSize: '0.85rem', color: msg === 'Saved' ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
          {questionnaireMsg && <span style={{ fontSize: '0.85rem', color: questionnaireMsg.includes('success') ? 'var(--green)' : 'var(--red)' }}>{questionnaireMsg}</span>}
        </div>
      )}

      {/* Similar Cases Section */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 14 }}>
          Similar Cases — Based on incident type and injuries
        </h3>
        {similarLoading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Loading similar cases...</p>
        ) : similarCases.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No similar cases found in knowledge base</p>
        ) : (
          similarCases.map((sc, i) => (
            <div key={i} style={{ background: 'var(--light-gray)', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{sc.case_number || 'Case'}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>
                  {sc.similarity_score ? Math.round(sc.similarity_score * 100) + '% match' : ''}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                <strong>Outcome:</strong> {sc.outcome || '-'} | <strong>Settlement:</strong> {sc.settlement_amount ? '$' + Number(sc.settlement_amount).toLocaleString() : '-'} | <strong>Duration:</strong> {sc.duration_days ? sc.duration_days + ' days' : '-'}
              </div>
              {sc.lessons_learned && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                  <strong>Lessons:</strong> {sc.lessons_learned}
                </div>
              )}
              {sc.matched_factors && (
                <div style={{ fontSize: '0.78rem', color: 'var(--blue)', marginTop: 4 }}>
                  Matched: {Array.isArray(sc.matched_factors) ? sc.matched_factors.join(', ') : sc.matched_factors}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Attorney Notes Section */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 14 }}>Attorney Notes</h3>
        {noteError && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 12 }}>{noteError}</div>}
        {notesLoading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Loading notes...</p>
        ) : notes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No attorney notes yet</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} style={{ background: 'var(--light-gray)', borderRadius: 6, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy)' }}>{n.attorney_name || 'Attorney'}</span>
                <span style={noteTypeBadge(n.note_type)}>{n.note_type}</span>
                {n.is_private && <span style={{ ...noteTypeBadge('general'), background: '#4A5568' }}>private</span>}
                {canDeleteNote(n) && (
                  <button style={{ marginLeft: 'auto', padding: '2px 8px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleDeleteNote(n.id)}>Delete</button>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{n.note_text}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 4 }}>{formatDate(n.created_at)}</div>
            </div>
          ))
        )}

        {/* Add Note Form */}
        {canAddNotes && (
          <form onSubmit={handleAddNote} style={{ marginTop: 16, background: 'var(--light-gray)', borderRadius: 8, padding: 16 }}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Note</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={noteForm.note_text} onChange={(e) => setNoteForm({ ...noteForm, note_text: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={{ ...inputStyle, width: 'auto' }} value={noteForm.note_type} onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}>
                  <option value="general">General</option>
                  <option value="strategy">Strategy</option>
                  <option value="risk">Risk</option>
                  <option value="settlement">Settlement</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
                <input type="checkbox" id="is_private" checked={noteForm.is_private} onChange={(e) => setNoteForm({ ...noteForm, is_private: e.target.checked })} />
                <label htmlFor="is_private" style={{ fontSize: '0.85rem', color: 'var(--text)' }}>Private</label>
              </div>
              <button style={{ ...btnPrimary, marginTop: 16 }} type="submit" disabled={addingNote}>{addingNote ? 'Adding...' : 'Add Note'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Deadlines Tab ───
function DeadlinesTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', due_date: '', description: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/cases/${caseId}/deadlines`)
      .then((res) => setItems(Array.isArray(res) ? res : res.deadlines || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post(`/cases/${caseId}/deadlines`, form);
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
      await api.put(`/cases/${caseId}/deadlines/${id}`, { status: 'completed' });
      load();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.del(`/cases/${caseId}/deadlines/${id}`);
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

// ─── Records Tab ───
function RecordsTab({ caseId }) {
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

// ─── Requests Tab ───
function RequestsTab({ caseId }) {
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

// ─── Contact Log Tab ───
function ContactLogTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ contact_type: 'phone', direction: 'outgoing', summary: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/cases/${caseId}/contacts`)
      .then((res) => setItems(Array.isArray(res) ? res : res.contacts || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post(`/cases/${caseId}/contacts`, form);
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

// ─── Treatment Tab ───
function TreatmentTab({ caseId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider_name: '', treatment_type: '', treatment_date: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/cases/${caseId}/treatments`)
      .then((res) => setItems(Array.isArray(res) ? res : res.treatments || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post(`/cases/${caseId}/treatments`, form);
      setForm({ provider_name: '', treatment_type: '', treatment_date: '' });
      load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/cases/${caseId}/treatments/${id}`, { status });
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

// ─── Exhibits Tab ───
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

function ExhibitsTab({ caseId }) {
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
                  {ex.ai_summary || '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {ex.ai_confidence != null ? (
                    <span style={categoryBadge(ex.ai_confidence >= 70 ? 'Medical Records' : ex.ai_confidence >= 40 ? 'Bills and Invoices' : 'Other')}>
                      {ex.ai_confidence}%
                    </span>
                  ) : '—'}
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

// ─── Discovery Tab ───
const GAP_TYPE_LABELS = { missing_document: 'Missing Document', incomplete_answer: 'Incomplete Answer', no_answer: 'No Answer', evasive_answer: 'Evasive Answer', objection_only: 'Objection Only' };
const PRIORITY_COLORS = { high: 'var(--red)', medium: 'var(--yellow)', low: 'var(--green)' };
const GAP_STATUSES = ['open', 'client_notified', 'response_received', 'resolved', 'waived'];

function DiscoveryTab({ caseId }) {
  const [data, setData] = useState({ responses: [], gaps: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);

  const load = useCallback(() => {
    api.get(`/discovery/case/${caseId}/gaps`)
      .then((res) => setData({ responses: res.responses || [], gaps: res.gaps || [] }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.elements.file;
    const file = fileInput?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/discovery/upload/${caseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); throw new Error(err2.message || 'Upload failed'); }
      fileInput.value = '';
      load();
    } catch (err2) { setError(err2.message); }
    finally { setUploading(false); }
  };

  const handleAnalyze = async (responseId) => {
    setAnalyzing(responseId);
    try {
      await api.post(`/discovery/analyze/${responseId}`);
      load();
    } catch (err) { setError(err.message); }
    finally { setAnalyzing(null); }
  };

  const handleGenerateEmail = async (responseId) => {
    setGenerating(responseId);
    try {
      const result = await api.post(`/discovery/generate-email/${responseId}`);
      setEmailPreview(result);
    } catch (err) { setError(err.message); }
    finally { setGenerating(null); }
  };

  const handleDeleteResponse = async (responseId, fileName) => {
    if (!window.confirm(`Delete "${fileName}" and all associated gaps? This cannot be undone.`)) return;
    try {
      await api.del(`/discovery/response/${responseId}`);
      load();
    } catch (err2) { setError(err2.message); }
  };

  const handleGapUpdate = async (gapId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/discovery/gaps/${gapId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Update failed'); }
      load();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading discovery data...</p>;

  return (
    <div>
      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Discovery Responses ({data.responses.length})</h3>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="file" name="file" accept=".pdf,.doc,.docx,.txt" required style={{ fontSize: '0.85rem' }} />
          <button type="submit" disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      {data.responses.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No discovery responses uploaded yet</p>
      ) : (
        data.responses.map((resp) => {
          const respGaps = data.gaps.filter((g) => g.discovery_response_id === resp.id);
          const openGaps = respGaps.filter((g) => g.status === 'open');
          return (
            <div key={resp.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resp.file_name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>
                    {resp.responding_party || 'Party not set'} &middot; {resp.uploaded_by_name || ''} &middot; {new Date(resp.created_at).toLocaleDateString()}
                  </div>
                  {resp.status === 'complete' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 4 }}>
                      Interrogatories: {resp.interrogatory_count} &middot; RFAs: {resp.rfa_count} &middot; RPDs: {resp.rpd_count}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {resp.status === 'processing' && (
                    <button onClick={() => handleAnalyze(resp.id)} disabled={analyzing === resp.id} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>
                      {analyzing === resp.id ? 'Analyzing...' : 'Run AI Analysis'}
                    </button>
                  )}
                  {resp.status === 'complete' && openGaps.length > 0 && (
                    <button onClick={() => handleGenerateEmail(resp.id)} disabled={generating === resp.id} style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px' }}>
                      {generating === resp.id ? 'Generating...' : 'Generate Client Email'}
                    </button>
                  )}
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: resp.status === 'complete' ? 'var(--green)' : resp.status === 'error' ? 'var(--red)' : 'var(--yellow)' }}>
                    {resp.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteResponse(resp.id, resp.file_name)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '0.78rem', cursor: 'pointer', padding: '6px 8px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {respGaps.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Req #</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Gap</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Priority</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {respGaps.map((gap) => (
                      <tr key={gap.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', background: 'var(--light-gray)', fontWeight: 600 }}>
                            {GAP_TYPE_LABELS[gap.gap_type] || gap.gap_type}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>{gap.request_type?.toUpperCase()} #{gap.request_number}</td>
                        <td style={{ padding: '8px', fontSize: '0.8rem', maxWidth: 300 }}>{gap.gap_description}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[gap.priority] || '#ccc', display: 'inline-block' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={gap.status} onChange={(e) => handleGapUpdate(gap.id, { status: e.target.value })} style={{ padding: '3px 6px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--border)' }}>
                            {GAP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })
      )}

      {emailPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700 }}>Generated Client Email</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>{emailPreview.generated_email_text}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setEmailPreview(null)} style={btnSecondary}>Close</button>
              <button onClick={() => { navigator.clipboard.writeText(emailPreview.generated_email_text); }} style={btnPrimary}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CaseDetail ───
export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const loadCase = useCallback(() => {
    api.get(`/cases/${id}`)
      .then((res) => setCaseData(res.case || res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadCase(); }, [loadCase]);

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading case...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;
  if (!caseData) return <p style={{ color: 'var(--text-light)' }}>Case not found</p>;

  const renderTab = () => {
    switch (activeTab) {
      case 0: return <InfoTab caseData={caseData} onSave={loadCase} />;
      case 1: return <DeadlinesTab caseId={id} />;
      case 2: return <RecordsTab caseId={id} />;
      case 3: return <RequestsTab caseId={id} />;
      case 4: return <ContactLogTab caseId={id} />;
      case 5: return <TreatmentTab caseId={id} />;
      case 6: return <ExhibitsTab caseId={id} />;
      case 7: return <DiscoveryTab caseId={id} />;
      default: return null;
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: flagColors[caseData.flag] || 'var(--green)',
            display: 'inline-block',
          }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy)' }}>
            {caseData.case_number}
          </h1>
          <StatusBadge status={caseData.status} />
        </div>
        <p style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>
          {caseData.client_name}
          {caseData.case_type && <span> &mdash; {caseData.case_type}</span>}
        </p>
      </div>

      <div style={tabBarStyle}>
        {tabNames.map((name, i) => (
          <button key={name} style={tabStyle(activeTab === i)} onClick={() => setActiveTab(i)}>
            {name}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
