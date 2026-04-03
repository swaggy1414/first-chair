import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

export default function MotionToCompel({ caseId, caseName, caseNumber }) {
  const [confirmedGaps, setConfirmedGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [motionText, setMotionText] = useState(null);
  const [selectedGaps, setSelectedGaps] = useState(new Set());

  const load = useCallback(() => {
    api.get(`/discovery-workspace/${caseId}/gaps`)
      .then((res) => {
        const allGaps = res.gaps || [];
        setConfirmedGaps(allGaps.filter(g => g.gap_action === 'confirmed' && g.status !== 'resolved'));
      })
      .catch(() => setConfirmedGaps([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const toggleGap = (gapId) => {
    setSelectedGaps(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) next.delete(gapId);
      else next.add(gapId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedGaps.size === confirmedGaps.length) {
      setSelectedGaps(new Set());
    } else {
      setSelectedGaps(new Set(confirmedGaps.map(g => g.id)));
    }
  };

  const handleGenerate = async () => {
    if (selectedGaps.size === 0) return;
    setGenerating(true);
    try {
      const selected = confirmedGaps.filter(g => selectedGaps.has(g.id));
      const gapSummary = selected.map((g, i) =>
        `${i + 1}. ${(g.request_type || '').toUpperCase()} #${g.request_number}: ${g.gap_description}${g.ai_reasoning ? ' — ' + g.ai_reasoning : ''}`
      ).join('\n');

      const result = await api.post('/discovery/generate-motion', {
        case_id: caseId,
        case_number: caseNumber,
        client_name: caseName,
        gaps: gapSummary,
        gap_count: selected.length,
      });
      setMotionText(result.text || result.motion_text || 'Motion generation unavailable');
    } catch (err) {
      setMotionText(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-light)', padding: 20 }}>Loading confirmed gaps...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1C3557' }}>Motion to Compel</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{selectedGaps.size} of {confirmedGaps.length} selected</span>
          <button type="button" onClick={handleGenerate} disabled={generating || selectedGaps.size === 0}
            style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600, background: selectedGaps.size > 0 ? '#1C3557' : '#ccc', color: '#fff', border: 'none', borderRadius: 6, cursor: selectedGaps.size > 0 ? 'pointer' : 'default', opacity: generating ? 0.6 : 1 }}>
            {generating ? 'Generating Motion...' : 'Generate Motion to Compel'}
          </button>
        </div>
      </div>

      {confirmedGaps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>
          <div style={{ fontSize: '1rem', marginBottom: 8 }}>No confirmed deficiencies</div>
          <div style={{ fontSize: '0.85rem' }}>Confirm gaps in the Defendant Deficiencies tab to include them in a motion to compel.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={selectAll} style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--light-gray)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
              {selectedGaps.size === confirmedGaps.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {confirmedGaps.map(gap => (
            <div key={gap.id} onClick={() => toggleGap(gap.id)} style={{
              border: selectedGaps.has(gap.id) ? '2px solid #2A6DB5' : '1px solid var(--border)',
              borderRadius: 8, padding: 14, marginBottom: 8, cursor: 'pointer',
              background: selectedGaps.has(gap.id) ? '#EBF5FF' : 'var(--white)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={selectedGaps.has(gap.id)} readOnly style={{ marginTop: 3 }} />
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1C3557' }}>
                      {(gap.request_type || '').toUpperCase()} #{gap.request_number}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, color: '#276749', background: '#C6F6D5' }}>Confirmed</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{gap.gap_description}</div>
                  {gap.ai_reasoning && (
                    <div style={{ fontSize: '0.78rem', color: '#2A6DB5', marginTop: 4 }}>{gap.ai_reasoning}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {motionText && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, maxWidth: 700, width: '90%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1C3557' }}>Motion to Compel — Draft</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>{motionText}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setMotionText(null)} style={{ padding: '8px 18px', background: 'var(--light-gray)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>Close</button>
              <button onClick={() => navigator.clipboard.writeText(motionText)} style={{ padding: '8px 18px', background: '#2A6DB5', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Copy to Clipboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
