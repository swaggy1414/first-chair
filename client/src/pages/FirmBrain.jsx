import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_URL } from '../api/client';

const DOCUMENT_TYPES = [
  { value: 'brief', label: 'Brief' },
  { value: 'contract', label: 'Contract' },
  { value: 'motion', label: 'Motion' },
  { value: 'settlement_agreement', label: 'Settlement Agreement' },
  { value: 'pleading', label: 'Pleading' },
  { value: 'demand_letter', label: 'Demand Letter' },
  { value: 'deposition', label: 'Deposition Transcript' },
  { value: 'expert_report', label: 'Expert Report' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
];

const cardStyle = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
};

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
  cursor: 'pointer',
};

const labelStyle = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 };

const typeBadge = (type) => {
  const colors = {
    brief: '#3182CE', contract: '#38A169', motion: '#D69E2E',
    settlement_agreement: '#805AD5', pleading: '#DD6B20',
    demand_letter: '#E53E3E', deposition: '#319795',
    expert_report: '#D53F8C', correspondence: '#718096', other: '#A0AEC0',
  };
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    fontSize: '0.75rem', fontWeight: 600, color: '#fff',
    background: colors[type] || '#718096', textTransform: 'capitalize',
  };
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FirmBrain() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // Upload state
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const loadDocuments = useCallback(() => {
    const params = filterType ? `?document_type=${filterType}` : '';
    api.get(`/firm-brain/documents${params}`)
      .then((res) => setDocuments(Array.isArray(res) ? res : []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [filterType]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg('');

    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (documentType) formData.append('document_type', documentType);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/firm-brain/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      setUploadMsg('Document uploaded and analyzed');
      setFile(null);
      setTitle('');
      setDocumentType('');
      // Reset file input
      const fileInput = document.getElementById('firm-brain-file-input');
      if (fileInput) fileInput.value = '';
      loadDocuments();
      setTimeout(() => setUploadMsg(''), 3000);
    } catch (err) {
      setUploadMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await api.post('/firm-intelligence/search', { question: searchQuery });
      setSearchResult(res);
    } catch (err) {
      setSearchResult({ answer: err.message, sources: [], result_count: 0 });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
        Firm Brain
      </h1>
      <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: 24 }}>
        Upload and search your firm's institutional knowledge — briefs, contracts, motions, settlements, and more.
      </p>

      {/* Intelligence Search */}
      <div style={{ ...cardStyle, background: 'var(--navy)', color: 'var(--white)', border: 'none' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, marginTop: 0 }}>
          Ask the Firm Brain
        </h3>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ ...inputStyle, flex: 1, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
            placeholder="Ask anything — e.g., 'What settlement patterns do we see in slip and fall cases?' or 'Tell me about opposing counsel Harmon'"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            style={{ ...btnPrimary, background: 'var(--white)', color: 'var(--navy)', minWidth: 100, opacity: searching ? 0.7 : 1 }}
            type="submit"
            disabled={searching || !searchQuery.trim()}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchResult && (
          <div style={{ marginTop: 16 }}>
            {/* AI Synthesis — primary response */}
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                Analysis
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {searchResult.answer}
              </div>
            </div>

            {/* Source cards — clickable drill-in */}
            {searchResult.sources && searchResult.sources.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  Sources ({searchResult.sources.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {searchResult.sources.map((s, i) => {
                    const typeColors = {
                      Case: '#3182CE', 'Case Knowledge': '#38A169', 'Opposing Counsel': '#D69E2E',
                      Judge: '#805AD5', 'Attorney Note': '#DD6B20', Document: '#319795',
                    };
                    return (
                      <div
                        key={i}
                        role={s.link ? 'button' : undefined}
                        tabIndex={s.link ? 0 : undefined}
                        onClick={s.link ? () => navigate(s.link) : undefined}
                        onKeyDown={s.link ? (e) => { if (e.key === 'Enter') navigate(s.link); } : undefined}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 6,
                          padding: '10px 14px',
                          cursor: s.link ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                          borderLeft: `3px solid ${typeColors[s.type] || '#718096'}`,
                        }}
                        onMouseEnter={s.link ? (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; } : undefined}
                        onMouseLeave={s.link ? (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; } : undefined}
                      >
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: typeColors[s.type] || '#718096', marginBottom: 3 }}>
                          {s.type}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>
                          {s.title}
                        </div>
                        {s.detail && (
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                            {s.detail}
                          </div>
                        )}
                        {s.link && (
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                            Click to open
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div style={{ ...cardStyle, background: 'var(--light-gray)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 14, marginTop: 0 }}>
          Upload Document
        </h3>
        <form onSubmit={handleUpload}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>File</label>
              <input
                id="firm-brain-file-input"
                type="file"
                style={{ ...inputStyle, padding: '6px 8px' }}
                onChange={(e) => setFile(e.target.files[0] || null)}
                accept=".pdf,.doc,.docx,.txt,.rtf,.html,.htm"
              />
            </div>
            <div>
              <label style={labelStyle}>Title (optional)</label>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-detected from filename"
              />
            </div>
            <div>
              <label style={labelStyle}>Document Type</label>
              <select style={inputStyle} value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option value="">Select type...</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button style={{ ...btnPrimary, opacity: (!file || uploading) ? 0.6 : 1 }} type="submit" disabled={!file || uploading}>
              {uploading ? 'Uploading & Analyzing...' : 'Upload & Analyze'}
            </button>
            {uploadMsg && (
              <span style={{ fontSize: '0.85rem', color: uploadMsg.includes('uploaded') ? 'var(--green)' : 'var(--red)' }}>
                {uploadMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>Filter by type:</label>
        <select style={{ ...inputStyle, width: 'auto', minWidth: 180 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Documents</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {documents.length} document{documents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Document List */}
      {loading ? (
        <p style={{ color: 'var(--text-light)' }}>Loading documents...</p>
      ) : documents.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>
            No documents yet. Upload your first document above to start building your firm's knowledge base.
          </p>
        </div>
      ) : (
        documents.map((doc) => (
          <div key={doc.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                  {doc.title}
                </h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <span style={typeBadge(doc.document_type)}>{doc.document_type?.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                    {doc.file_name} · {formatSize(doc.file_size)}
                  </span>
                  {doc.case_number && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--blue)' }}>
                      {doc.case_number}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                <div>{formatDate(doc.created_at)}</div>
                <div>{doc.uploaded_by_name}</div>
              </div>
            </div>

            {doc.ai_summary && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Summary</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
                  {doc.ai_summary}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {doc.ai_extracted_issues && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Legal Issues</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>{doc.ai_extracted_issues}</div>
                </div>
              )}
              {doc.ai_key_clauses && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Key Clauses</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>{doc.ai_key_clauses}</div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
