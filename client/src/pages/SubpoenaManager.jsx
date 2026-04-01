import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.85rem',
};

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

const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' };
const tdStyle = { padding: '10px 12px', fontSize: '0.85rem' };
const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 };
const fieldGroup = { marginBottom: 16 };

function statusBadge(status, responseDue) {
  const today = new Date();
  const due = responseDue ? new Date(responseDue) : null;
  const isOverdue = due && due < today && !['responded', 'complied', 'quashed'].includes(status);
  const daysOverdue = due ? Math.floor((today - due) / (1000 * 60 * 60 * 24)) : 0;

  let bg = 'var(--light-gray)';
  let color = 'var(--text)';

  if (status === 'responded' || status === 'complied') {
    bg = 'var(--green)'; color = '#fff';
  } else if (status === 'served' && !isOverdue) {
    bg = 'var(--blue)'; color = '#fff';
  } else if (isOverdue && daysOverdue > 30) {
    bg = 'var(--red)'; color = '#fff';
  } else if (isOverdue && daysOverdue > 0) {
    bg = 'var(--yellow)'; color = '#000';
  } else if (status === 'draft') {
    bg = 'var(--light-gray)'; color = 'var(--text)';
  } else if (status === 'issued') {
    bg = 'var(--blue)'; color = '#fff';
  } else if (status === 'quashed') {
    bg = 'var(--red)'; color = '#fff';
  } else if (status === 'deficient') {
    bg = 'var(--yellow)'; color = '#000';
  }

  return { bg, color };
}

