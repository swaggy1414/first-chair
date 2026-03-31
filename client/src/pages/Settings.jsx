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
    </div>
  );
}
