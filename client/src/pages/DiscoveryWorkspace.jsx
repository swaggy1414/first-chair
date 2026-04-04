import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

/* ── Casey's Design Tokens ─────────────────────────────────── */
const V = {
  bg:       '#f6f5f2',
  surface:  '#fff',
  surface2: '#f0efe9',
  border:   '#e4e2da',
  borderS:  '#ccc9be',
  text:     '#1a1916',
  text2:    '#6b6860',
  text3:    '#9e9b92',
  accent:   '#2563eb',
  accentL:  '#eff4ff',
  red:      '#dc2626',
  amber:    '#d97706',
  green:    '#16a34a',
};
const serif = "'Fraunces', Georgia, serif";
const sans  = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const mono  = "'DM Mono', 'SF Mono', monospace";

/* ── Font URL ──────────────────────────────────────────────── */
const FONT_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Fraunces:wght@600;700&display=swap';

function useCaseyFonts() {
  useEffect(() => {
    if (!document.getElementById('casey-fonts')) {
      const link = document.createElement('link');
      link.id = 'casey-fonts';
      link.rel = 'stylesheet';
      link.href = FONT_URL;
      document.head.appendChild(link);
    }
  }, []);
}

/* ── Helpers ───────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function daysAgo(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function reqLabel(gap) {
  if (!gap.request_type) return '';
  const t = gap.request_type;
  const prefix = t === 'interrogatory' ? 'Int' : t === 'rfp' ? 'RFP' : t === 'rfa' ? 'RFA' : t.toUpperCase();
  return `${prefix}. No. ${gap.request_number || '?'}`;
}

/* ── Tabs Definition ───────────────────────────────────────── */
const TABS = [
  { key: 'gaps',        label: 'Gap Analysis' },
  { key: 'deficiencies',label: 'Def. Deficiencies' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'exhibits',    label: 'Exhibits' },
  { key: 'email',       label: 'Client Email' },
  { key: 'deficiency',  label: 'Deficiency' },
  { key: 'motion',      label: 'Motion to Compel' },
  { key: 'privilege',   label: 'Privilege Log' },
  { key: 'depo',        label: 'Depo Prep' },
  { key: 'subpoena',    label: 'Subpoena' },
];

