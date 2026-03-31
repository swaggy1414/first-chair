import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { inputStyle, btnPrimary, btnSecondary, fieldGroup, labelStyle } from './styles';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InfoTab({ caseData, onSave }) {
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

  // Close case modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeDraft, setCloseDraft] = useState(null);
  const [closeDraftLoading, setCloseDraftLoading] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError, setCloseError] = useState('');

  useEffect(() => {
    setForm({
      client_name: caseData.client_name || '',
      client_phone: caseData.client_phone || '',
      client_email: caseData.client_email || '',
      incident_type: caseData.incident_type || '',
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
    // Read phase directly from the dropdown to avoid React state timing issues
    const phaseEl = document.getElementById('phase-select');
    const currentPhase = phaseEl ? phaseEl.value : form.phase;
    if (currentPhase === 'closed') {
      setCloseDraftLoading(true);
      setShowCloseModal(true);
      try {
        const res = await api.post(`/knowledge/draft/${caseData.id}`);
        setCloseDraft({
          outcome: res.draft?.outcome || '',
          settlement_amount: '',
          incident_type: res.draft?.incident_type || caseData.incident_type || '',
          injury_types: res.draft?.injury_types || '',
          liability_factors: res.draft?.liability_factors || '',
          duration_days: res.draft?.duration_days || '',
          lessons_learned: res.draft?.lessons_learned || '',
        });
      } catch {
        setCloseDraft({
          outcome: '', settlement_amount: '', incident_type: caseData.incident_type || '',
          injury_types: '', liability_factors: '', duration_days: '', lessons_learned: '',
        });
      } finally {
        setCloseDraftLoading(false);
      }
      return;
    }
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

  const handleConfirmClose = async () => {
    setCloseSubmitting(true);
    setCloseError('');
    try {
      // 1. Save knowledge base entry
      await api.post('/knowledge', {
        case_id: caseData.id,
        incident_type: closeDraft.incident_type,
        injury_types: closeDraft.injury_types,
        liability_factors: closeDraft.liability_factors,
        outcome: closeDraft.outcome,
        settlement_amount: closeDraft.settlement_amount || null,
        duration_days: closeDraft.duration_days || null,
        lessons_learned: closeDraft.lessons_learned,
      });
      // 2. Save case with phase=closed (this triggers discovery library copy on server)
      await api.put(`/cases/${caseData.id}`, form);
      setShowCloseModal(false);
      setCloseDraft(null);
      setCloseError('');
      setMsg('Case closed and knowledge saved');
      if (onSave) onSave();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setCloseError(err.message);
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleCancelClose = () => {
    setShowCloseModal(false);
    setCloseDraft(null);
    setCloseError('');
    // Revert phase back to what it was
    setForm({ ...form, phase: caseData.phase || 'active' });
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
        <div style={fieldGroup}><label style={labelStyle}>Case Type</label><input style={inputStyle} value={form.incident_type || ''} onChange={set('incident_type')} disabled={!canEdit} /></div>
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
          <select id="phase-select" style={inputStyle} value={form.phase || 'active'} onChange={set('phase')} disabled={!canEdit}>
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

      {/* Close Case Modal */}
      {showCloseModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: 28, maxWidth: 640, width: '90%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)' }}>Close Case — Knowledge Base Entry</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 20 }}>Review the AI-drafted knowledge entry before closing this case. Edit any field as needed.</p>
            {closeError && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{closeError}</div>}
            {closeDraftLoading ? (
              <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>AI is drafting knowledge entry...</p>
            ) : closeDraft ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Outcome</label>
                    <select style={inputStyle} value={closeDraft.outcome} onChange={(e) => setCloseDraft({ ...closeDraft, outcome: e.target.value })}>
                      <option value="">Select outcome...</option>
                      <option value="settled">Settled</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="verdict">Verdict</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Settlement Amount</label>
                    <input style={inputStyle} type="number" placeholder="Optional" value={closeDraft.settlement_amount} onChange={(e) => setCloseDraft({ ...closeDraft, settlement_amount: e.target.value })} />
                  </div>
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Incident Type</label>
                    <input style={inputStyle} value={closeDraft.incident_type} onChange={(e) => setCloseDraft({ ...closeDraft, incident_type: e.target.value })} />
                  </div>
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Duration (days)</label>
                    <input style={inputStyle} type="number" value={closeDraft.duration_days} onChange={(e) => setCloseDraft({ ...closeDraft, duration_days: e.target.value })} />
                  </div>
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Injury Types</label>
                  <input style={inputStyle} value={closeDraft.injury_types} onChange={(e) => setCloseDraft({ ...closeDraft, injury_types: e.target.value })} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Key Liability Factors</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={closeDraft.liability_factors} onChange={(e) => setCloseDraft({ ...closeDraft, liability_factors: e.target.value })} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Lessons Learned</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={closeDraft.lessons_learned} onChange={(e) => setCloseDraft({ ...closeDraft, lessons_learned: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="button" onClick={handleCancelClose} disabled={closeSubmitting} style={btnSecondary}>Cancel</button>
                  <button type="button" onClick={handleConfirmClose} disabled={closeSubmitting || !closeDraft.outcome} style={{ ...btnPrimary, background: closeDraft.outcome ? 'var(--blue)' : '#ccc' }}>
                    {closeSubmitting ? 'Closing...' : 'Confirm and Close Case'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
