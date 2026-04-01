import React, { useState, useEffect, useCallback } from 'react';
import { api, API_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { inputStyle, btnPrimary, btnSecondary, fieldGroup, labelStyle } from './styles';

const STATUS_COLORS = {
  not_requested: '#A0AEC0', requested: 'var(--blue)', received: 'var(--yellow)',
  negotiating: '#ED8936', resolved: 'var(--green)',
};

const CONFIDENCE_COLORS = { high: 'var(--green)', medium: 'var(--yellow)', low: 'var(--red)' };

const PLAN_TYPES = ['commercial', 'medicare', 'medicaid', 'erisa', 'other'];

const LIEN_STATUSES = ['not_requested', 'requested', 'received', 'negotiating', 'resolved'];

function SectionHeader({ title, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderBottom: '2px solid var(--border)', marginBottom: 16,
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)' }}>{title}</h3>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem',
      fontWeight: 600, color: '#fff', background: color,
    }}>
      {children}
    </span>
  );
}

export default function LiensTab({ caseId, caseData }) {
  const { user } = useAuth();
  const isAdmin = ['admin', 'supervisor'].includes(user?.role);

  // Section expand state
  const [sec1, setSec1] = useState(true);
  const [sec2, setSec2] = useState(true);
  const [sec3, setSec3] = useState(true);
  const [sec4, setSec4] = useState(true);

  // ── Section 1: Medical Records Analysis ──
  const [analyses, setAnalyses] = useState([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // ── Section 2: Liens ──
  const [liens, setLiens] = useState([]);
  const [liensLoading, setLiensLoading] = useState(true);
  const [expandedLien, setExpandedLien] = useState(null);
  const [lienForm, setLienForm] = useState({ health_plan_name: '', plan_type: 'commercial', lien_amount: '' });
  const [addingLien, setAddingLien] = useState(false);
  const [editLien, setEditLien] = useState({});
  const [generatedDoc, setGeneratedDoc] = useState(null);
  const [generatingDoc, setGeneratingDoc] = useState(null);

  // ── Section 3: Damages Chart ──
  const [damagesChart, setDamagesChart] = useState(null);
  const [damagesLoading, setDamagesLoading] = useState(false);

  // ── Section 4: Subrogation Directory ──
  const [subrogation, setSubrogation] = useState([]);
  const [subSearch, setSubSearch] = useState('');
  const [subLoading, setSubLoading] = useState(true);
  const [subForm, setSubForm] = useState({
    health_plan_name: '', plan_type: 'commercial', subrogation_company: '',
    contact_name: '', contact_phone: '', contact_email: '', mailing_address: '',
  });
  const [addingSub, setAddingSub] = useState(false);

  // ── Loaders ──
  const loadAnalyses = useCallback(() => {
    api.get(`/liens/analyses/${caseId}`)
      .then((res) => setAnalyses(Array.isArray(res) ? res : res.analyses || []))
      .catch((err) => setError(err.message))
      .finally(() => setAnalysesLoading(false));
  }, [caseId]);

  const loadLiens = useCallback(() => {
    api.get(`/liens/case/${caseId}`)
      .then((res) => setLiens(Array.isArray(res) ? res : res.liens || []))
      .catch((err) => setError(err.message))
      .finally(() => setLiensLoading(false));
  }, [caseId]);

  const loadDamagesChart = useCallback(() => {
    api.get(`/liens/damages-chart/${caseId}`)
      .then((res) => { if (res) setDamagesChart(res); })
      .catch(() => { /* no chart yet */ });
  }, [caseId]);

  const loadSubrogation = useCallback(() => {
    api.get('/liens/subrogation')
      .then((res) => setSubrogation(Array.isArray(res) ? res : res.entries || []))
      .catch(() => setSubrogation([]))
      .finally(() => setSubLoading(false));
  }, []);

  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);
  useEffect(() => { loadLiens(); }, [loadLiens]);
  useEffect(() => { loadDamagesChart(); }, [loadDamagesChart]);
  useEffect(() => { loadSubrogation(); }, [loadSubrogation]);

  // ── Section 1 Handlers ──
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
      const res = await fetch(`${API_URL}/liens/upload/${caseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) { const err2 = await res.json().catch(() => ({})); throw new Error(err2.message || 'Upload failed'); }
      fileInput.value = '';
      loadAnalyses();
    } catch (err2) { setError(err2.message); }
    finally { setUploading(false); }
  };

  const handleAnalyze = async (analysisId) => {
    setAnalyzing(analysisId);
    try {
      await api.post(`/liens/analyze/${analysisId}`);
      loadAnalyses();
    } catch (err) { setError(err.message); }
    finally { setAnalyzing(null); }
  };

  const handleToggleRelated = async (lineItemId, currentValue) => {
    try {
      await api.put(`/liens/line-item/${lineItemId}`, { is_related: !currentValue });
      loadAnalyses();
    } catch (err) { setError(err.message); }
  };

  const handleFilevineImport = async () => {
    setImporting(true);
    setError('');
    try {
      await api.post(`/filevine/sync/${caseId}`);
      loadAnalyses();
    } catch (err) { setError(err.message); }
    finally { setImporting(false); }
  };

  // ── Section 2 Handlers ──
  const handleAddLien = async (e) => {
    e.preventDefault();
    setAddingLien(true);
    setError('');
    try {
      await api.post('/liens', { case_id: caseId, ...lienForm, lien_amount: parseFloat(lienForm.lien_amount) || 0 });
      setLienForm({ health_plan_name: '', plan_type: 'commercial', lien_amount: '' });
      loadLiens();
    } catch (err) { setError(err.message); }
    finally { setAddingLien(false); }
  };

  const handleUpdateLien = async (lienId) => {
    try {
      await api.put(`/liens/${lienId}`, editLien);
      loadLiens();
    } catch (err) { setError(err.message); }
  };

  const handleGenerateDoc = async (lienId, docType) => {
    setGeneratingDoc(`${lienId}-${docType}`);
    try {
      const res = await api.post(`/liens/generate-${docType}/${lienId}`);
      setGeneratedDoc({ type: docType.toUpperCase(), text: res.generated_text || res.text || '' });
    } catch (err) { setError(err.message); }
    finally { setGeneratingDoc(null); }
  };

  // ── Section 3 Handlers ──
  const handleGenerateDamagesChart = async () => {
    setDamagesLoading(true);
    setError('');
    try {
      const res = await api.post(`/liens/damages-chart/${caseId}`);
      setDamagesChart(res);
    } catch (err) { setError(err.message); }
    finally { setDamagesLoading(false); }
  };

  // ── Section 4 Handlers ──
  const handleAddSubEntry = async (e) => {
    e.preventDefault();
    setAddingSub(true);
    setError('');
    try {
      await api.post('/liens/subrogation', subForm);
      setSubForm({
        health_plan_name: '', plan_type: 'commercial', subrogation_company: '',
        contact_name: '', contact_phone: '', contact_email: '', mailing_address: '',
      });
      loadSubrogation();
    } catch (err) { setError(err.message); }
    finally { setAddingSub(false); }
  };

  const filteredSub = subrogation.filter((s) => {
    const q = subSearch.toLowerCase();
    if (!q) return true;
    return (s.health_plan_name || '').toLowerCase().includes(q) ||
      (s.subrogation_company || '').toLowerCase().includes(q);
  });

  const fmt = (n) => n != null ? '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div>
      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      {/* ═══ SECTION 1: Medical Records Analysis ═══ */}
      <SectionHeader title="Medical Records Analysis" expanded={sec1} onToggle={() => setSec1(!sec1)} />
      {sec1 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="file" name="file" accept=".pdf,.doc,.docx,.txt,.csv" required style={{ fontSize: '0.85rem' }} />
              <button type="submit" disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.6 : 1 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
            {caseData?.filevine_project_id ? (
              <button onClick={handleFilevineImport} disabled={importing} style={{ ...btnSecondary, opacity: importing ? 0.6 : 1 }}>
                {importing ? 'Importing...' : 'Import from Filevine'}
              </button>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#A0AEC0' }}>Add Filevine Project ID in case settings to enable import</span>
            )}
          </div>

          {analysesLoading ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Loading analyses...</p>
          ) : analyses.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No medical records uploaded yet</p>
          ) : (
            analyses.map((a) => (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.file_name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: 10 }}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {a.status === 'processing' && (
                      <button onClick={() => handleAnalyze(a.id)} disabled={analyzing === a.id} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>
                        {analyzing === a.id ? 'Analyzing...' : 'Run AI Analysis'}
                      </button>
                    )}
                    <Badge color={a.status === 'complete' ? 'var(--green)' : a.status === 'error' ? 'var(--red)' : 'var(--yellow)'}>
                      {a.status}
                    </Badge>
                  </div>
                </div>

                {a.status === 'complete' && a.line_items && a.line_items.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['Date', 'Provider', 'Code', 'Description', 'Amount', 'Related', 'Confidence', 'Flag Reason'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.line_items.map((li) => (
                        <tr key={li.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px', fontSize: '0.8rem' }}>{li.service_date ? new Date(li.service_date).toLocaleDateString() : '-'}</td>
                          <td style={{ padding: '8px', fontSize: '0.8rem' }}>{li.provider || '-'}</td>
                          <td style={{ padding: '8px', fontSize: '0.8rem' }}>{li.code || '-'}</td>
                          <td style={{ padding: '8px', fontSize: '0.8rem', maxWidth: 200 }}>{li.description || '-'}</td>
                          <td style={{ padding: '8px', fontSize: '0.8rem' }}>{fmt(li.amount)}</td>
                          <td style={{ padding: '8px' }}>
                            <button
                              onClick={() => handleToggleRelated(li.id, li.is_related)}
                              style={{
                                padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                                border: 'none', cursor: 'pointer',
                                background: li.is_related ? '#C6F6D5' : '#FED7D7',
                                color: li.is_related ? 'var(--green)' : 'var(--red)',
                              }}
                            >
                              {li.is_related ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Badge color={CONFIDENCE_COLORS[li.confidence] || '#A0AEC0'}>{li.confidence || '-'}</Badge>
                          </td>
                          <td style={{ padding: '8px', fontSize: '0.78rem', color: 'var(--text-light)' }}>{li.flag_reason || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ SECTION 2: Liens Tracker ═══ */}
      <SectionHeader title="Liens Tracker" expanded={sec2} onToggle={() => setSec2(!sec2)} />
      {sec2 && (
        <div style={{ marginBottom: 32 }}>
          {/* Add Lien Form */}
          <form onSubmit={handleAddLien} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Health Plan</label>
              <input style={{ ...inputStyle, width: 200 }} value={lienForm.health_plan_name} onChange={(e) => setLienForm({ ...lienForm, health_plan_name: e.target.value })} required placeholder="Plan name" />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Type</label>
              <select style={{ ...inputStyle, width: 140 }} value={lienForm.plan_type} onChange={(e) => setLienForm({ ...lienForm, plan_type: e.target.value })}>
                {PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: '0.78rem' }}>Lien Amount</label>
              <input style={{ ...inputStyle, width: 130 }} type="number" step="0.01" value={lienForm.lien_amount} onChange={(e) => setLienForm({ ...lienForm, lien_amount: e.target.value })} required placeholder="0.00" />
            </div>
            <button type="submit" disabled={addingLien} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '8px 14px' }}>
              {addingLien ? 'Adding...' : 'Add Lien'}
            </button>
          </form>

          {liensLoading ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Loading liens...</p>
          ) : liens.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 30 }}>No liens tracked yet</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Health Plan', 'Type', 'Status', 'Lien Amount', 'Negotiated', 'Next Follow-Up', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liens.map((lien) => (
                  <React.Fragment key={lien.id}>
                    <tr
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expandedLien === lien.id ? 'var(--light-gray)' : 'transparent' }}
                      onClick={() => {
                        if (expandedLien === lien.id) { setExpandedLien(null); }
                        else { setExpandedLien(lien.id); setEditLien({ ...lien }); }
                      }}
                    >
                      <td style={{ padding: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{lien.health_plan_name}</td>
                      <td style={{ padding: '8px' }}><Badge color="var(--blue)">{lien.plan_type}</Badge></td>
                      <td style={{ padding: '8px' }}><Badge color={STATUS_COLORS[lien.status] || '#A0AEC0'}>{(lien.status || 'not_requested').replace(/_/g, ' ')}</Badge></td>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(lien.lien_amount)}</td>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{lien.negotiated_amount != null ? fmt(lien.negotiated_amount) : '-'}</td>
                      <td style={{ padding: '8px', fontSize: '0.8rem' }}>{lien.next_follow_up ? new Date(lien.next_follow_up).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--blue)', cursor: 'pointer' }}>{expandedLien === lien.id ? 'Collapse' : 'Expand'}</span>
                      </td>
                    </tr>
                    {expandedLien === lien.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: '16px 8px', background: 'var(--light-gray)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div style={fieldGroup}>
                              <label style={labelStyle}>Status</label>
                              <select style={inputStyle} value={editLien.status || 'not_requested'} onChange={(e) => setEditLien({ ...editLien, status: e.target.value })}>
                                {LIEN_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                              </select>
                            </div>
                            <div style={fieldGroup}>
                              <label style={labelStyle}>Negotiated Amount</label>
                              <input style={inputStyle} type="number" step="0.01" value={editLien.negotiated_amount || ''} onChange={(e) => setEditLien({ ...editLien, negotiated_amount: e.target.value })} />
                            </div>
                            <div style={fieldGroup}>
                              <label style={labelStyle}>Next Follow-Up</label>
                              <input style={inputStyle} type="date" value={editLien.next_follow_up?.slice(0, 10) || ''} onChange={(e) => setEditLien({ ...editLien, next_follow_up: e.target.value })} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => handleUpdateLien(lien.id)} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>Save Changes</button>
                            <button
                              onClick={() => handleGenerateDoc(lien.id, 'hipaa')}
                              disabled={generatingDoc === `${lien.id}-hipaa`}
                              style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px' }}
                            >
                              {generatingDoc === `${lien.id}-hipaa` ? 'Generating...' : 'Generate HIPAA'}
                            </button>
                            <button
                              onClick={() => handleGenerateDoc(lien.id, 'lor')}
                              disabled={generatingDoc === `${lien.id}-lor`}
                              style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px' }}
                            >
                              {generatingDoc === `${lien.id}-lor` ? 'Generating...' : 'Generate LOR'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ SECTION 3: Damages Chart ═══ */}
      <SectionHeader title="Damages Chart" expanded={sec3} onToggle={() => setSec3(!sec3)} />
      {sec3 && (
        <div style={{ marginBottom: 32 }}>
          <button onClick={handleGenerateDamagesChart} disabled={damagesLoading} style={{ ...btnPrimary, marginBottom: 16, opacity: damagesLoading ? 0.6 : 1 }}>
            {damagesLoading ? 'Generating...' : 'Generate Damages Chart'}
          </button>

          {damagesChart && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Medical Bills', value: fmt(damagesChart.total_medical_bills) },
                  { label: 'Related Medical Bills', value: fmt(damagesChart.related_medical_bills) },
                  { label: 'Unrelated', value: fmt(damagesChart.unrelated_medical_bills), strike: true },
                  { label: 'Lien Total', value: fmt(damagesChart.lien_total) },
                  { label: 'Negotiated Lien Total', value: fmt(damagesChart.negotiated_lien_total) },
                ].map((item) => (
                  <div key={item.label} style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', textDecoration: item.strike ? 'line-through' : 'none' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {damagesChart.line_items && damagesChart.line_items.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Provider', 'Date Range', 'Total Billed', 'Related Amount', 'Lien Amount', 'Included'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {damagesChart.line_items.map((li, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{li.provider || '-'}</td>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>{li.date_range || '-'}</td>
                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(li.total_billed)}</td>
                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(li.related_amount)}</td>
                        <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(li.lien_amount)}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input type="checkbox" checked={li.included !== false} readOnly />
                        </td>
                      </tr>
                    ))}
                    {/* Summary row */}
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>TOTALS</td>
                      <td style={{ padding: '8px' }}></td>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(damagesChart.total_medical_bills)}</td>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(damagesChart.related_medical_bills)}</td>
                      <td style={{ padding: '8px', fontSize: '0.85rem' }}>{fmt(damagesChart.lien_total)}</td>
                      <td style={{ padding: '8px' }}></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 4: Subrogation Directory ═══ */}
      <SectionHeader title="Subrogation Directory" expanded={sec4} onToggle={() => setSec4(!sec4)} />
      {sec4 && (
        <div style={{ marginBottom: 32 }}>
          <input
            style={{ ...inputStyle, maxWidth: 360, marginBottom: 16 }}
            placeholder="Search by health plan or company..."
            value={subSearch}
            onChange={(e) => setSubSearch(e.target.value)}
          />

          {subLoading ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Loading directory...</p>
          ) : filteredSub.length === 0 ? (
            <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 30 }}>No entries found</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Health Plan', 'Type', 'Subrogation Company', 'Contact', 'Phone', 'Email'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.75rem', color: 'var(--text-light)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSub.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px', fontSize: '0.85rem', fontWeight: 600 }}>{s.health_plan_name}</td>
                    <td style={{ padding: '8px' }}><Badge color="var(--blue)">{s.plan_type}</Badge></td>
                    <td style={{ padding: '8px', fontSize: '0.85rem' }}>{s.subrogation_company || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '0.85rem' }}>{s.contact_name || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '0.85rem' }}>{s.contact_phone || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '0.85rem' }}>{s.contact_email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add Entry — admin/supervisor only */}
          {isAdmin && (
            <form onSubmit={handleAddSubEntry} style={{ background: 'var(--light-gray)', borderRadius: 8, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 600 }}>Add Subrogation Entry</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Health Plan Name</label>
                  <input style={inputStyle} value={subForm.health_plan_name} onChange={(e) => setSubForm({ ...subForm, health_plan_name: e.target.value })} required />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Plan Type</label>
                  <select style={inputStyle} value={subForm.plan_type} onChange={(e) => setSubForm({ ...subForm, plan_type: e.target.value })}>
                    {PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Subrogation Company</label>
                  <input style={inputStyle} value={subForm.subrogation_company} onChange={(e) => setSubForm({ ...subForm, subrogation_company: e.target.value })} required />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Contact Name</label>
                  <input style={inputStyle} value={subForm.contact_name} onChange={(e) => setSubForm({ ...subForm, contact_name: e.target.value })} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Contact Phone</label>
                  <input style={inputStyle} value={subForm.contact_phone} onChange={(e) => setSubForm({ ...subForm, contact_phone: e.target.value })} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Contact Email</label>
                  <input style={inputStyle} value={subForm.contact_email} onChange={(e) => setSubForm({ ...subForm, contact_email: e.target.value })} />
                </div>
              </div>
              <div style={{ ...fieldGroup, marginBottom: 12 }}>
                <label style={labelStyle}>Mailing Address</label>
                <input style={inputStyle} value={subForm.mailing_address} onChange={(e) => setSubForm({ ...subForm, mailing_address: e.target.value })} />
              </div>
              <button type="submit" disabled={addingSub} style={btnPrimary}>
                {addingSub ? 'Adding...' : 'Add Entry'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* ═══ HIPAA/LOR Generated Document Modal ═══ */}
      {generatedDoc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700 }}>Generated {generatedDoc.type}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>{generatedDoc.text}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setGeneratedDoc(null)} style={btnSecondary}>Close</button>
              <button onClick={() => { navigator.clipboard.writeText(generatedDoc.text); }} style={btnPrimary}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