const GAP_STATUSES = ['open', 'client_notified', 'response_received', 'resolved', 'waived'];

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function DiscoveryWorkspace() {
  useCaseyFonts();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedCaseId = searchParams.get('case');

  /* ── State ── */
  const [cases, setCases] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [summary, setSummary] = useState(null);
  const [gaps, setGaps] = useState({ gaps: [], missing: [], insufficient: [], confirmed: [] });
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('gaps');
  const [gapFilter, setGapFilter] = useState('all');
  const [expandedGaps, setExpandedGaps] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadSide, setUploadSide] = useState('defendant');
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  /* Supplement state */
  const [supplements, setSupplements] = useState([]);
  const [suppLoading, setSuppLoading] = useState(false);
  const [suppMsg, setSuppMsg] = useState('');
  const [suppExpanded, setSuppExpanded] = useState(null);

  /* Deficiency Letters state */
  const [letters, setLetters] = useState([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [lettersMsg, setLettersMsg] = useState('');
  const [letterExpanded, setLetterExpanded] = useState(null);
  const [editingLetter, setEditingLetter] = useState(null);
  const [editText, setEditText] = useState('');
  const [generating, setGenerating] = useState(false);

  /* Exhibits state */
  const [exhibits, setExhibits] = useState([]);
  const [exhLoading, setExhLoading] = useState(false);

  /* Defendant Deficiencies state */
  const [defFilter, setDefFilter] = useState('all');

  /* Motion to Compel state */
  const [selectedMotionGaps, setSelectedMotionGaps] = useState(new Set());
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [motionText, setMotionText] = useState(null);

  /* Subpoena state */
  const [subpoenas, setSubpoenas] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  /* ── Load cases ── */
  useEffect(() => {
    api.get('/discovery-workspace')
      .then((res) => {
        const list = Array.isArray(res) ? res : res.cases || [];
        setCases(list);
        const target = preselectedCaseId && list.some(c => c.id === preselectedCaseId)
          ? preselectedCaseId : list.length > 0 ? list[0].id : '';
        if (target) setActiveCaseId(target);
      })
      .catch((err) => setError(err.message));
  }, []);

  /* ── Load case data ── */
  const loadCaseData = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/discovery-workspace/${activeCaseId}/summary`).catch(() => null),
      api.get(`/discovery-workspace/${activeCaseId}/gaps`).catch(() => ({ gaps: [], missing: [], insufficient: [], confirmed: [] })),
      api.get(`/discovery-workspace/${activeCaseId}/readiness`).catch(() => null),
    ]).then(([s, g, r]) => {
      setReadiness(r);
      if (s && s.case) {
        setSummary({
          ...s.case,
          open_gap_count: Array.isArray(s.open_gaps) ? s.open_gaps.reduce((acc, x) => acc + Number(x.count || 0), 0) : 0,
          pending_supplement_count: Number(s.pending_supplement_count || 0),
          overdue_supplement_count: Number(s.overdue_supplement_count || 0),
          exhibit_count: Number(s.exhibit_count || 0),
          resolved_gap_count: Number(s.resolved_gap_count || 0),
          last_response_date: s.last_response_date,
          ready_to_file: s.ready_to_file || false,
        });
      } else setSummary(s);
      setGaps(g || { gaps: [], missing: [], insufficient: [], confirmed: [] });
    }).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { loadCaseData(); }, [loadCaseData]);

  /* ── Load tab-specific data ── */
  const loadSupplements = useCallback(() => {
    if (!activeCaseId) return;
    setSuppLoading(true);
    api.get(`/supplements/${activeCaseId}`)
      .then(r => setSupplements(Array.isArray(r) ? r : []))
      .catch(() => setSupplements([]))
      .finally(() => setSuppLoading(false));
  }, [activeCaseId]);

  const loadLetters = useCallback(() => {
    if (!activeCaseId) return;
    setLettersLoading(true);
    api.get(`/deficiency-letters/${activeCaseId}`)
      .then(r => setLetters(Array.isArray(r) ? r : []))
      .catch(() => setLetters([]))
      .finally(() => setLettersLoading(false));
  }, [activeCaseId]);

  const loadExhibits = useCallback(() => {
    if (!activeCaseId) return;
    setExhLoading(true);
    api.get(`/exhibits/case/${activeCaseId}`)
      .then(r => setExhibits(Array.isArray(r) ? r : []))
      .catch(() => setExhibits([]))
      .finally(() => setExhLoading(false));
  }, [activeCaseId]);

  const loadSubpoenas = useCallback(() => {
    if (!activeCaseId) return;
    setSubLoading(true);
    api.get(`/subpoenas?case_id=${activeCaseId}`)
      .then(r => setSubpoenas(Array.isArray(r) ? r : []))
      .catch(() => setSubpoenas([]))
      .finally(() => setSubLoading(false));
  }, [activeCaseId]);

  useEffect(() => {
    if (activeTab === 'supplements') loadSupplements();
    if (activeTab === 'deficiency') loadLetters();
    if (activeTab === 'exhibits') loadExhibits();
    if (activeTab === 'subpoena') loadSubpoenas();
  }, [activeTab, activeCaseId, loadSupplements, loadLetters, loadExhibits, loadSubpoenas]);

  /* ── Handlers ── */
  const doUpload = async (file) => {
    if (!file || !activeCaseId) return;
    setUploading(true);
    setError('');
    setAnalyzeResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('response_party', uploadSide);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/upload/${activeCaseId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Upload failed'); }
      const result = await res.json();
      if (result.id || result.response?.id) {
        const responseId = result.id || result.response.id;
        const analysis = await api.post(`/discovery/analyze/${responseId}`);
        setAnalyzeResult(analysis);
      }
      loadCaseData();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const handleUploadForm = (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (file) doUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) doUpload(file);
  };

  const handleGapUpdate = async (gapId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const body = typeof updates === 'string' ? { status: updates } : updates;
      const res = await fetch(`${API_URL}/discovery/gaps/${gapId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Update failed'); }
      loadCaseData();
    } catch (err) { setError(err.message); }
  };

  const handleGenerateEmail = async () => {
    const responseId = summary?.latest_response_id || (gaps.gaps?.[0]?.discovery_response_id);
    if (!responseId) return;
    setGeneratingEmail(true);
    try {
      const result = await api.post(`/discovery/generate-email/${responseId}`);
      setEmailModal(result);
    } catch (err) { setError(err.message); }
    finally { setGeneratingEmail(false); }
  };

  /* Supplement handlers */
  const suppAction = async (id, action, body = {}) => {
    try {
      await api.patch(`/supplements/${id}/${action}`, body);
      setSuppMsg(action === 'send' ? 'Sent' : action === 'respond' ? 'Marked responded' : 'Closed');
      loadSupplements(); loadCaseData();
      setTimeout(() => setSuppMsg(''), 3000);
    } catch (err) { setSuppMsg(err.message); }
  };

  /* Deficiency letter handlers */
  const handleGenerateLetters = async (gapId) => {
    setGenerating(true); setLettersMsg('');
    try {
      const body = gapId ? { gap_id: gapId } : {};
      const res = await api.post(`/deficiency-letters/${activeCaseId}/generate`, body);
      setLettersMsg(`Generated ${res.count} letter${res.count !== 1 ? 's' : ''}`);
      loadLetters();
      setTimeout(() => setLettersMsg(''), 3000);
    } catch (err) { setLettersMsg(err.message); }
    finally { setGenerating(false); }
  };

  const letterAction = async (id, action, body) => {
    try {
      if (action === 'save') await api.put(`/deficiency-letters/${id}`, body);
      else await api.patch(`/deficiency-letters/${id}/${action}`, {});
      setLettersMsg(action === 'send' ? 'Sent' : action === 'cancel' ? 'Cancelled' : 'Saved');
      setEditingLetter(null); loadLetters();
      setTimeout(() => setLettersMsg(''), 3000);
    } catch (err) { setLettersMsg(err.message); }
  };

  /* Motion to Compel handlers */
  const confirmedGaps = (gaps.gaps || []).filter(g => g.gap_action === 'confirmed' && g.status !== 'resolved');
  const toggleMotionGap = (id) => setSelectedMotionGaps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllMotion = () => setSelectedMotionGaps(prev => prev.size === confirmedGaps.length ? new Set() : new Set(confirmedGaps.map(g => g.id)));

  const handleGenerateMotion = async () => {
    if (selectedMotionGaps.size === 0) return;
    setGeneratingMotion(true);
    try {
      const selected = confirmedGaps.filter(g => selectedMotionGaps.has(g.id));
      const gapSummary = selected.map((g, i) => `${i + 1}. ${(g.request_type || '').toUpperCase()} #${g.request_number}: ${g.gap_description}${g.ai_reasoning ? ' — ' + g.ai_reasoning : ''}`).join('\n');
      const result = await api.post('/discovery/generate-motion', {
        case_id: activeCaseId, case_number: summary?.case_number || '', client_name: summary?.client_name || '',
        gaps: gapSummary, gap_count: selected.length,
      });
      setMotionText(result.text || result.motion_text || 'Motion generation unavailable');
    } catch (err) { setMotionText(`Error: ${err.message}`); }
    finally { setGeneratingMotion(false); }
  };

  /* ── Computed ── */
  const allGaps = gaps.gaps || [];
  const openCount = summary?.open_gap_count ?? allGaps.filter(g => g.status === 'open').length;
  const pendingCount = summary?.pending_supplement_count ?? 0;
  const exhibitCount = summary?.exhibit_count ?? 0;
  const confirmedCount = summary?.resolved_gap_count ?? (gaps.confirmed || []).length;

  const getFilteredGaps = () => {
    switch (gapFilter) {
      case 'missing': return gaps.missing || [];
      case 'insufficient': return gaps.insufficient || [];
      case 'confirmed': return gaps.confirmed || [];
      default: return allGaps;
    }
  };
  const filteredGaps = getFilteredGaps();

  const activeCase = cases.find(c => c.id === activeCaseId);

  /* Def deficiencies */
  const defUnreviewed = allGaps.filter(g => !g.gap_action && g.status === 'open');
  const defConfirmed = allGaps.filter(g => g.gap_action === 'confirmed');
  const defObjected = allGaps.filter(g => g.gap_action === 'objection_applied');
  const defDismissed = allGaps.filter(g => g.gap_action === 'dismissed');
  const defFiltered = defFilter === 'all' ? allGaps : defFilter === 'unreviewed' ? defUnreviewed : defFilter === 'confirmed' ? defConfirmed : defFilter === 'objected' ? defObjected : defDismissed;

  /* ━━━━━━━━━━━━ RENDER ━━━━━━━━━━━━ */
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      margin: '-28px -32px -28px -32px', /* break out of Layout padding */
      background: V.bg, fontFamily: sans, color: V.text,
    }}>
      {/* ── SIDEBAR (220px) ────────────────────────────────── */}
      <aside style={{
        width: 220, minWidth: 220, background: V.surface, borderRight: `1px solid ${V.border}`,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${V.border}` }}>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: '1.05rem', color: V.text, letterSpacing: '-0.01em' }}>
            Discovery
          </div>
        </div>

        {/* Active Case */}
        {activeCase && (
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${V.border}`, background: V.accentL }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: V.accent, marginBottom: 6 }}>
              Active Case
            </div>
            <div style={{ fontFamily: sans, fontWeight: 600, fontSize: '0.85rem', color: V.text, lineHeight: 1.3 }}>
              {summary?.client_name || activeCase.client_name}
            </div>
            <div style={{ fontFamily: mono, fontSize: '0.72rem', color: V.text3, marginTop: 2 }}>
              {summary?.case_number || activeCase.case_number}
            </div>
          </div>
        )}

        {/* Case Selector */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${V.border}` }}>
          <select
            value={activeCaseId}
            onChange={e => setActiveCaseId(e.target.value)}
            style={{
              width: '100%', padding: '7px 8px', fontSize: '0.78rem', fontFamily: sans,
              border: `1px solid ${V.border}`, borderRadius: 6, background: V.surface,
              color: V.text, outline: 'none', cursor: 'pointer',
            }}
          >
            {cases.length === 0 && <option value="">No cases</option>}
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>
            ))}
          </select>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            let badge = null;
            if (tab.key === 'gaps') badge = openCount;
            if (tab.key === 'supplements') badge = pendingCount;
            if (tab.key === 'exhibits') badge = exhibitCount;
            if (tab.key === 'deficiencies') badge = defUnreviewed.length;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '9px 16px', fontSize: '0.8rem', fontWeight: isActive ? 600 : 400,
                  fontFamily: sans, background: isActive ? V.accentL : 'transparent',
                  color: isActive ? V.accent : V.text2, border: 'none',
                  borderLeft: isActive ? `3px solid ${V.accent}` : '3px solid transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                }}
              >
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, fontSize: '0.68rem',
                    fontWeight: 700, fontFamily: mono, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: tab.key === 'gaps' && openCount > 0 ? '#fef2f2' : V.surface2,
                    color: tab.key === 'gaps' && openCount > 0 ? V.red : V.text2,
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Firm Section */}
          <div style={{
            padding: '14px 16px 6px', marginTop: 8,
            fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.text3,
          }}>
            Firm
          </div>
          <button onClick={() => window.location.href = '/discovery-library'} style={{
            display: 'block', width: '100%', padding: '9px 16px', fontSize: '0.8rem', fontFamily: sans,
            color: V.text2, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
            borderLeft: '3px solid transparent',
          }}>
            Discovery Library
          </button>
          <button onClick={() => window.location.href = '/firm-brain'} style={{
            display: 'block', width: '100%', padding: '9px 16px', fontSize: '0.8rem', fontFamily: sans,
            color: V.text2, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
            borderLeft: '3px solid transparent',
          }}>
            Firm Brain
          </button>
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${V.border}`, fontSize: '0.75rem', color: V.text3 }}>
          {user?.name || 'User'}
          <div style={{ fontSize: '0.68rem', textTransform: 'capitalize', marginTop: 2 }}>{user?.role || ''}</div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {!activeCaseId ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <span style={{ color: V.text3, fontSize: '1rem', fontFamily: serif }}>Select a case to begin</span>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <span style={{ color: V.text3, fontSize: '0.9rem' }}>Loading case data...</span>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: '#fef2f2', color: V.red, padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 16, border: `1px solid #fecaca` }}>
                {error}
              </div>
            )}

            {/* ── Summary Bar: 4 stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { n: openCount,     label: 'Open Gaps',           color: V.red },
                { n: pendingCount,  label: 'Pending Supplements', color: V.amber },
                { n: exhibitCount,  label: 'Exhibits',            color: V.accent },
                { n: confirmedCount,label: 'Confirmed',           color: V.green },
              ].map((card, i) => (
                <div key={i} style={{
                  background: V.surface, borderRadius: 10, padding: '18px 16px',
                  borderLeft: `4px solid ${card.color}`, border: `1px solid ${V.border}`,
                  borderLeftWidth: 4, borderLeftColor: card.color,
                }}>
                  <div style={{ fontFamily: serif, fontWeight: 700, fontSize: '1.65rem', color: V.text, lineHeight: 1 }}>
                    {card.n}
                  </div>
                  <div style={{ fontFamily: sans, fontSize: '0.72rem', fontWeight: 500, color: V.text3, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {card.label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Tab Bar ── */}
            <div style={{
              display: 'flex', gap: 0, marginBottom: 24, borderBottom: `2px solid ${V.border}`,
              overflowX: 'auto', whiteSpace: 'nowrap',
            }}>
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  padding: '10px 18px', fontSize: '0.82rem', fontFamily: sans,
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? V.accent : V.text3,
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${V.accent}` : '2px solid transparent',
                  marginBottom: -2, cursor: 'pointer', transition: 'color 0.12s',
                  flexShrink: 0,
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ━━━━ TAB: GAP ANALYSIS ━━━━ */}
            {activeTab === 'gaps' && (
              <>
                {/* Upload Zone */}
                <form onSubmit={handleUploadForm}>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{
                      border: `2px dashed ${dragOver ? V.accent : V.borderS}`,
                      borderRadius: 10, padding: 28, textAlign: 'center', marginBottom: 24,
                      background: dragOver ? V.accentL : V.surface2,
                      transition: 'all 0.15s',
                    }}
                  >
                    {uploading ? (
                      <div>
                        <div style={{ fontSize: '0.9rem', color: V.accent, fontWeight: 600, marginBottom: 8 }}>
                          AI is reviewing the {uploadSide} discovery response...
                        </div>
                        <div style={{ width: 24, height: 24, border: `3px solid ${V.border}`, borderTop: `3px solid ${V.accent}`, borderRadius: '50%', animation: 'casey-spin 1s linear infinite', margin: '0 auto' }} />
                        <style>{`@keyframes casey-spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    ) : (
                      <>
                        {/* Plaintiff / Defendant toggle */}
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: '0.75rem', color: V.text3, marginBottom: 8, fontWeight: 500 }}>Response type</div>
                          <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${V.border}` }}>
                            {['plaintiff', 'defendant'].map(side => (
                              <button key={side} type="button" onClick={() => setUploadSide(side)} style={{
                                padding: '8px 22px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                border: 'none', fontFamily: sans,
                                background: uploadSide === side ? V.accent : V.surface,
                                color: uploadSide === side ? '#fff' : V.text2,
                              }}>
                                {side.charAt(0).toUpperCase() + side.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: V.text, fontWeight: 600, marginBottom: 4 }}>
                          Drop file here or click to upload
                        </div>
                        <div style={{ fontSize: '0.78rem', color: V.text3, marginBottom: 14 }}>
                          PDF or DOCX · AI will flag gaps in under 60 seconds
                        </div>
                        <input type="file" name="file" ref={fileRef} accept=".pdf,.doc,.docx,.txt" required
                          style={{ fontSize: '0.8rem', fontFamily: sans, color: V.text2 }} />
                        <div style={{ marginTop: 12 }}>
                          <button type="submit" style={{
                            padding: '9px 22px', fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                            background: V.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                          }}>
                            Upload &amp; Analyze
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </form>

                {/* Gap Filter Buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                  {[
                    { key: 'all', label: 'All', count: allGaps.length },
                    { key: 'missing', label: 'Missing', count: (gaps.missing || []).length },
                    { key: 'insufficient', label: 'Insufficient', count: (gaps.insufficient || []).length },
                    { key: 'confirmed', label: 'Confirmed', count: (gaps.confirmed || []).length },
                  ].map(btn => (
                    <button key={btn.key} onClick={() => setGapFilter(btn.key)} style={{
                      padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                      fontFamily: sans,
                      border: gapFilter === btn.key ? `1px solid ${V.accent}` : `1px solid ${V.border}`,
                      background: gapFilter === btn.key ? V.accent : V.surface,
                      color: gapFilter === btn.key ? '#fff' : V.text2,
                    }}>
                      {btn.label} <span style={{ fontFamily: mono }}>{btn.count}</span>
                    </button>
                  ))}
                </div>

                {/* Gap List */}
                {filteredGaps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, fontSize: '0.88rem', background: V.surface2, borderRadius: 10 }}>
                    No gaps found
                  </div>
                ) : filteredGaps.map(gap => {
                  const isMissing = ['no_answer', 'missing_document'].includes(gap.gap_type);
                  const badgeLabel = isMissing ? 'MISSING' : 'INSUFFICIENT';
                  const badgeColor = isMissing ? V.red : V.amber;
                  const badgeBg = isMissing ? '#fef2f2' : '#fffbeb';
                  const label = reqLabel(gap);
                  const days = daysAgo(gap.created_at);
                  const isOpen = expandedGaps[gap.id];

                  return (
                    <div key={gap.id} style={{
                      background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10,
                      padding: '14px 16px', marginBottom: 10, transition: 'box-shadow 0.12s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedGaps(p => ({ ...p, [gap.id]: !p[gap.id] }))}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                              background: badgeBg, color: badgeColor, fontFamily: sans, letterSpacing: '0.03em',
                              textTransform: 'uppercase',
                            }}>
                              {badgeLabel}
                            </span>
                            {label && (
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: mono, color: V.text }}>
                                {label}
                              </span>
                            )}
                            {days !== null && (
                              <span style={{ fontSize: '0.72rem', color: V.text3 }}>
                                {days}d open
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.84rem', marginTop: 8, color: V.text, lineHeight: 1.5 }}>
                            {gap.gap_description}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ marginLeft: 14, display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                          {gap.status === 'open' && !gap.gap_action && (
                            <>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'confirmed', status: 'open' })} style={{
                                padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans,
                                background: '#f0fdf4', color: V.green, border: `1px solid #bbf7d0`, borderRadius: 6, cursor: 'pointer',
                              }}>Confirm</button>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'objection_applied' })} style={{
                                padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans,
                                background: V.accentL, color: V.accent, border: `1px solid #bfdbfe`, borderRadius: 6, cursor: 'pointer',
                              }}>Apply Objection</button>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'dismissed', status: 'waived' })} style={{
                                padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans,
                                background: V.surface2, color: V.text3, border: `1px solid ${V.border}`, borderRadius: 6, cursor: 'pointer',
                              }}>Dismiss</button>
                            </>
                          )}
                          {gap.gap_action && (
                            <span style={{
                              padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600,
                              color: gap.gap_action === 'confirmed' ? V.green : gap.gap_action === 'objection_applied' ? V.accent : V.text3,
                              background: gap.gap_action === 'confirmed' ? '#f0fdf4' : gap.gap_action === 'objection_applied' ? V.accentL : V.surface2,
                              border: `1px solid ${gap.gap_action === 'confirmed' ? '#bbf7d0' : gap.gap_action === 'objection_applied' ? '#bfdbfe' : V.border}`,
                            }}>
                              {gap.gap_action === 'confirmed' ? 'Confirmed' : gap.gap_action === 'objection_applied' ? 'Objection Applied' : 'Dismissed'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expanded: AI Reasoning */}
                      {isOpen && (
                        <div style={{ marginTop: 12, padding: 14, background: V.surface2, borderRadius: 8, fontSize: '0.82rem' }}>
                          {gap.original_request_text && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontWeight: 600, color: V.text, marginBottom: 3, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Original Request</div>
                              <div style={{ color: V.text2, lineHeight: 1.5 }}>{gap.original_request_text}</div>
                            </div>
                          )}
                          {gap.response_received && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontWeight: 600, color: V.text, marginBottom: 3, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Response Received</div>
                              <div style={{ color: V.text2, lineHeight: 1.5 }}>{gap.response_received}</div>
                            </div>
                          )}
                          {gap.ai_reasoning && (
                            <div style={{ background: V.accentL, border: `1px solid #bfdbfe`, borderRadius: 8, padding: 12 }}>
                              <div style={{ fontWeight: 600, color: V.accent, marginBottom: 4, fontSize: '0.76rem' }}>AI Reasoning</div>
                              <div style={{ color: V.text, fontSize: '0.82rem', lineHeight: 1.6 }}>{gap.ai_reasoning}</div>
                            </div>
                          )}
                          {!gap.original_request_text && !gap.response_received && !gap.ai_reasoning && (
                            <div style={{ color: V.text3 }}>No additional details available</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Draft Email button */}
                {allGaps.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <button onClick={handleGenerateEmail} disabled={generatingEmail} style={{
                      padding: '10px 22px', fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                      background: V.text, color: '#fff', border: 'none', borderRadius: 8,
                      cursor: generatingEmail ? 'not-allowed' : 'pointer', opacity: generatingEmail ? 0.6 : 1,
                    }}>
                      {generatingEmail ? 'Generating...' : 'Draft Supplementation Email'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ━━━━ TAB: DEFENDANT DEFICIENCIES ━━━━ */}
            {activeTab === 'deficiencies' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>
                    Defendant Deficiencies
                  </h3>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', fontFamily: mono }}>
                    <span style={{ color: V.red }}>{defUnreviewed.length} unreviewed</span>
                    <span style={{ color: V.green }}>{defConfirmed.length} confirmed</span>
                    <span style={{ color: V.accent }}>{defObjected.length} objected</span>
                    <span style={{ color: V.text3 }}>{defDismissed.length} dismissed</span>
                  </div>
                </div>

                <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${V.border}`, marginBottom: 18 }}>
                  {[
                    { key: 'all', label: `All (${allGaps.length})` },
                    { key: 'unreviewed', label: `Unreviewed (${defUnreviewed.length})` },
                    { key: 'confirmed', label: `Confirmed (${defConfirmed.length})` },
                    { key: 'objected', label: `Objected (${defObjected.length})` },
                    { key: 'dismissed', label: `Dismissed (${defDismissed.length})` },
                  ].map(f => (
                    <button key={f.key} onClick={() => setDefFilter(f.key)} style={{
                      padding: '7px 14px', fontSize: '0.78rem', fontWeight: defFilter === f.key ? 600 : 400,
                      cursor: 'pointer', fontFamily: sans, border: 'none',
                      background: defFilter === f.key ? V.accent : V.surface,
                      color: defFilter === f.key ? '#fff' : V.text2,
                    }}>{f.label}</button>
                  ))}
                </div>

                {defFiltered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>No deficiencies found</div>
                ) : defFiltered.map(gap => {
                  const GAP_TYPES = { missing_document: { l: 'Missing Document', c: V.red }, no_answer: { l: 'No Answer', c: V.red }, incomplete_answer: { l: 'Incomplete', c: V.amber }, evasive_answer: { l: 'Evasive', c: V.amber }, objection_only: { l: 'Objection Only', c: '#7c3aed' } };
                  const ti = GAP_TYPES[gap.gap_type] || { l: gap.gap_type, c: V.text3 };
                  return (
                    <div key={gap.id} style={{ background: V.surface, border: `1px solid ${V.border}`, borderLeft: `4px solid ${ti.c}`, borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: ti.c }}>{ti.l}</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: mono, color: V.text }}>{(gap.request_type || '').toUpperCase()} #{gap.request_number}</span>
                            {gap.gap_action && (() => {
                              const colors = { confirmed: { c: V.green, b: '#f0fdf4' }, objection_applied: { c: V.accent, b: V.accentL }, dismissed: { c: V.text3, b: V.surface2 } };
                              const a = colors[gap.gap_action] || colors.dismissed;
                              return <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.66rem', fontWeight: 600, color: a.c, background: a.b }}>{gap.gap_action === 'confirmed' ? 'Confirmed' : gap.gap_action === 'objection_applied' ? 'Objection Applied' : 'Dismissed'}</span>;
                            })()}
                            {gap.days_open != null && <span style={{ fontSize: '0.72rem', color: V.text3 }}>{gap.days_open}d open</span>}
                          </div>
                          <div style={{ fontSize: '0.84rem', color: V.text, lineHeight: 1.5 }}>{gap.gap_description}</div>
                          {gap.ai_reasoning && (
                            <div style={{ fontSize: '0.78rem', color: V.accent, marginTop: 6, background: V.accentL, padding: '8px 10px', borderRadius: 6, lineHeight: 1.5 }}>{gap.ai_reasoning}</div>
                          )}
                        </div>
                        <div style={{ marginLeft: 12, display: 'flex', gap: 6 }}>
                          {!gap.gap_action && gap.status === 'open' && (
                            <>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'confirmed' })} style={{ padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans, background: '#f0fdf4', color: V.green, border: `1px solid #bbf7d0`, borderRadius: 6, cursor: 'pointer' }}>Confirm</button>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'objection_applied' })} style={{ padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans, background: V.accentL, color: V.accent, border: `1px solid #bfdbfe`, borderRadius: 6, cursor: 'pointer' }}>Object</button>
                              <button onClick={() => handleGapUpdate(gap.id, { gap_action: 'dismissed', status: 'waived' })} style={{ padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, fontFamily: sans, background: V.surface2, color: V.text3, border: `1px solid ${V.border}`, borderRadius: 6, cursor: 'pointer' }}>Dismiss</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ━━━━ TAB: SUPPLEMENTS ━━━━ */}
            {activeTab === 'supplements' && (
              <div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text, marginBottom: 16 }}>Supplement Tracker</h3>
                {suppMsg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', color: V.green, fontSize: '0.82rem', marginBottom: 14, border: '1px solid #bbf7d0' }}>{suppMsg}</div>}
                {suppLoading ? <div style={{ color: V.text3, padding: 20 }}>Loading...</div> : supplements.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                    No supplementation requests yet.
                  </div>
                ) : supplements.map(s => {
                  const sc = { draft: { bg: V.surface2, c: V.text3 }, sent: { bg: '#fffbeb', c: V.amber }, responded: { bg: '#f0fdf4', c: V.green }, closed: { bg: V.surface2, c: V.text3 } };
                  const st = sc[s.status] || sc.draft;
                  return (
                    <div key={s.id} style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                      <div onClick={() => setSuppExpanded(suppExpanded === s.id ? null : s.id)} style={{
                        padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: s.is_overdue ? '#fef2f2' : V.surface,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: st.bg, color: st.c, textTransform: 'uppercase', fontFamily: sans }}>{s.status}</span>
                          {s.is_overdue && <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: '#fef2f2', color: V.red }}>OVERDUE</span>}
                          <span style={{ fontSize: '0.84rem', color: V.text }}>{s.response_file_name || 'Supplement Request'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', color: V.text3, fontFamily: mono }}>
                          {s.days_outstanding != null && <span>{s.days_outstanding}d</span>}
                          <span>{fmtDate(s.created_at)}</span>
                        </div>
                      </div>
                      {suppExpanded === s.id && (
                        <div style={{ padding: 16, borderTop: `1px solid ${V.border}` }}>
                          {s.generated_email_text && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: V.text2, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email Text</div>
                              <pre style={{ fontSize: '0.82rem', color: V.text, background: V.surface2, padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', margin: 0, fontFamily: sans, lineHeight: 1.5 }}>{s.generated_email_text}</pre>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {s.status === 'draft' && <button onClick={() => suppAction(s.id, 'send')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>Send</button>}
                            {s.status === 'sent' && <button onClick={() => suppAction(s.id, 'respond', { client_response: 'Client response received' })} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.green, color: '#fff', border: 'none', cursor: 'pointer' }}>Mark Responded</button>}
                            {s.status !== 'closed' && <button onClick={() => suppAction(s.id, 'close')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.surface2, color: V.text2, border: `1px solid ${V.border}`, cursor: 'pointer' }}>Close</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ━━━━ TAB: EXHIBITS ━━━━ */}
            {activeTab === 'exhibits' && (
              <div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text, marginBottom: 16 }}>Exhibits</h3>
                {exhLoading ? <div style={{ color: V.text3, padding: 20 }}>Loading...</div> : exhibits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                    No exhibits for this case yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {exhibits.map(ex => (
                      <div key={ex.id} style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: V.text }}>{ex.exhibit_label || ex.file_name || 'Exhibit'}</div>
                          {ex.description && <div style={{ fontSize: '0.78rem', color: V.text2, marginTop: 3 }}>{ex.description}</div>}
                          <div style={{ fontSize: '0.72rem', color: V.text3, marginTop: 4, fontFamily: mono }}>
                            {ex.exhibit_type && <span style={{ textTransform: 'capitalize' }}>{ex.exhibit_type} · </span>}
                            {fmtDate(ex.created_at)}
                          </div>
                        </div>
                        {ex.classification && (
                          <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, fontFamily: sans, background: V.surface2, color: V.text2, border: `1px solid ${V.border}` }}>
                            {ex.classification}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ━━━━ TAB: CLIENT EMAIL ━━━━ */}
            {activeTab === 'email' && (
              <div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text, marginBottom: 16 }}>Client Email</h3>
                <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                  <div style={{ marginBottom: 12 }}>Generate a supplementation email from the Gap Analysis tab.</div>
                  <button onClick={() => setActiveTab('gaps')} style={{
                    padding: '8px 18px', fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                    background: V.accent, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                  }}>Go to Gap Analysis</button>
                </div>
              </div>
            )}

            {/* ━━━━ TAB: DEFICIENCY LETTERS ━━━━ */}
            {activeTab === 'deficiency' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Deficiency Letters</h3>
                  <button onClick={() => handleGenerateLetters()} disabled={generating} style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                    background: generating ? V.surface2 : V.amber, color: generating ? V.text3 : '#fff',
                    border: 'none', cursor: generating ? 'default' : 'pointer',
                  }}>
                    {generating ? 'Generating...' : 'Generate for Open Gaps'}
                  </button>
                </div>
                {lettersMsg && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', color: V.green, fontSize: '0.82rem', marginBottom: 14, border: '1px solid #bbf7d0' }}>{lettersMsg}</div>}
                {lettersLoading ? <div style={{ color: V.text3, padding: 20 }}>Loading...</div> : letters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                    No deficiency letters yet. Generate them from open gaps.
                  </div>
                ) : letters.map(l => {
                  const sc = { draft: { bg: '#fffbeb', c: V.amber }, sent: { bg: '#f0fdf4', c: V.green }, cancelled: { bg: V.surface2, c: V.text3 } };
                  const st = sc[l.status] || sc.draft;
                  const isExp = letterExpanded === l.id;
                  const isEdit = editingLetter === l.id;
                  return (
                    <div key={l.id} style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                      <div onClick={() => { setLetterExpanded(isExp ? null : l.id); setEditingLetter(null); }} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, background: st.bg, color: st.c, textTransform: 'uppercase' }}>{l.status}</span>
                          {l.request_type && l.request_number && <span style={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: mono, color: V.text }}>{l.request_type} #{l.request_number}</span>}
                          <span style={{ fontSize: '0.78rem', color: V.text3 }}>{l.gap_type?.replace(/_/g, ' ') || 'General'}</span>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: V.text3, fontFamily: mono }}>{fmtDate(l.created_at)}</span>
                      </div>
                      {isExp && (
                        <div style={{ padding: 16, borderTop: `1px solid ${V.border}` }}>
                          {isEdit ? (
                            <div>
                              <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ width: '100%', minHeight: 220, padding: 12, border: `1px solid ${V.border}`, borderRadius: 8, fontSize: '0.84rem', fontFamily: sans, resize: 'vertical', background: V.surface, color: V.text }} />
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={() => letterAction(l.id, 'save', { letter_text: editText })} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingLetter(null)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontFamily: sans, background: V.surface2, border: `1px solid ${V.border}`, cursor: 'pointer', color: V.text2 }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <pre style={{ fontSize: '0.84rem', color: V.text, background: V.surface2, padding: 14, borderRadius: 8, whiteSpace: 'pre-wrap', margin: '0 0 12px', lineHeight: 1.5, fontFamily: sans }}>{l.letter_text}</pre>
                              {l.gap_description && <div style={{ fontSize: '0.78rem', color: V.text3, marginBottom: 10 }}>Gap: {l.gap_description}</div>}
                              <div style={{ display: 'flex', gap: 8 }}>
                                {l.status === 'draft' && (
                                  <>
                                    <button onClick={() => letterAction(l.id, 'send')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.green, color: '#fff', border: 'none', cursor: 'pointer' }}>Mark Sent</button>
                                    <button onClick={e => { e.stopPropagation(); setEditingLetter(l.id); setEditText(l.letter_text); }} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, fontFamily: sans, background: V.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>Edit</button>
                                    <button onClick={() => letterAction(l.id, 'cancel')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: '0.78rem', fontFamily: sans, background: V.surface2, border: `1px solid ${V.border}`, cursor: 'pointer', color: V.text2 }}>Cancel</button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ━━━━ TAB: MOTION TO COMPEL ━━━━ */}
            {activeTab === 'motion' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Motion to Compel</h3>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: V.text3 }}>{selectedMotionGaps.size} of {confirmedGaps.length} selected</span>
                    <button onClick={handleGenerateMotion} disabled={generatingMotion || selectedMotionGaps.size === 0} style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                      background: selectedMotionGaps.size > 0 ? V.text : V.surface2,
                      color: selectedMotionGaps.size > 0 ? '#fff' : V.text3,
                      border: 'none', cursor: selectedMotionGaps.size > 0 ? 'pointer' : 'default',
                      opacity: generatingMotion ? 0.6 : 1,
                    }}>
                      {generatingMotion ? 'Generating...' : 'Generate Motion'}
                    </button>
                  </div>
                </div>
                {confirmedGaps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                    <div style={{ marginBottom: 8 }}>No confirmed deficiencies</div>
                    <div style={{ fontSize: '0.82rem' }}>Confirm gaps in the Def. Deficiencies tab first.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <button onClick={selectAllMotion} style={{ padding: '6px 14px', fontSize: '0.78rem', fontFamily: sans, background: V.surface2, color: V.text2, border: `1px solid ${V.border}`, borderRadius: 6, cursor: 'pointer' }}>
                        {selectedMotionGaps.size === confirmedGaps.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {confirmedGaps.map(gap => (
                      <div key={gap.id} onClick={() => toggleMotionGap(gap.id)} style={{
                        background: selectedMotionGaps.has(gap.id) ? V.accentL : V.surface,
                        border: selectedMotionGaps.has(gap.id) ? `2px solid ${V.accent}` : `1px solid ${V.border}`,
                        borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <input type="checkbox" checked={selectedMotionGaps.has(gap.id)} readOnly style={{ marginTop: 3, accentColor: V.accent }} />
                          <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, fontFamily: mono, color: V.text }}>{(gap.request_type || '').toUpperCase()} #{gap.request_number}</span>
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.66rem', fontWeight: 600, color: V.green, background: '#f0fdf4' }}>Confirmed</span>
                            </div>
                            <div style={{ fontSize: '0.84rem', color: V.text, lineHeight: 1.5 }}>{gap.gap_description}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ━━━━ TAB: PRIVILEGE LOG ━━━━ */}
            {activeTab === 'privilege' && (
              <div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text, marginBottom: 16 }}>Privilege Log</h3>
                <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                  Privilege log generation coming soon.
                </div>
              </div>
            )}

            {/* ━━━━ TAB: DEPO PREP ━━━━ */}
            {activeTab === 'depo' && (
              <div>
                <h3 style={{ fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text, marginBottom: 16 }}>Depo Prep</h3>
                <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                  Deposition preparation tools coming soon.
                </div>
              </div>
            )}

            {/* ━━━━ TAB: SUBPOENA ━━━━ */}
            {activeTab === 'subpoena' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontFamily: serif, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Subpoenas</h3>
                  <button onClick={() => window.location.href = '/subpoena-manager'} style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, fontFamily: sans,
                    background: V.accent, color: '#fff', border: 'none', cursor: 'pointer',
                  }}>Manage in Subpoena Manager</button>
                </div>
                {subLoading ? <div style={{ color: V.text3, padding: 20 }}>Loading...</div> : subpoenas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: V.text3, background: V.surface2, borderRadius: 10 }}>
                    No subpoenas for this case.
                  </div>
                ) : subpoenas.map(sub => (
                  <div key={sub.id} style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: V.text }}>{sub.recipient_name || sub.subpoena_type || 'Subpoena'}</div>
                        {sub.provider_name && <div style={{ fontSize: '0.78rem', color: V.text2, marginTop: 3 }}>{sub.provider_name}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', fontFamily: sans,
                          background: sub.status === 'served' ? '#f0fdf4' : sub.status === 'pending' ? '#fffbeb' : V.surface2,
                          color: sub.status === 'served' ? V.green : sub.status === 'pending' ? V.amber : V.text3,
                        }}>{sub.status}</span>
                        <span style={{ fontSize: '0.72rem', color: V.text3, fontFamily: mono }}>{fmtDate(sub.due_date || sub.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Email Modal ── */}
            {emailModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,25,22,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                <div style={{ background: V.surface, borderRadius: 12, padding: 28, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto', border: `1px solid ${V.border}` }}>
                  <h3 style={{ marginTop: 0, fontFamily: serif, fontSize: '1.05rem', fontWeight: 700, color: V.text }}>Supplementation Email</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.84rem', lineHeight: 1.6, background: V.surface2, padding: 16, borderRadius: 8, fontFamily: sans, color: V.text }}>{emailModal.generated_email_text}</pre>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={() => setEmailModal(null)} style={{ padding: '8px 18px', fontSize: '0.82rem', fontFamily: sans, border: `1px solid ${V.border}`, borderRadius: 8, background: V.surface, cursor: 'pointer', color: V.text2 }}>Close</button>
                    <button onClick={() => navigator.clipboard.writeText(emailModal.generated_email_text)} style={{ padding: '8px 18px', fontSize: '0.82rem', fontFamily: sans, background: V.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Copy to Clipboard</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Motion Modal ── */}
            {motionText && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,25,22,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                <div style={{ background: V.surface, borderRadius: 12, padding: 28, maxWidth: 700, width: '90%', maxHeight: '85vh', overflow: 'auto', border: `1px solid ${V.border}` }}>
                  <h3 style={{ marginTop: 0, fontFamily: serif, fontSize: '1.05rem', fontWeight: 700, color: V.text }}>Motion to Compel — Draft</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.84rem', lineHeight: 1.6, background: V.surface2, padding: 16, borderRadius: 8, fontFamily: sans, color: V.text }}>{motionText}</pre>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={() => setMotionText(null)} style={{ padding: '8px 18px', fontSize: '0.82rem', fontFamily: sans, background: V.surface2, color: V.text2, border: `1px solid ${V.border}`, borderRadius: 8, cursor: 'pointer' }}>Close</button>
                    <button onClick={() => navigator.clipboard.writeText(motionText)} style={{ padding: '8px 18px', fontSize: '0.82rem', fontFamily: sans, background: V.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Copy to Clipboard</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
