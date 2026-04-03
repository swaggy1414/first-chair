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

  // Opposing counsel state
  const [opposingCounsel, setOpposingCounsel] = useState([]);
  const [ocProfile, setOcProfile] = useState(null);
  const [ocProfileLoading, setOcProfileLoading] = useState(false);
  const [ocSearch, setOcSearch] = useState('');
  const [ocSearchResults, setOcSearchResults] = useState([]);
  const [showOcSearch, setShowOcSearch] = useState(false);

  // Judge state
  const [judges, setJudges] = useState([]);
  const [judgeProfile, setJudgeProfile] = useState(null);
  const [judgeProfileLoading, setJudgeProfileLoading] = useState(false);
  const [judgeSearch, setJudgeSearch] = useState('');
  const [judgeSearchResults, setJudgeSearchResults] = useState([]);
  const [showJudgeSearch, setShowJudgeSearch] = useState(false);

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
      filevine_project_id: caseData.filevine_project_id || '',
      notes: caseData.notes || '',
    });
  }, [caseData]);

  // Fetch opposing counsel for this case
  const loadOpposingCounsel = useCallback(() => {
    if (!caseData.id) return;
    api.get(`/opposing-counsel/by-case/${caseData.id}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setOpposingCounsel(list);
        // Auto-load first counsel's profile
        if (list.length > 0 && !ocProfile) {
          setOcProfileLoading(true);
          api.get(`/opposing-counsel/${list[0].id}/profile`)
            .then(setOcProfile)
            .catch(() => {})
            .finally(() => setOcProfileLoading(false));
        }
      })
      .catch(() => setOpposingCounsel([]));
  }, [caseData.id]);

  useEffect(() => { loadOpposingCounsel(); }, [loadOpposingCounsel]);

  // Fetch judges for this case
  const loadJudges = useCallback(() => {
    if (!caseData.id) return;
    api.get(`/judges/by-case/${caseData.id}`)
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setJudges(list);
        if (list.length > 0 && !judgeProfile) {
          setJudgeProfileLoading(true);
          api.get(`/judges/${list[0].id}/profile`)
            .then(setJudgeProfile)
            .catch(() => {})
            .finally(() => setJudgeProfileLoading(false));
        }
      })
      .catch(() => setJudges([]));
  }, [caseData.id]);

  useEffect(() => { loadJudges(); }, [loadJudges]);

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

  const handleOcSearch = async (q) => {
    setOcSearch(q);
    if (q.length < 2) { setOcSearchResults([]); return; }
    try {
      const res = await api.get(`/opposing-counsel/search?q=${encodeURIComponent(q)}`);
      setOcSearchResults(Array.isArray(res) ? res : []);
    } catch { setOcSearchResults([]); }
  };

  const handleLinkOc = async (ocId) => {
    try {
      await api.post('/opposing-counsel/link', { case_id: caseData.id, opposing_counsel_id: ocId });
      setShowOcSearch(false);
      setOcSearch('');
      setOcSearchResults([]);
      setOcProfile(null);
      loadOpposingCounsel();
    } catch {}
  };

  const handleUnlinkOc = async (ocId) => {
    try {
      await api.del(`/opposing-counsel/unlink?case_id=${caseData.id}&opposing_counsel_id=${ocId}`);
      setOcProfile(null);
      loadOpposingCounsel();
    } catch {}
  };

  const handleViewOcProfile = async (ocId) => {
    setOcProfileLoading(true);
    try {
      const res = await api.get(`/opposing-counsel/${ocId}/profile`);
      setOcProfile(res);
    } catch {} finally { setOcProfileLoading(false); }
  };

  const handleJudgeSearch = async (q) => {
    setJudgeSearch(q);
    if (q.length < 2) { setJudgeSearchResults([]); return; }
    try {
      const res = await api.get(`/judges/search?q=${encodeURIComponent(q)}`);
      setJudgeSearchResults(Array.isArray(res) ? res : []);
    } catch { setJudgeSearchResults([]); }
  };

  const handleLinkJudge = async (judgeId) => {
    try {
      await api.post('/judges/link', { case_id: caseData.id, judge_id: judgeId });
      setShowJudgeSearch(false);
      setJudgeSearch('');
      setJudgeSearchResults([]);
      setJudgeProfile(null);
      loadJudges();
    } catch {}
  };

  const handleUnlinkJudge = async (judgeId) => {
    try {
      await api.del(`/judges/unlink?case_id=${caseData.id}&judge_id=${judgeId}`);
      setJudgeProfile(null);
      loadJudges();
    } catch {}
  };

  const handleViewJudgeProfile = async (judgeId) => {
    setJudgeProfileLoading(true);
    try {
      const res = await api.get(`/judges/${judgeId}/profile`);
      setJudgeProfile(res);
    } catch {} finally { setJudgeProfileLoading(false); }
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
        <div style={fieldGroup}>
          <label style={labelStyle}>Filevine Project ID</label>
          <input style={inputStyle} value={form.filevine_project_id || ''} onChange={set('filevine_project_id')} disabled={!canEdit} placeholder="Optional — enables Filevine import" />
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

      {/* Opposing Counsel Section */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
            Opposing Counsel
          </h3>
          {canEdit && (
            <button style={{ ...btnPrimary, padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => setShowOcSearch(!showOcSearch)}>
              {showOcSearch ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>

        {showOcSearch && (
          <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <input style={inputStyle} placeholder="Search by name or firm..." value={ocSearch} onChange={(e) => handleOcSearch(e.target.value)} />
            {ocSearchResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {ocSearchResults.filter(r => !opposingCounsel.some(oc => oc.id === r.id)).map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.85rem' }}>{r.name} — {r.firm_name}</span>
                    <button style={{ ...btnPrimary, padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => handleLinkOc(r.id)}>Link</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {opposingCounsel.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No opposing counsel assigned</p>
        ) : (
          opposingCounsel.map((oc) => (
            <div key={oc.id} style={{ background: 'var(--light-gray)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{oc.name}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginLeft: 8 }}>{oc.firm_name}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...btnPrimary, padding: '3px 10px', fontSize: '0.78rem', background: 'var(--navy)' }} onClick={() => handleViewOcProfile(oc.id)}>
                    View Profile
                  </button>
                  {canEdit && (
                    <button style={{ padding: '3px 10px', fontSize: '0.78rem', background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleUnlinkOc(oc.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', display: 'flex', gap: 16 }}>
                {oc.email && <span>{oc.email}</span>}
                {oc.phone && <span>{oc.phone}</span>}
                {oc.state_bar_number && <span>Bar: {oc.state_bar_number}</span>}
              </div>
            </div>
          ))
        )}

        {/* Opposing Counsel Profile Panel */}
        {ocProfileLoading && <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Loading profile...</p>}
        {ocProfile && !ocProfileLoading && (
          <div style={{ background: '#EBF5FF', borderRadius: 8, padding: 16, marginTop: 10, border: '1px solid rgba(42,109,181,0.2)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', marginTop: 0, marginBottom: 10 }}>
              Profile: {ocProfile.counsel?.name}
            </h4>

            {ocProfile.behavior_summary && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
                {ocProfile.behavior_summary}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)' }}>{ocProfile.stats?.total_cases || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Cases</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--green)' }}>{ocProfile.stats?.settled || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Settled</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--blue)' }}>{ocProfile.stats?.avg_settlement ? '$' + Number(ocProfile.stats.avg_settlement).toLocaleString() : 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Avg Settlement</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{ocProfile.stats?.avg_duration_days ? ocProfile.stats.avg_duration_days + 'd' : 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Avg Duration</div>
              </div>
            </div>

            {ocProfile.discovery_patterns && ocProfile.discovery_patterns.total_gaps > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Discovery Behavior</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  {ocProfile.discovery_patterns.total_gaps} gaps found: {ocProfile.discovery_patterns.evasive_answers} evasive, {ocProfile.discovery_patterns.objection_only} objection-only, {ocProfile.discovery_patterns.no_answer} no-answer
                </div>
              </div>
            )}

            {ocProfile.cases && ocProfile.cases.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Case History</div>
                {ocProfile.cases.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-light)', padding: '3px 0' }}>
                    {c.case_number} — {c.client_name} ({c.incident_type}) — {c.outcome || c.status}
                    {c.settlement_amount ? ` — $${Number(c.settlement_amount).toLocaleString()}` : ''}
                  </div>
                ))}
              </div>
            )}

            <button style={{ marginTop: 8, fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 0 }} onClick={() => setOcProfile(null)}>
              Close Profile
            </button>
          </div>
        )}
      </div>

      {/* Judge Section */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
            Assigned Judge
          </h3>
          {canEdit && (
            <button style={{ ...btnPrimary, padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => setShowJudgeSearch(!showJudgeSearch)}>
              {showJudgeSearch ? 'Cancel' : '+ Add'}
            </button>
          )}
        </div>

        {showJudgeSearch && (
          <div style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <input style={inputStyle} placeholder="Search by judge name..." value={judgeSearch} onChange={(e) => handleJudgeSearch(e.target.value)} />
            {judgeSearchResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {judgeSearchResults.filter(r => !judges.some(j => j.id === r.id)).map((r) => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.85rem' }}>{r.name} — {r.court}</span>
                    <button style={{ ...btnPrimary, padding: '3px 10px', fontSize: '0.78rem' }} onClick={() => handleLinkJudge(r.id)}>Link</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {judges.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No judge assigned</p>
        ) : (
          judges.map((j) => (
            <div key={j.id} style={{ background: 'var(--light-gray)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{j.name}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginLeft: 8 }}>{j.court}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...btnPrimary, padding: '3px 10px', fontSize: '0.78rem', background: 'var(--navy)' }} onClick={() => handleViewJudgeProfile(j.id)}>
                    View Profile
                  </button>
                  {canEdit && (
                    <button style={{ padding: '3px 10px', fontSize: '0.78rem', background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, cursor: 'pointer' }} onClick={() => handleUnlinkJudge(j.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', display: 'flex', gap: 16 }}>
                {j.jurisdiction && <span>{j.jurisdiction}</span>}
                {j.county && <span>{j.county} County</span>}
                {j.state && <span>{j.state}</span>}
              </div>
            </div>
          ))
        )}

        {/* Judge Profile Panel */}
        {judgeProfileLoading && <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Loading profile...</p>}
        {judgeProfile && !judgeProfileLoading && (
          <div style={{ background: '#F0FFF4', borderRadius: 8, padding: 16, marginTop: 10, border: '1px solid rgba(56,161,105,0.2)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', marginTop: 0, marginBottom: 10 }}>
              Profile: {judgeProfile.judge?.name}
            </h4>

            {judgeProfile.behavior_summary && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 12, lineHeight: 1.5 }}>
                {judgeProfile.behavior_summary}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--navy)' }}>{judgeProfile.stats?.total_cases || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Cases</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--green)' }}>{judgeProfile.stats?.settled || 0}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Settled</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--blue)' }}>{judgeProfile.stats?.avg_settlement ? '$' + Number(judgeProfile.stats.avg_settlement).toLocaleString() : 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Avg Settlement</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{judgeProfile.stats?.avg_duration_days ? judgeProfile.stats.avg_duration_days + 'd' : 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Avg Duration</div>
              </div>
            </div>

            {judgeProfile.notes && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>{judgeProfile.notes}</div>
              </div>
            )}

            {judgeProfile.cases && judgeProfile.cases.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Case History</div>
                {judgeProfile.cases.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-light)', padding: '3px 0' }}>
                    {c.case_number} — {c.client_name} ({c.incident_type}) — {c.outcome || c.status}
                    {c.settlement_amount ? ` — $${Number(c.settlement_amount).toLocaleString()}` : ''}
                  </div>
                ))}
              </div>
            )}

            <button style={{ marginTop: 8, fontSize: '0.78rem', background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', padding: 0 }} onClick={() => setJudgeProfile(null)}>
              Close Profile
            </button>
          </div>
        )}
      </div>

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
