import { useState } from 'react';

const integrations = [
  {
    id: 'filevine',
    name: 'Filevine',
    description: 'Sync cases, contacts, and documents with your Filevine account. Automatically import new cases and keep treatment timelines in sync.',
    envKey: 'FILEVINE_API_KEY',
    unlocks: [
      'Auto-import new cases from Filevine',
      'Sync treatment timelines and provider info',
      'Push demand packages and settlement data back to Filevine',
      'Two-way contact log synchronization',
    ],
    connectFields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'org_id', label: 'Organization ID', type: 'text' },
    ],
  },
  {
    id: 'onedrive',
    name: 'OneDrive / SharePoint',
    description: 'Connect to your firm\'s OneDrive or SharePoint for document storage. Discovery responses, exhibits, and demand packages are stored in your cloud.',
    envKey: 'AZURE_CLIENT_ID',
    unlocks: [
      'Store discovery responses in SharePoint document library',
      'Auto-organize exhibits by case number',
      'Generate shareable links for demand packages',
      'Backup all case documents to cloud storage',
    ],
    connectFields: [
      { key: 'client_id', label: 'Azure Client ID', type: 'text' },
      { key: 'tenant_id', label: 'Tenant ID', type: 'text' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    id: 'email',
    name: 'Email Intake',
    description: 'Monitor an email inbox for incoming discovery responses. PDFs are automatically matched to cases and uploaded for AI analysis.',
    envKey: 'EMAIL_INTAKE_HOST',
    unlocks: [
      'Auto-detect discovery response emails with PDF attachments',
      'Match to cases by case number in subject line',
      'Upload and queue for AI gap analysis automatically',
      'Flag unmatched emails in the work queue for review',
    ],
    connectFields: [
      { key: 'host', label: 'IMAP Host', type: 'text' },
      { key: 'user', label: 'Email Address', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },
];

const cardStyle = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '24px 28px',
  marginBottom: 20,
};

const btnPrimary = {
  padding: '8px 20px',
  background: 'var(--blue)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const btnSecondary = {
  padding: '8px 20px',
  background: 'var(--light-gray)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
};

export default function Integrations() {
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [savedMsg, setSavedMsg] = useState('');

  const handleConnect = (integration) => {
    setActiveModal(integration.id);
    setFormData({});
    setSavedMsg('');
  };

  const handleSave = () => {
    setSavedMsg('Configuration saved. Set the corresponding environment variables on your server to activate this integration.');
    setTimeout(() => { setActiveModal(null); setSavedMsg(''); }, 4000);
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
        Integrations
      </h1>
      <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: 28 }}>
        Connect First Chair to your existing tools. Each integration requires environment variables configured on your server.
      </p>

      {integrations.map((intg) => (
        <div key={intg.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
                  {intg.name}
                </h3>
                <span style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                  background: '#FED7D7', color: 'var(--red)',
                }}>
                  Not Connected
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text)', margin: '0 0 14px', lineHeight: 1.5 }}>
                {intg.description}
              </p>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 4, fontWeight: 600 }}>
                What this unlocks:
              </div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, listStyle: 'disc' }}>
                {intg.unlocks.map((u, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: 3 }}>{u}</li>
                ))}
              </ul>
            </div>
            <div style={{ marginLeft: 20, flexShrink: 0 }}>
              <button style={btnPrimary} onClick={() => handleConnect(intg)}>
                Connect
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--light-gray)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-light)' }}>
            Requires: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 3 }}>{intg.envKey}</code> environment variable
          </div>
        </div>
      ))}

      {/* Connect Modal */}
      {activeModal && (() => {
        const intg = integrations.find(i => i.id === activeModal);
        if (!intg) return null;
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: 'var(--white)', borderRadius: 10, padding: 28, maxWidth: 480, width: '90%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)', marginTop: 0, marginBottom: 16 }}>
                Connect {intg.name}
              </h3>

              {savedMsg ? (
                <div style={{ padding: 16, background: '#C6F6D5', borderRadius: 8, fontSize: '0.88rem', color: 'var(--green)' }}>
                  {savedMsg}
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 16 }}>
                    Enter your {intg.name} credentials. These will be stored as environment variables on your server.
                  </p>
                  {intg.connectFields.map((field) => (
                    <div key={field.key} style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        style={inputStyle}
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button style={btnSecondary} onClick={() => setActiveModal(null)}>Cancel</button>
                    <button style={btnPrimary} onClick={handleSave}>Save Configuration</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
