import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useActiveCase } from '../../context/ActiveCaseContext';
import { useAuth } from '../../context/AuthContext';
import { api, API_URL } from '../../api/client';
import './casey.css';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TABS = [
  { key: 'gaps',        label: '🔍 Gap Analysis' },
  { key: 'defgaps',     label: '⚔️ Def. Deficiencies' },
  { key: 'supplements', label: '📊 Supplements' },
  { key: 'exhibits',    label: '📁 Exhibits' },
  { key: 'email',       label: '✉️ Client Email' },
  { key: 'deficiency',  label: '⚠️ Deficiency' },
  { key: 'motion',      label: '⚖️ Motion to Compel' },
  { key: 'privilege',   label: '🔒 Privilege Log' },
  { key: 'depo',        label: '🎙️ Depo Prep' },
  { key: 'subpoena',    label: '📜 Subpoena' },
];

export default function DiscoveryDashboard() {
  const { user } = useAuth();
  const { cases, activeCaseId, activeCase, selectCase, refreshCase } = useActiveCase();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [tab, setTab] = useState('gaps');
  const [allGaps, setAllGaps] = useState([]);
  const [missingGaps, setMissingGaps] = useState([]);
  const [insuffGaps, setInsuffGaps] = useState([]);
  const [confirmedGaps, setConfirmedGaps] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [exhibits, setExhibits] = useState([]);
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gapFilter, setGapFilter] = useState('all');
  const [openItems, setOpenItems] = useState({});
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  const loadData = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    Promise.all([
      api.get(`/discovery-workspace/${activeCaseId}/gaps`).catch(() => ({ gaps: [], missing: [], insufficient: [], confirmed: [] })),
      api.get(`/supplements/${activeCaseId}`).catch(() => []),
      api.get(`/exhibits/case/${activeCaseId}`).catch(() => []),
      api.get(`/deficiency-letters/${activeCaseId}`).catch(() => []),
    ]).then(([gapData, suppData, exhData, letterData]) => {
      setAllGaps(gapData.gaps || []);
      setMissingGaps(gapData.missing || []);
      setInsuffGaps(gapData.insufficient || []);
      setConfirmedGaps(gapData.confirmed || []);
      setSupplements(Array.isArray(suppData) ? suppData : []);
      setExhibits(Array.isArray(exhData) ? exhData : []);
      setLetters(Array.isArray(letterData) ? letterData : []);
    }).finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleGapAction = async (gapId, action) => {
    const body = action === 'confirmed' ? { gap_action: 'confirmed' }
      : action === 'objection' ? { gap_action: 'objection_applied' }
      : { gap_action: 'dismissed', status: 'waived' };
    await api.patch(`/discovery/gaps/${gapId}`, body).catch(() => {});
    showToast(action === 'confirmed' ? '✓ Gap confirmed' : action === 'objection' ? 'Objection applied' : 'Gap dismissed');
    loadData();
    refreshCase();
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !activeCaseId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('response_party', 'plaintiff');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/upload/${activeCaseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.id) await api.post(`/discovery/analyze/${data.id}`);
      showToast('✓ Analysis complete');
      loadData(); refreshCase();
      fileRef.current.value = '';
    } catch (err) { showToast('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  };

  const toggleItem = (id) => setOpenItems(p => ({ ...p, [id]: !p[id] }));

  // Computed from REAL API data
  const gapCount = allGaps.length;
  const openGapCount = allGaps.filter(g => g.status === 'open').length;
  const suppCount = supplements.filter(s => s.status !== 'closed').length;
  const overdueCount = supplements.filter(s => s.is_overdue).length;
  const exhCount = exhibits.length;
  const letterCount = letters.filter(l => l.status === 'draft').length;

  const filteredGaps = gapFilter === 'all' ? allGaps
    : gapFilter === 'missing' ? missingGaps
    : gapFilter === 'insufficient' ? insuffGaps
    : confirmedGaps;

  function badgeClass(g) {
    if (g.gap_type === 'no_answer' || g.gap_type === 'missing_document') return 'missing';
    if (g.gap_type === 'evasive_answer') return 'evasive';
    if (g.gap_type === 'objection_only') return 'objection';
    return 'insufficient';
  }
  function badgeLabel(g) {
    if (g.gap_type === 'no_answer' || g.gap_type === 'missing_document') return 'Missing';
    if (g.gap_type === 'evasive_answer') return 'Evasive';
    if (g.gap_type === 'objection_only') return 'Bad Objection';
    return 'Insufficient';
  }
  function reqLabel(g) {
    if (!g.request_type) return '';
    const p = g.request_type === 'interrogatory' ? 'Int' : g.request_type === 'rfp' ? 'RFP' : g.request_type === 'rfa' ? 'RFA' : g.request_type.toUpperCase();
    return `${p}. No. ${g.request_number || '?'}`;
  }

  const c = activeCase || {};
  const caseName = c.plaintiff_name || c.client_name || '';
  const caseNumber = c.case_number || '';

  function renderGapItem(g) {
    const isOpen = openItems[g.id];
    return (
      <div key={g.id} className={`gap-item${isOpen ? ' open' : ''}`}>
        <div className="gap-header" onClick={() => toggleItem(g.id)}>
          <span className={`gap-badge ${badgeClass(g)}`}>{badgeLabel(g)}</span>
          <span className="gap-interrogatory">{reqLabel(g)}</span>
          <span className="gap-question">{g.gap_description}</span>
          <span className="gap-chevron">▼</span>
        </div>
        {isOpen && (
          <div className="gap-body">
            {g.original_request_text && (<>
              <div className="gap-ai-label">Original Request</div>
              <div className="gap-ai-note">{g.original_request_text}</div>
            </>)}
            {g.response_received && (<>
              <div className="gap-ai-label">Response Received</div>
              <div className="gap-ai-note">{g.response_received}</div>
            </>)}
            {g.ai_reasoning && (<>
              <div className="gap-ai-label">AI Analysis</div>
              <div className="gap-ai-note">{g.ai_reasoning}</div>
            </>)}
            <div className="gap-actions">
              {g.gap_action === 'confirmed' ? (
                <span className="gap-status-confirmed">✓ Confirmed</span>
              ) : g.gap_action === 'dismissed' || g.status === 'waived' ? (
                <span className="gap-status-dismissed">Dismissed</span>
              ) : g.gap_action === 'objection_applied' ? (
                <span className="gap-status-compel">⚖️ Flagged for MTC</span>
              ) : (<>
                <button className="gap-action-btn confirm" onClick={() => handleGapAction(g.id, 'confirmed')}>✓ Confirm Gap</button>
                <button className="gap-action-btn" onClick={() => handleGapAction(g.id, 'objection')}>Apply Objection</button>
                <button className="gap-action-btn dismiss" onClick={() => handleGapAction(g.id, 'dismissed')}>✗ Dismiss</button>
              </>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="casey">
      <div className="c-app">

        {/* ══════ SIDEBAR — Casey's exact structure ══════ */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-word">First Chair</div>
            <div className="logo-sub">Discovery Intelligence</div>
          </div>
          <div className="sidebar-case">
            <div className="sidebar-case-label">Active Case</div>
            <div className="sidebar-case-name">{caseName || 'Select a case'}</div>
            <div className="sidebar-case-num">{caseNumber}</div>
            <select
              className="case-select"
              value={activeCaseId}
              onChange={e => selectCase(e.target.value)}
            >
              {cases.map(cs => (
                <option key={cs.id} value={cs.id}>{cs.case_number} — {cs.client_name}</option>
              ))}
            </select>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-label">Case</div>
            <NavLink to={activeCaseId ? `/cases/${activeCaseId}` : '/cases'} className="nav-item">
              <span className="nav-icon">📋</span> Case Detail
            </NavLink>
            <NavLink to={activeCaseId ? `/cases/${activeCaseId}?tab=deadlines` : '/cases'} className="nav-item">
              <span className="nav-icon">📅</span> Deadlines
            </NavLink>
            <NavLink to="/records" className="nav-item">
              <span className="nav-icon">📂</span> Records Tracker
            </NavLink>
            <div className="nav-section-label" style={{ marginTop: 8 }}>Discovery</div>
            <div className="nav-item active">
              <span className="nav-icon">🔍</span> Discovery Dashboard
              {openGapCount > 0 && <span className="nav-badge">{openGapCount}</span>}
            </div>
            <NavLink to="/discovery/supplements" className="nav-item">
              <span className="nav-icon">📊</span> Supplement Tracker
              {suppCount > 0 && <span className="nav-badge amber">{suppCount}</span>}
            </NavLink>
            <NavLink to="/discovery/exhibits" className="nav-item">
              <span className="nav-icon">📁</span> Exhibit Manager
            </NavLink>
            <NavLink to="/discovery/deficiency-letters" className="nav-item">
              <span className="nav-icon">⚠️</span> Deficiency Letters
              {letterCount > 0 && <span className="nav-badge amber">{letterCount}</span>}
            </NavLink>
            <div className="nav-section-label" style={{ marginTop: 8 }}>Firm</div>
            <NavLink to="/discovery-library" className="nav-item">
              <span className="nav-icon">📚</span> Discovery Library
            </NavLink>
            <NavLink to="/morning-brief" className="nav-item">
              <span className="nav-icon">🌅</span> Morning Brief
            </NavLink>
          </nav>
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', fontSize: 11 }}>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <div style={{ color: 'var(--text-3)', textTransform: 'capitalize', fontSize: 10 }}>{user?.role}</div>
          </div>
        </aside>

        {/* ══════ MAIN ══════ */}
        <div className="main">
          <header className="topbar">
            <div>
              <div className="topbar-title">Discovery Intelligence Dashboard</div>
              <div className="topbar-meta">{caseName} · {c.phase || c.status || 'Discovery'} · {caseNumber}</div>
            </div>
            <div className="topbar-actions">
              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                + Upload Response
              </button>
              <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,.docx,.txt,.doc" onChange={handleUpload} />
            </div>
          </header>

          <div className="content">
            {loading ? (
              <div className="empty-state"><span className="spinner" /> Loading...</div>
            ) : !activeCaseId ? (
              <div className="empty-state">Select a case to begin</div>
            ) : (<>

              {/* ── Summary Bar — 4 stat cards ── */}
              <div className="summary-bar">
                <div className="stat-card red">
                  <div className="stat-label">Open Gaps</div>
                  <div className="stat-value">{gapCount}</div>
                  <div className="stat-sub">{missingGaps.length} missing</div>
                </div>
                <div className="stat-card red" style={{ borderLeftColor: '#7c3aed' }}>
                  <div className="stat-label">Defendant Deficiencies</div>
                  <div className="stat-value">{allGaps.filter(g => g.gap_action === 'objection_applied').length}</div>
                  <div className="stat-sub">flagged for MTC</div>
                </div>
                <div className="stat-card amber">
                  <div className="stat-label">Pending Supplements</div>
                  <div className="stat-value">{suppCount}</div>
                  <div className="stat-sub">{overdueCount > 0 ? `${overdueCount} overdue` : 'None overdue'}</div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-label">Exhibits</div>
                  <div className="stat-value">{exhCount}</div>
                  <div className="stat-sub">{exhCount === 1 ? '1 file' : `${exhCount} files`}</div>
                </div>
              </div>

              {/* ── Tab Bar ── */}
              <div className="tab-bar">
                {TABS.map(t => {
                  let count = null;
                  if (t.key === 'gaps') count = gapCount;
                  if (t.key === 'supplements' && overdueCount > 0) count = overdueCount;
                  if (t.key === 'exhibits' && exhCount > 0) count = exhCount;
                  const countClass = t.key === 'supplements' ? 'amber' : t.key === 'exhibits' ? 'blue' : t.key === 'defgaps' ? 'purple' : '';
                  return (
                    <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                      {t.label}
                      {count > 0 && <span className={`tab-count${countClass ? ' ' + countClass : ''}`}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* ══ GAP ANALYSIS ══ */}
              {tab === 'gaps' && (
                <div>
                  <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                    <div className="upload-icon">📄</div>
                    <div className="upload-title">{uploading ? 'Analyzing…' : 'Upload Your Discovery Response'}</div>
                    <div className="upload-sub">AI flags gaps in your own responses</div>
                  </div>
                  <div className="filters-row">
                    <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>Filter:</span>
                    {[
                      { key: 'all', label: 'All', count: allGaps.length },
                      { key: 'missing', label: 'Missing', count: missingGaps.length },
                      { key: 'insufficient', label: 'Insufficient', count: insuffGaps.length },
                      { key: 'confirmed', label: 'Confirmed', count: confirmedGaps.length },
                    ].map(f => (
                      <button key={f.key} className={`filter-btn${gapFilter === f.key ? ' active' : ''}`} onClick={() => setGapFilter(f.key)}>
                        {f.label} <span style={{ opacity: .6 }}>{f.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="section-header">
                    <div className="section-title">
                      Response Gaps <span className="section-count">{filteredGaps.length} items</span>
                    </div>
                  </div>
                  {filteredGaps.length === 0 ? (
                    <div className="empty-state">No gaps found</div>
                  ) : filteredGaps.map(g => renderGapItem(g))}
                </div>
              )}

              {/* ══ DEFENDANT DEFICIENCIES ══ */}
              {tab === 'defgaps' && (
                <div>
                  <div className="section-header">
                    <div className="section-title">
                      Defendant's Response Deficiencies <span className="section-count">{allGaps.length} total gaps</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
                    Upload a defendant response in the Gap Analysis tab to flag their deficiencies separately. Currently showing all gaps for this case.
                  </p>
                  {allGaps.length === 0 ? (
                    <div className="empty-state">No gaps found. Upload a defendant response to analyze.</div>
                  ) : allGaps.map(g => (
                    <div key={g.id} className={`gap-item defendant-item${openItems[g.id] ? ' open' : ''}`}>
                      <div className="gap-header" onClick={() => toggleItem(g.id)}>
                        <span className={`gap-badge ${badgeClass(g)}`}>{badgeLabel(g)}</span>
                        <span className="source-tag defendant">Gap</span>
                        <span className="gap-interrogatory">{reqLabel(g)}</span>
                        <span className="gap-question">{g.gap_description}</span>
                        <span className="gap-chevron">▼</span>
                      </div>
                      {openItems[g.id] && (
                        <div className="gap-body">
                          {g.ai_reasoning && (<>
                            <div className="gap-ai-label">AI Analysis</div>
                            <div className="gap-ai-note">{g.ai_reasoning}</div>
                          </>)}
                          <div className="gap-actions">
                            {g.gap_action === 'objection_applied' ? (
                              <span className="gap-status-compel">⚖️ Flagged for Motion to Compel</span>
                            ) : g.gap_action === 'confirmed' ? (
                              <span className="gap-status-confirmed">✓ Noted</span>
                            ) : g.gap_action === 'dismissed' ? (
                              <span className="gap-status-dismissed">Dismissed</span>
                            ) : (<>
                              <button className="gap-action-btn compel" onClick={() => handleGapAction(g.id, 'objection')}>⚖️ Flag for MTC</button>
                              <button className="gap-action-btn confirm" onClick={() => handleGapAction(g.id, 'confirmed')}>✓ Note Deficiency</button>
                              <button className="gap-action-btn dismiss" onClick={() => handleGapAction(g.id, 'dismissed')}>✗ Dismiss</button>
                            </>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ══ SUPPLEMENTS ══ */}
              {tab === 'supplements' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Supplement Obligations <span className="section-count">{supplements.length} items</span></div>
                  </div>
                  {supplements.length === 0 ? (
                    <div className="empty-state">No supplement obligations yet.</div>
                  ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <table className="supp-table">
                        <thead><tr><th>Item</th><th>Date Added</th><th>Days</th><th>Status</th></tr></thead>
                        <tbody>
                          {supplements.map(s => (
                            <tr key={s.id}>
                              <td><strong>{s.response_file_name || 'Supplement'}</strong></td>
                              <td className="mono">{fmtDate(s.created_at)}</td>
                              <td className="mono" style={{ color: s.is_overdue ? 'var(--red)' : undefined, fontWeight: s.is_overdue ? 600 : undefined }}>
                                {s.days_outstanding || 0}d
                              </td>
                              <td>
                                <span className={`status-pill ${s.is_overdue ? 'overdue' : s.status === 'responded' ? 'received' : s.status === 'closed' ? 'closed' : 'pending'}`}>
                                  {s.is_overdue ? 'Overdue' : s.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ══ EXHIBITS ══ */}
              {tab === 'exhibits' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Exhibit Folders <span className="section-count">{exhibits.length} files</span></div>
                  </div>
                  {exhibits.length === 0 ? (
                    <div className="empty-state">No exhibits for this case yet.</div>
                  ) : (
                    <div className="exhibit-grid">
                      {exhibits.map(ex => (
                        <div key={ex.id} className="exhibit-folder">
                          {ex.exhibit_label && <span className="exhibit-folder-badge">{ex.exhibit_label}</span>}
                          <div className="exhibit-folder-icon">📁</div>
                          <div className="exhibit-folder-name">{ex.file_name || ex.exhibit_label || 'Exhibit'}</div>
                          <div className="exhibit-folder-meta">{ex.description || ''} · {fmtDate(ex.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ CLIENT EMAIL ══ */}
              {tab === 'email' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Client Email Generator</div>
                  </div>
                  <div className="empty-state">Confirm gaps in the Gap Analysis tab, then generate a client email.</div>
                </div>
              )}

              {/* ══ DEFICIENCY LETTERS ══ */}
              {tab === 'deficiency' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Deficiency Letters <span className="section-count">{letters.length} total</span></div>
                  </div>
                  {letters.length === 0 ? (
                    <div className="empty-state">No deficiency letters yet.</div>
                  ) : letters.map(l => (
                    <div key={l.id} className="deficiency-item">
                      <div className="deficiency-header">
                        <div>
                          <div className="deficiency-title">{l.request_type ? `${l.request_type} #${l.request_number}` : 'Deficiency Letter'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{fmtDate(l.created_at)}</div>
                        </div>
                        <span className={`status-pill ${l.status === 'sent' ? 'received' : l.status === 'cancelled' ? 'closed' : 'pending'}`}>{l.status}</span>
                      </div>
                      {l.gap_description && (
                        <div className="deficiency-items">
                          <div className="def-row">
                            <div className={`def-dot ${l.status === 'sent' ? 'green' : 'amber'}`} />
                            <div className="def-label">{l.gap_description}</div>
                            <div className="def-status">{l.status}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ══ MOTION TO COMPEL ══ */}
              {tab === 'motion' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Motion to Compel Generator</div>
                  </div>
                  <div className="empty-state">Flag defendant deficiencies for MTC in the Def. Deficiencies tab first.</div>
                </div>
              )}

              {/* ══ PRIVILEGE LOG ══ */}
              {tab === 'privilege' && <div className="empty-state">Privilege log — coming soon</div>}

              {/* ══ DEPO PREP ══ */}
              {tab === 'depo' && <div className="empty-state">Deposition prep — coming soon</div>}

              {/* ══ SUBPOENA ══ */}
              {tab === 'subpoena' && (
                <div>
                  <div className="section-header" style={{ marginBottom: 16 }}>
                    <div className="section-title">Subpoena Generator</div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/subpoena-manager')}>Open Subpoena Manager</button>
                  </div>
                  <div className="empty-state">Use the Subpoena Manager for full generation and tracking.</div>
                </div>
              )}

            </>)}
          </div>
        </div>
      </div>

      {toast && <div className="toast" style={{ transform: 'translateY(0)', opacity: 1 }}>{toast}</div>}
    </div>
  );
}
