import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'var(--light-gray)',
};

const cardStyle = {
  width: 400,
  background: 'var(--white)',
  borderRadius: 8,
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  padding: '40px 36px',
};

const brandStyle = {
  textAlign: 'center',
  marginBottom: 32,
};

const titleStyle = {
  fontSize: '1.8rem',
  fontWeight: 700,
  color: 'var(--navy)',
};

const subtitleStyle = {
  color: 'var(--text-light)',
  fontSize: '0.9rem',
  marginTop: 4,
};

const labelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.95rem',
  outline: 'none',
};

const btnStyle = {
  width: '100%',
  padding: '12px',
  background: 'var(--blue)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '1rem',
  fontWeight: 600,
  marginTop: 8,
};

const errorStyle = {
  background: '#FED7D7',
  color: 'var(--red)',
  padding: '10px 14px',
  borderRadius: 6,
  fontSize: '0.85rem',
  marginBottom: 16,
};

export default function LoginPage() {
  const { login, changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forceChange, setForceChange] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user?.force_password_change) {
        setForceChange(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await changePassword(newPassword);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (forceChange) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={brandStyle}>
            <div style={titleStyle}>First Chair</div>
            <div style={subtitleStyle}>Please set a new password</div>
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>New Password</label>
              <input
                style={inputStyle}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button style={btnStyle} type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Set Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>
          <div style={titleStyle}>First Chair</div>
          <div style={subtitleStyle}>Case Management</div>
        </div>
        {error && <div style={errorStyle}>{error}</div>}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button style={btnStyle} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
