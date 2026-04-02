import { useState, useEffect, useCallback } from 'react';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

const GAP_STATUSES = ['open', 'client_notified', 'response_received', 'resolved', 'waived'];

export default function DiscoveryWorkspace() {
  const { user } = useAuth();

  // Left panel state
  const [cases, setCases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCaseId, setActiveCaseId] = useState('');

  // Right panel state
  const [summary, setSummary] = useState(null);
  const [gaps, setGaps] = useState({ gaps: [], missing: [], insufficient: [], confirmed: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gapFilter, setGapFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState({});

  // Load cases on mount
  useEffect(() => {
    api.get('/discovery-workspace')
      .then((res) => {
        const list = Array.isArray(res) ? res : res.cases || [];
        setCases(list);
        if (list.length > 0) setActiveCaseId(list[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Load summary + gaps when active case changes
  const loadCaseData = useCallback(() => {
    if (!activeCaseId) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/discovery-workspace/${activeCaseId}/summary`).catch(() => null),
      api.get(`/discovery-workspace/${activeCaseId}/gaps`).catch(() => ({ gaps: [], missing: [], insufficient: [], confirmed: [] })),
    ]).then(([summaryData, gapsData]) => {
      setSummary(summaryData);
      setGaps(gapsData || { gaps: [], missing: [], insufficient: [], confirmed: [] });
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeCaseId]);

  useEffect(() => { loadCaseData(); }, [loadCaseData]);

  // Filter cases by search
  const filteredCases = cases.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (c.client_name || '').toLowerCase().includes(term) ||
           (c.case_number || '').toLowerCase().includes(term);
  });

  // Upload handler
  const handleUpload = async (e) => {
    e.preventDefault();
    const fileInput = e.target.elements.file;
    const file = fileInput?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setAnalyzeResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/upload/${activeCaseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const uploadResult = await res.json();
      fileInput.value = '';

      // Auto-trigger analysis
      if (uploadResult.id || uploadResult.response?.id) {
        const responseId = uploadResult.id || uploadResult.response.id;
        const analysisRes = await api.post(`/discovery/analyze/${responseId}`);
        setAnalyzeResult(analysisRes);
      }
      loadCaseData();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Gap status update
  const handleGapUpdate = async (gapId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/discovery/gaps/${gapId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Update failed');
      }
      loadCaseData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Email generation
  const handleGenerateEmail = async () => {
    const responseId = summary?.latest_response_id || (gaps.gaps?.[0]?.discovery_response_id);
    if (!responseId) return;
    setGeneratingEmail(true);
    try {
      const result = await api.post(`/discovery/generate-email/${responseId}`);
      setEmailModal(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingEmail(false);
    }
  };

  // Toggle gap expansion
  const toggleGap = (gapId) => {
    setExpandedGaps((prev) => ({ ...prev, [gapId]: !prev[gapId] }));
  };

  // Determine filtered gap list
  const getFilteredGaps = () => {
    switch (gapFilter) {
      case 'missing': return gaps.missing || [];
      case 'insufficient': return gaps.insufficient || [];
      case 'confirmed': return gaps.confirmed || [];
      default: return gaps.gaps || [];
    }
  };

  const filteredGaps = getFilteredGaps();
  const allGaps = gaps.gaps || [];
  const openCount = summary?.open_gaps ?? allGaps.filter((g) => g.status === 'open').length;
  const pendingCount = summary?.pending_supplements ?? allGaps.filter((g) => g.status === 'client_notified').length;
  const exhibitCount = summary?.exhibit_count ?? 0;
  const confirmedCount = summary?.confirmed_count ?? (gaps.confirmed || []).length;
  const hasResponses = summary?.response_count > 0 || allGaps.length > 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', marginLeft: -32, marginTop: -28, marginRight: -32, marginBottom: -28 }}>
      {/* LEFT PANEL */}
      <div style={{ width: 280, minWidth: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--light-gray)' }}>
        <div style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1C3557', marginBottom: 12 }}>Discovery</div>
          <input
            type="text"
            placeholder="Search cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: 6, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ padding: '0 8px 16px' }}>
          {filteredCases.map((c) => {
            const isActive = c.id === activeCaseId;
            const gapCount = c.gap_count ?? 0;
            return (
              <div
                key={c.id}
                onClick={() => setActiveCaseId(c.id)}
                style={{
                  padding: '10px 12px',
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isActive ? '#fff' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--blue)' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#fff'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1C3557' }}>{c.case_number}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>{c.client_name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  {c.phase && (
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: '#E2E8F0', color: '#1C3557', textTransform: 'capitalize', fontWeight: 500 }}>
                      {c.phase}
                    </span>
                  )}
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: gapCount > 0 ? '#FED7D7' : '#E2E8F0', color: gapCount > 0 ? 'var(--red)' : 'var(--text-light)', fontWeight: 600 }}>
                    {gapCount} gap{gapCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {c.ready_to_file && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600, marginTop: 4 }}>&#10003; Ready</div>
                )}
              </div>
            );
          })}
          {filteredCases.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem' }}>No cases found</div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!activeCaseId ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <span style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>Select a case to begin</span>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <span style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>Loading case data...</span>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>
            )}

            {/* HEADER */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1C3557' }}>{summary?.case_number || ''}</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-light)', marginTop: 2 }}>{summary?.client_name || ''}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {summary?.phase && (
                  <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 12, background: '#E2E8F0', color: '#1C3557', textTransform: 'capitalize', fontWeight: 600 }}>{summary.phase}</span>
                )}
                {summary?.status && (
                  <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 12, background: '#EBF5FF', color: '#2A6DB5', fontWeight: 600 }}>{summary.status}</span>
                )}
              </div>
            </div>

            {/* STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 14, borderRadius: 8, background: openCount > 0 ? '#FED7D7' : '#F7FAFC', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: openCount > 0 ? 'var(--red)' : 'var(--text-light)' }}>{openCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Open Gaps</div>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: pendingCount > 0 ? '#FEFCBF' : '#F7FAFC', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: pendingCount > 0 ? '#D69E2E' : 'var(--text-light)' }}>{pendingCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Supplements</div>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: '#EBF5FF', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2A6DB5' }}>{exhibitCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Exhibits</div>
              </div>
              <div style={{ padding: 14, borderRadius: 8, background: '#F0FFF4', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--green)' }}>{confirmedCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Confirmed</div>
              </div>
            </div>

            {/* READY TO FILE */}
            <div style={{ marginBottom: 20 }}>
              {summary?.ready_to_file ? (
                <span style={{ padding: '4px 12px', borderRadius: 12, background: '#C6F6D5', color: 'var(--green)', fontSize: '0.8rem', fontWeight: 600 }}>Ready to File</span>
              ) : (
                <span style={{ padding: '4px 12px', borderRadius: 12, background: '#FED7D7', color: 'var(--red)', fontSize: '0.8rem', fontWeight: 600 }}>Not Ready</span>
              )}
            </div>

            {/* UPLOAD ZONE */}
            <form onSubmit={handleUpload}>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 32, textAlign: 'center', marginBottom: 24, background: 'var(--light-gray)', cursor: 'pointer' }}>
                {uploading ? (
                  <div>
                    <div style={{ fontSize: '0.95rem', color: '#2A6DB5', fontWeight: 600, marginBottom: 8 }}>AI is reviewing the discovery response...</div>
                    <div style={{ width: 24, height: 24, border: '3px solid #E2E8F0', borderTop: '3px solid #2A6DB5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.95rem', color: '#1C3557', fontWeight: 600, marginBottom: 6 }}>Drop discovery response here to analyze</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: 12 }}>PDF or DOCX &middot; AI will flag gaps in under 60 seconds</div>
                    <input type="file" name="file" accept=".pdf,.doc,.docx,.txt" required style={{ fontSize: '0.85rem' }} />
                    <div style={{ marginTop: 10 }}>
                      <button type="submit" style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: 600, background: '#2A6DB5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                        Upload &amp; Analyze
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>

            {/* GAP FILTER BUTTONS */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'all', label: 'All', count: allGaps.length },
                { key: 'missing', label: 'Missing', count: (gaps.missing || []).length },
                { key: 'insufficient', label: 'Insufficient', count: (gaps.insufficient || []).length },
                { key: 'confirmed', label: 'Confirmed', count: (gaps.confirmed || []).length },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setGapFilter(btn.key)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: gapFilter === btn.key ? '1px solid #2A6DB5' : '1px solid var(--border)',
                    background: gapFilter === btn.key ? '#2A6DB5' : 'transparent',
                    color: gapFilter === btn.key ? '#fff' : 'var(--text)',
                  }}
                >
                  {btn.label} {btn.count}
                </button>
              ))}
            </div>

            {/* GAP LIST */}
            {filteredGaps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)', fontSize: '0.9rem' }}>No gaps found</div>
            ) : (
              filteredGaps.map((gap) => {
                const isMissing = ['no_answer', 'missing_document'].includes(gap.gap_type);
                const priorityLabel = isMissing ? 'MISSING' : 'INSUFFICIENT';
                const priorityColor = isMissing ? 'var(--red)' : '#D69E2E';
                const priorityBg = isMissing ? '#FED7D7' : '#FEFCBF';
                const reqLabel = gap.request_type ? `${gap.request_type === 'interrogatory' ? 'Int' : gap.request_type === 'rfp' ? 'RFP' : gap.request_type === 'rfa' ? 'RFA' : gap.request_type.toUpperCase()}. No. ${gap.request_number}` : '';
                const daysOpen = gap.created_at ? Math.floor((Date.now() - new Date(gap.created_at).getTime()) / 86400000) : null;
                const isExpanded = expandedGaps[gap.id];

                return (
                  <div key={gap.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleGap(gap.id)}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: priorityBg, color: priorityColor, marginRight: 8 }}>
                          {priorityLabel}
                        </span>
                        {reqLabel && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1C3557', marginRight: 8 }}>{reqLabel}</span>}
                        <div style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text)' }}>{gap.gap_description}</div>
                        {daysOpen !== null && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 4 }}>{daysOpen} day{daysOpen !== 1 ? 's' : ''} open</div>
                        )}
                      </div>
                      <div style={{ marginLeft: 12 }}>
                        <select
                          value={gap.status}
                          onChange={(e) => handleGapUpdate(gap.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.78rem', borderRadius: 4, border: '1px solid var(--border)' }}
                        >
                          {GAP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 10, padding: 10, background: 'var(--light-gray)', borderRadius: 6, fontSize: '0.82rem' }}>
                        {gap.original_request_text && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, color: '#1C3557', marginBottom: 4 }}>Original Request:</div>
                            <div style={{ color: 'var(--text)' }}>{gap.original_request_text}</div>
                          </div>
                        )}
                        {gap.response_received && (
                          <div>
                            <div style={{ fontWeight: 600, color: '#1C3557', marginBottom: 4 }}>Response Received:</div>
                            <div style={{ color: 'var(--text)' }}>{gap.response_received}</div>
                          </div>
                        )}
                        {!gap.original_request_text && !gap.response_received && (
                          <div style={{ color: 'var(--text-light)' }}>No additional details available</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* DRAFT EMAIL BUTTON */}
            {allGaps.length > 0 && hasResponses && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={handleGenerateEmail}
                  disabled={generatingEmail}
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: '#1C3557',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: generatingEmail ? 'not-allowed' : 'pointer',
                    opacity: generatingEmail ? 0.6 : 1,
                  }}
                >
                  {generatingEmail ? 'Generating...' : 'Draft Supplementation Email'}
                </button>
              </div>
            )}

            {/* EMAIL MODAL */}
            {emailModal && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700, color: '#1C3557' }}>Supplementation Email</h3>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>
                    {emailModal.generated_email_text}
                  </pre>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button
                      onClick={() => setEmailModal(null)}
                      style={{ padding: '8px 16px', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(emailModal.generated_email_text)}
                      style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#2A6DB5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
