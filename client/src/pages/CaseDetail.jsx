import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: 'var(--red)', background: '#FED7D7', borderRadius: 8 }}>
          <p style={{ fontWeight: 600 }}>This tab encountered an error.</p>
          <p style={{ fontSize: '0.85rem', marginTop: 8 }}>{this.state.error?.message || 'Unknown error'}</p>
          <button style={{ marginTop: 12, padding: '6px 14px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }} onClick={() => this.setState({ hasError: false, error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import InfoTab from '../components/case-tabs/InfoTab';
import DeadlinesTab from '../components/case-tabs/DeadlinesTab';
import RecordsTab from '../components/case-tabs/RecordsTab';
import RequestsTab from '../components/case-tabs/RequestsTab';
import ContactLogTab from '../components/case-tabs/ContactLogTab';
import TreatmentTab from '../components/case-tabs/TreatmentTab';
import ExhibitsTab from '../components/case-tabs/ExhibitsTab';
import DiscoveryTab from '../components/case-tabs/DiscoveryTab';

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

export default function CaseDetail() {
  const { id } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const loadCase = useCallback(() => {
    if (!id) { setError('No case ID'); setLoading(false); return; }
    api.get(`/cases/${id}`)
      .then((res) => {
        if (res && res.id) {
          setCaseData(res);
        } else if (res && res.case) {
          setCaseData(res.case);
        } else {
          setError('Case not found');
        }
      })
      .catch((err) => setError(err.message || 'Failed to load case'))
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
            background: flagColors[caseData.flag_color] || 'var(--green)',
            display: 'inline-block',
          }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy)' }}>
            {caseData.case_number}
          </h1>
          <StatusBadge status={caseData.status} />
        </div>
        <p style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>
          {caseData.client_name}
          {caseData.incident_type && <span> &mdash; {caseData.incident_type}</span>}
        </p>
      </div>

      <div style={tabBarStyle}>
        {tabNames.map((name, i) => (
          <button key={name} style={tabStyle(activeTab === i)} onClick={() => setActiveTab(i)}>
            {name}
          </button>
        ))}
      </div>

      <TabErrorBoundary key={activeTab}>
        {renderTab()}
      </TabErrorBoundary>
    </div>
  );
}
