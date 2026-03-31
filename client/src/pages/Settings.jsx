import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const sectionStyle = {
  marginBottom: 40,
};

const sectionTitle = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: 'var(--navy)',
  marginBottom: 16,
  paddingBottom: 8,
  borderBottom: '2px solid var(--border)',
};

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
  outline: 'none',
};

const btnPrimary = {
  padding: '8px 18px',
  background: 'var(--blue)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  fontWeight: 600,
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-light)',
  marginBottom: 4,
};

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [attorneys, setAttorneys] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAttorneys, setLoadingAttorneys] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'paralegal', password: '' });
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users')
        .then((res) => setUsers(Array.isArray(res) ? res : res.users || []))
        .catch((err) => setError(err.message))
        .finally(() => setLoadingUsers(false));
    } else {
      setLoadingUsers(false);
    }

    api.get('/users/attorneys')
      .then((res) => setAttorneys(Array.isArray(res) ? res : []))
      .catch(() => setAttorneys([]))
      .finally(() => setLoadingAttorneys(false));
  }, [isAdmin]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    setMsg('');
    try {
      await api.post('/users', newUser);
      setNewUser({ name: '', email: '', role: 'paralegal', password: '' });
      setMsg('User created');
      const res = await api.get('/users');
      setUsers(Array.isArray(res) ? res : res.users || []);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 28 }}>Settings</h1>

      {isAdmin && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>User Management</div>

          <form onSubmit={handleAddUser} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={{ ...inputStyle, width: 180 }} value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={{ ...inputStyle, width: 220 }} type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={{ ...inputStyle, width: 140 }} value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="paralegal">Paralegal</option>
                <option value="attorney">Attorney</option>
                <option value="read_only">Read Only</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input style={{ ...inputStyle, width: 160 }} type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required minLength={8} />
            </div>
            <button style={btnPrimary} type="submit" disabled={addingUser}>{addingUser ? 'Adding...' : 'Add User'}</button>
          </form>

          {msg && <p style={{ fontSize: '0.85rem', color: msg === 'User created' ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{msg}</p>}
          {error && <p style={{ fontSize: '0.85rem', color: 'var(--red)', marginBottom: 12 }}>{error}</p>}

          {loadingUsers ? (
            <p style={{ color: 'var(--text-light)' }}>Loading users...</p>
          ) : users.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>No users</p>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                    <td>{u.is_active === false ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={sectionTitle}>Attorneys</div>
        {loadingAttorneys ? (
          <p style={{ color: 'var(--text-light)' }}>Loading attorneys...</p>
        ) : attorneys.length === 0 ? (
          <p style={{ color: 'var(--text-light)' }}>No attorneys listed</p>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th></tr>
            </thead>
            <tbody>
              {attorneys.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={sectionTitle}>Morning Brief Email Settings</div>
        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Coming soon. Configure automated morning brief emails to attorneys and staff.</p>
      </div>

      {(isAdmin || user?.role === 'supervisor') && (
        <DiscoveryQuestionnaireTemplate />
      )}

      <ObjectionsLibrary user={user} isAdmin={isAdmin} />
    </div>
  );
}

const questionnaireTemplate = `Dear [Client Name],

As part of the litigation process in your case ([Case Number]), we need to gather important information. Please respond to the following questions as completely as possible:

1. Prior Accidents: Have you been involved in any prior accidents or incidents resulting in injury? If so, please describe each incident, including dates, nature of injuries, and any treatment received.

2. Medical Treatment: Please list all medical providers you have seen as a result of this incident, including hospitals, doctors, physical therapists, chiropractors, and any other healthcare providers.

3. Employment: Please describe your current employment status and any impact this incident has had on your ability to work, including any missed days or reduced capacity.

4. Insurance: Please provide information about any insurance policies that may be relevant, including health insurance, auto insurance, and any other applicable coverage.

5. Witnesses: Please identify any witnesses to the incident or anyone who has knowledge of your injuries and their impact on your daily life.

Please return your responses within 10 days. If you have any questions, do not hesitate to contact our office.

Best regards,
First Chair Legal Team`;

function DiscoveryQuestionnaireTemplate() {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Discovery Questionnaire Template</div>
      <textarea
        style={{ ...inputStyle, width: '100%', minHeight: 260, resize: 'vertical', fontFamily: 'inherit' }}
        value={questionnaireTemplate}
        readOnly
      />
      <div style={{ marginTop: 12 }}>
        <button style={btnPrimary} onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>
      </div>
      {showPreview && (
        <div style={{ marginTop: 16, padding: 20, background: 'var(--light-gray)', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {questionnaireTemplate}
        </div>
      )}
    </div>
  );
}

function ObjectionsLibrary({ user, isAdmin }) {
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importMsg, setImportMsg] = useState('');
  const [addForm, setAddForm] = useState({ title: '', objection_text: '', category: 'General Objections' });
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const canImport = isAdmin || user?.role === 'supervisor';

  const loadObjections = () => {
    api.get('/objections')
      .then((res) => setObjections(Array.isArray(res) ? res : []))
      .catch(() => setObjections([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadObjections(); }, []);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportMsg('Importing...');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('http://localhost:3001/api/objections/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(err.message || 'Import failed');
      }
      const data = await res.json();
      setImportMsg(`${data.imported} objections imported, ${data.skipped} skipped`);
      loadObjections();
      setTimeout(() => setImportMsg(''), 5000);
    } catch (err) {
      setImportMsg(err.message);
    }
    e.target.value = '';
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setAddMsg('');
    try {
      await api.post('/objections', addForm);
      setAddForm({ title: '', objection_text: '', category: 'General Objections' });
      setAddMsg('Objection added');
      loadObjections();
      setTimeout(() => setAddMsg(''), 3000);
    } catch (err) {
      setAddMsg(err.message);
    } finally {
      setAdding(false);
    }
  };

  const categories = ['General Objections', 'Interrogatory Objections', 'RFA Objections', 'RPD Objections', 'Privilege', 'Other'];

  return (
    <div style={sectionStyle}>
      <div style={sectionTitle}>Objections Library</div>

      {canImport && (
        <div style={{ marginBottom: 16 }}>
          <label style={btnPrimary}>
            Import from Word Document
            <input type="file" accept=".docx" onChange={handleImport} style={{ display: 'none' }} />
          </label>
          {importMsg && <span style={{ marginLeft: 12, fontSize: '0.85rem', color: importMsg.includes('imported') ? 'var(--green)' : 'var(--text)' }}>{importMsg}</span>}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={{ ...inputStyle, width: 180 }} value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} required />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select style={{ ...inputStyle, width: 200 }} value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Objection Text</label>
          <textarea style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical' }} value={addForm.objection_text} onChange={(e) => setAddForm({ ...addForm, objection_text: e.target.value })} required />
        </div>
        <button style={btnPrimary} type="submit" disabled={adding}>{adding ? 'Adding...' : 'Add Objection'}</button>
      </form>
      {addMsg && <p style={{ fontSize: '0.85rem', color: addMsg === 'Objection added' ? 'var(--green)' : 'var(--red)', marginBottom: 12 }}>{addMsg}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-light)' }}>Loading objections...</p>
      ) : objections.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No objections in library</p>
      ) : (
        <table>
          <thead>
            <tr><th>Title</th><th>Category</th><th>Source</th><th>Use Count</th></tr>
          </thead>
          <tbody>
            {objections.map((o) => (
              <tr key={o.id}>
                <td>{o.title}</td>
                <td>{o.category}</td>
                <td style={{ textTransform: 'capitalize' }}>{o.source}</td>
                <td>{o.use_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