function daysOutstanding(responseDue) {
  if (!responseDue) return null;
  const today = new Date();
  const due = new Date(responseDue);
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
  return diff;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Record Response Modal ───
function RecordResponseModal({ subpoena, onClose, onSaved }) {
  const [form, setForm] = useState({
    received_date: new Date().toISOString().split('T')[0],
    response_type: '',
    documents_received: false,
    objections_raised: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/subpoenas/response/${subpoena.id}`, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 500, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700 }}>Record Response - {subpoena.recipient_name}</h3>
        {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Received Date</label>
            <input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Response Type</label>
            <input type="text" value={form.response_type} onChange={(e) => setForm({ ...form, response_type: e.target.value })} style={{ ...inputStyle, width: '100%' }} placeholder="e.g. Full compliance, Partial, Objection" />
          </div>
          <div style={fieldGroup}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.documents_received} onChange={(e) => setForm({ ...form, documents_received: e.target.checked })} />
              Documents Received
            </label>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Objections Raised</label>
            <textarea value={form.objections_raised} onChange={(e) => setForm({ ...form, objections_raised: e.target.value })} style={{ ...inputStyle, width: '100%', minHeight: 60 }} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, width: '100%', minHeight: 60 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Subpoena Flow ───
function CreateSubpoenaFlow({ onClose, onCreated }) {
  const [step, setStep] = useState('lookup');
  const [lookupForm, setLookupForm] = useState({ entity_name: '', state: 'NC' });
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Editable fields from lookup
  const [agentFields, setAgentFields] = useState({
    registered_agent_name: '',
    registered_agent_address: '',
    service_address: '',
    service_department: '',
  });

  // Step 2 fields
  const [details, setDetails] = useState({
    subpoena_type: 'records',
    case_id: '',
    recipient_type: 'business',
    issued_date: new Date().toISOString().split('T')[0],
    response_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [cases, setCases] = useState([]);

  // Step 3 fields
  const [compliance, setCompliance] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Step 4
  const [createdSubpoena, setCreatedSubpoena] = useState(null);
  const [creating, setCreating] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');

  // Load cases for step 2
  useEffect(() => {
    api.get('/cases').then((res) => {
      const list = res.cases || res || [];
      setCases(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const handleLookup = async (forceRefresh) => {
    setLookupLoading(true);
    setLookupError('');
    try {
      const body = { entity_name: lookupForm.entity_name, state: lookupForm.state };
      if (forceRefresh) body.force_refresh = true;
      const result = await api.post('/subpoenas/lookup', body);
      setLookupResult(result);
      setAgentFields({
        registered_agent_name: result.registered_agent_name || '',
        registered_agent_address: result.registered_agent_address || '',
        service_address: result.service_address || '',
        service_department: result.service_department || '',
      });
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const payload = {
        recipient_name: lookupForm.entity_name,
        state_of_service: lookupForm.state,
        is_foreign_subpoena: compliance?.is_foreign || false,
        ...agentFields,
        ...details,
      };
      const result = await api.post(`/subpoenas/create/${details.case_id}`, payload);
      setCreatedSubpoena(result.subpoena || result);
      setStep('generate');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!createdSubpoena?.id) return;
    setGenerating(true);
    try {
      const result = await api.post(`/subpoenas/generate/${createdSubpoena.id}`);
      setGenerateResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkIssued = async () => {
    if (!createdSubpoena?.id) return;
    setMarking(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/subpoenas/${createdSubpoena.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'issued' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Failed to update status');
      }
      setCreatedSubpoena({ ...createdSubpoena, status: 'issued' });
    } catch (err) {
      setError(err.message);
    } finally {
      setMarking(false);
    }
  };

  const loadCompliance = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const result = await api.post(`/subpoenas/compliance/${lookupForm.state}`, {
        issuing_state: 'NC',
        service_state: lookupForm.state,
      });
      setCompliance(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setComplianceLoading(false);
    }
  }, [lookupForm.state]);

  // Auto-load compliance when entering step 3
  useEffect(() => {
    if (step === 'compliance') {
      loadCompliance();
    }
  }, [step, loadCompliance]);

  return (
    <div style={{ border: '2px solid var(--blue)', borderRadius: 8, padding: 24, marginBottom: 24, background: '#F7FAFC' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy)' }}>New Subpoena</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {['lookup', 'details', 'compliance', 'generate'].map((s, i) => (
            <span key={s} style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 12,
              background: step === s ? 'var(--blue)' : 'var(--light-gray)',
              color: step === s ? '#fff' : 'var(--text-light)',
            }}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      {/* Step 1: Lookup */}
      {step === 'lookup' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Entity Name</label>
              <input type="text" value={lookupForm.entity_name} onChange={(e) => setLookupForm({ ...lookupForm, entity_name: e.target.value })} style={{ ...inputStyle, width: '100%' }} placeholder="e.g. Blue Cross Blue Shield" />
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>State</label>
              <input type="text" value={lookupForm.state} onChange={(e) => setLookupForm({ ...lookupForm, state: e.target.value.toUpperCase() })} style={{ ...inputStyle, width: '100%' }} maxLength={2} />
            </div>
            <button type="button" onClick={() => handleLookup(false)} disabled={lookupLoading || !lookupForm.entity_name} style={{ ...btnPrimary, opacity: (lookupLoading || !lookupForm.entity_name) ? 0.6 : 1 }}>
              {lookupLoading ? (lookupForm.state === 'NC' ? 'Checking NC Secretary of State...' : 'Looking up registered agent...') : 'Look Up'}
            </button>
          </div>

          {lookupResult && (
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#fff',
                  background: lookupResult.source === 'nc_sos' ? 'var(--green)' : 'var(--blue)',
                }}>
                  {lookupResult.source === 'nc_sos' ? 'NC Secretary of State' : 'AI Lookup'}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {lookupResult.cached_at && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Last looked up {formatDate(lookupResult.cached_at)}</span>}
                  <button type="button" onClick={() => handleLookup(true)} style={{ ...btnSecondary, fontSize: '0.78rem', padding: '4px 10px' }}>Refresh</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Registered Agent Name</label>
                  <input type="text" value={agentFields.registered_agent_name} onChange={(e) => setAgentFields({ ...agentFields, registered_agent_name: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Registered Agent Address</label>
                  <input type="text" value={agentFields.registered_agent_address} onChange={(e) => setAgentFields({ ...agentFields, registered_agent_address: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Service Address</label>
                  <input type="text" value={agentFields.service_address} onChange={(e) => setAgentFields({ ...agentFields, service_address: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Service Department</label>
                  <input type="text" value={agentFields.service_department} onChange={(e) => setAgentFields({ ...agentFields, service_department: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
            <button type="button" onClick={() => setStep('details')} disabled={!lookupResult} style={{ ...btnPrimary, opacity: lookupResult ? 1 : 0.6 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={fieldGroup}>
              <label style={labelStyle}>Subpoena Type</label>
              <select value={details.subpoena_type} onChange={(e) => setDetails({ ...details, subpoena_type: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="records">Records</option>
                <option value="deposition">Deposition</option>
                <option value="records_and_deposition">Records &amp; Deposition</option>
              </select>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Case</label>
              <select value={details.case_id} onChange={(e) => setDetails({ ...details, case_id: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Select a case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.case_number} - {c.client_name}</option>
                ))}
              </select>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Recipient Type</label>
              <select value={details.recipient_type} onChange={(e) => setDetails({ ...details, recipient_type: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="government">Government</option>
                <option value="hospital">Hospital</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Issued Date</label>
              <input type="date" value={details.issued_date} onChange={(e) => setDetails({ ...details, issued_date: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div style={fieldGroup}>
              <label style={labelStyle}>Response Due Date</label>
              <input type="date" value={details.response_due_date} onChange={(e) => setDetails({ ...details, response_due_date: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>Notes</label>
            <textarea value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} style={{ ...inputStyle, width: '100%', minHeight: 60 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
            <button type="button" onClick={() => setStep('lookup')} style={btnSecondary}>Back</button>
            <button type="button" onClick={() => setStep('compliance')} disabled={!details.case_id} style={{ ...btnPrimary, opacity: details.case_id ? 1 : 0.6 }}>Continue</button>
          </div>
        </div>
      )}

      {/* Step 3: Compliance */}
      {step === 'compliance' && (
        <div>
          {complianceLoading ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Checking compliance requirements...</p>
          ) : compliance ? (
            <div>
              {compliance.is_foreign && (
                <div style={{ background: '#FEFCE8', border: '1px solid var(--yellow)', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem', fontWeight: 600, color: '#92400E' }}>
                  This is a foreign subpoena -- additional steps required
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Foreign Subpoena</span>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: compliance.is_foreign ? 'var(--yellow)' : 'var(--green)' }}>
                      {compliance.is_foreign ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Court Filing Required</span>
                  <div style={{ marginTop: 4, fontSize: '0.85rem' }}>{compliance.court_filing_required ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Commission Required</span>
                  <div style={{ marginTop: 4, fontSize: '0.85rem' }}>{compliance.commission_required ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Notice Period (Days)</span>
                  <div style={{ marginTop: 4, fontSize: '0.85rem' }}>{compliance.notice_period_days || 'N/A'}</div>
                </div>
              </div>
              {compliance.service_requirements && (
                <div style={{ marginTop: 16 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Service Requirements</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.83rem', background: 'var(--white)', padding: 12, borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}>{compliance.service_requirements}</pre>
                </div>
              )}
              {compliance.special_instructions && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Special Instructions</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.83rem', background: 'var(--white)', padding: 12, borderRadius: 6, border: '1px solid var(--border)', marginTop: 4 }}>{compliance.special_instructions}</pre>
                </div>
              )}
              {compliance.common_mistakes && (
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>Common Mistakes</span>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.83rem', background: '#FED7D7', padding: 12, borderRadius: 6, border: '1px solid var(--red)', marginTop: 4 }}>{compliance.common_mistakes}</pre>
                </div>
              )}
            </div>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
            <button type="button" onClick={() => setStep('details')} style={btnSecondary}>Back</button>
            <button type="button" onClick={handleCreate} disabled={creating || complianceLoading} style={{ ...btnPrimary, opacity: (creating || complianceLoading) ? 0.6 : 1 }}>
              {creating ? 'Creating...' : 'Create Subpoena'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Generate & Track */}
      {step === 'generate' && createdSubpoena && (
        <div>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 600 }}>Subpoena Created</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
              <div><strong>Recipient:</strong> {createdSubpoena.recipient_name || lookupForm.entity_name}</div>
              <div><strong>Type:</strong> {createdSubpoena.subpoena_type || details.subpoena_type}</div>
              <div><strong>State:</strong> {createdSubpoena.state || lookupForm.state}</div>
              <div><strong>Status:</strong> {createdSubpoena.status || 'draft'}</div>
              <div><strong>Issued:</strong> {formatDate(createdSubpoena.issued_date || details.issued_date)}</div>
              <div><strong>Due:</strong> {formatDate(createdSubpoena.response_due_date || details.response_due_date)}</div>
            </div>
          </div>

          {generateResult && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--white)', borderRadius: 8, padding: 24, maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem', fontWeight: 700 }}>Generated Subpoena Document</h3>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.83rem', lineHeight: 1.6, background: 'var(--light-gray)', padding: 16, borderRadius: 6 }}>{generateResult.generated_text || generateResult.text || JSON.stringify(generateResult, null, 2)}</pre>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={() => setGenerateResult(null)} style={btnSecondary}>Close</button>
                  <button onClick={() => navigator.clipboard.writeText(generateResult.generated_text || generateResult.text || '')} style={btnPrimary}>Copy to Clipboard</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleGenerate} disabled={generating} style={{ ...btnPrimary, background: 'var(--navy)', opacity: generating ? 0.6 : 1 }}>
              {generating ? 'Generating...' : 'Generate Subpoena Document'}
            </button>
            {createdSubpoena.status !== 'issued' && (
              <button type="button" onClick={handleMarkIssued} disabled={marking} style={{ ...btnPrimary, opacity: marking ? 0.6 : 1 }}>
                {marking ? 'Updating...' : 'Mark Issued'}
              </button>
            )}
            <button type="button" onClick={() => { onCreated(); onClose(); }} style={btnSecondary}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main SubpoenaManager Page ───
export default function SubpoenaManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subpoenas, setSubpoenas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [responseModal, setResponseModal] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const loadSubpoenas = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (stateFilter) params.set('state', stateFilter);
    if (overdueOnly) params.set('overdue', 'true');
    const qs = params.toString();
    api.get(`/subpoenas${qs ? '?' + qs : ''}`)
      .then((res) => {
        const list = res.subpoenas || res || [];
        setSubpoenas(Array.isArray(list) ? list : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, statusFilter, stateFilter, overdueOnly]);

  useEffect(() => { loadSubpoenas(); }, [loadSubpoenas]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Subpoena Manager</h1>
        <button type="button" onClick={() => setShowCreate(true)} style={btnPrimary}>New Subpoena</button>
      </div>

      {error && <div style={{ background: '#FED7D7', color: 'var(--red)', padding: '10px 14px', borderRadius: 6, fontSize: '0.85rem', marginBottom: 16 }}>{error}</div>}

      {showCreate && (
        <CreateSubpoenaFlow
          onClose={() => setShowCreate(false)}
          onCreated={loadSubpoenas}
        />
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search recipient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: 220 }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="served">Served</option>
          <option value="responded">Responded</option>
          <option value="deficient">Deficient</option>
          <option value="complied">Complied</option>
          <option value="quashed">Quashed</option>
        </select>
        <input
          type="text"
          placeholder="State"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
          style={{ ...inputStyle, width: 70 }}
          maxLength={2}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue Only
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Loading subpoenas...</p>
      ) : subpoenas.length === 0 ? (
        <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>No subpoenas found</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>Case #</th>
                <th style={thStyle}>Recipient</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>State</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Issued</th>
                <th style={thStyle}>Response Due</th>
                <th style={thStyle}>Days Outstanding</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subpoenas.map((sub) => {
                const badge = statusBadge(sub.status, sub.response_due_date);
                const days = daysOutstanding(sub.response_due_date);
                const isOverdue = days !== null && days > 0 && !['responded', 'complied', 'quashed'].includes(sub.status);
                return (
                  <tr
                    key={sub.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => sub.case_id && navigate(`/cases/${sub.case_id}`)}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{sub.case_number || '-'}</td>
                    <td style={tdStyle}>{sub.recipient_name || sub.entity_name || '-'}</td>
                    <td style={tdStyle}>{sub.subpoena_type || '-'}</td>
                    <td style={tdStyle}>{sub.state || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, color: badge.color, background: badge.bg }}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDate(sub.issued_date)}</td>
                    <td style={tdStyle}>{formatDate(sub.response_due_date)}</td>
                    <td style={{ ...tdStyle, color: isOverdue ? 'var(--red)' : 'var(--text)', fontWeight: isOverdue ? 700 : 400 }}>
                      {days !== null ? (days > 0 ? `${days} days overdue` : days === 0 ? 'Due today' : `${Math.abs(days)} days left`) : '-'}
                    </td>
                    <td style={tdStyle}>
                      {sub.status === 'served' && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setResponseModal(sub); }}
                          style={{ ...btnSecondary, fontSize: '0.78rem', padding: '4px 10px' }}
                        >
                          Record Response
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {responseModal && (
        <RecordResponseModal
          subpoena={responseModal}
          onClose={() => setResponseModal(null)}
          onSaved={() => { setResponseModal(null); loadSubpoenas(); }}
        />
      )}
    </div>
  );
}
