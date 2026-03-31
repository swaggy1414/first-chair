import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Morning Brief' },
  { to: '/cases', label: 'Cases' },
  { to: '/records', label: 'Records' },
  { to: '/attorney-queue', label: 'Attorney Queue' },
  { to: '/capacity', label: 'Capacity' },
  { to: '/discovery-library', label: 'Discovery Library', roles: ['admin', 'supervisor', 'paralegal', 'attorney'] },
  { to: '/settings', label: 'Settings' },
];

const sidebarStyle = {
  width: 240,
  minHeight: '100vh',
  background: 'var(--navy)',
  color: 'var(--white)',
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
};

const logoStyle = {
  padding: '24px 20px 20px',
  fontSize: '1.3rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const navStyle = {
  flex: 1,
  padding: '12px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const linkBase = {
  display: 'block',
  padding: '10px 20px',
  fontSize: '0.9rem',
  color: 'rgba(255,255,255,0.7)',
  transition: 'all 0.15s',
  borderLeft: '3px solid transparent',
};

const linkActive = {
  ...linkBase,
  color: 'var(--white)',
  background: 'rgba(42,109,181,0.25)',
  borderLeft: '3px solid var(--blue)',
};

const footerStyle = {
  padding: '16px 20px',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  fontSize: '0.8rem',
};

const logoutBtn = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.3)',
  color: 'var(--white)',
  padding: '6px 14px',
  borderRadius: 4,
  fontSize: '0.8rem',
  marginTop: 8,
  width: '100%',
};

const contentStyle = {
  marginLeft: 240,
  minHeight: '100vh',
  background: 'var(--white)',
  padding: '28px 32px',
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex' }}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>First Chair</div>
        <nav style={navStyle}>
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => (isActive ? linkActive : linkBase)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={footerStyle}>
          <div style={{ fontWeight: 600 }}>{user?.name || 'User'}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
            {user?.role || ''}
          </div>
          <button style={logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>
      <main style={contentStyle}>{children}</main>
    </div>
  );
}
