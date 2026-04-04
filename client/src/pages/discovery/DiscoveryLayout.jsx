import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { ActiveCaseProvider, useActiveCase } from '../../context/ActiveCaseContext';
import { useAuth } from '../../context/AuthContext';

/* ── Casey's Design Tokens ─────────────────────────────────── */
const V = {
  bg:       '#f6f5f2',
  surface:  '#fff',
  surface2: '#f0efe9',
  border:   '#e4e2da',
  borderS:  '#ccc9be',
  text:     '#1a1916',
  text2:    '#6b6860',
  text3:    '#9e9b92',
  accent:   '#2563eb',
  accentL:  '#eff4ff',
  red:      '#dc2626',
  amber:    '#d97706',
  green:    '#16a34a',
};
export { V };

const serif = "'Fraunces', Georgia, serif";
const sans  = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const mono  = "'DM Mono', 'SF Mono', monospace";
export { serif, sans, mono };

/* ── Font loader ───────────────────────────────────────────── */
const FONT_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Fraunces:wght@600;700&display=swap';

function useCaseyFonts() {
  useEffect(() => {
    if (!document.getElementById('casey-fonts')) {
      const link = document.createElement('link');
      link.id = 'casey-fonts';
      link.rel = 'stylesheet';
      link.href = FONT_URL;
      document.head.appendChild(link);
    }
  }, []);
}

/* ── Sidebar nav items ─────────────────────────────────────── */
const navItems = [
  { to: '/discovery/dashboard',          label: 'Dashboard',           icon: '📋' },
  { to: '/discovery/gaps',               label: 'Gap Analysis',        icon: '🔍' },
  { to: '/discovery/supplements',        label: 'Supplements',         icon: '📊' },
  { to: '/discovery/deficiency-letters', label: 'Deficiency Letters',  icon: '⚠️' },
  { to: '/discovery/exhibits',           label: 'Exhibits',            icon: '📁' },
];

const firmItems = [
  { to: '/discovery-library', label: 'Discovery Library', icon: '📚' },
  { to: '/firm-brain',        label: 'Firm Brain',        icon: '🧠' },
];

/* ── Inner layout (needs ActiveCaseContext) ─────────────────── */
function DiscoveryInner() {
  useCaseyFonts();
  const { user, logout } = useAuth();
  const { cases, activeCaseId, activeCase, selectCase, loading: casesLoading } = useActiveCase();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: V.bg, fontFamily: sans, color: V.text,
    }}>
      {/* ── CASEY'S SIDEBAR (220px) ────────────────────────── */}
      <aside style={{
        width: 220, minWidth: 220, background: V.surface,
        borderRight: `1px solid ${V.border}`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: `1px solid ${V.border}`,
        }}>
          <div style={{
            fontFamily: serif, fontWeight: 700, fontSize: '1.05rem',
            color: V.text, letterSpacing: '-0.01em',
          }}>
            First Chair
          </div>
          <div style={{ fontSize: '0.68rem', color: V.text3, marginTop: 2 }}>
            Discovery
          </div>
        </div>

        {/* Active Case display */}
        {activeCase && (
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${V.border}`,
            background: V.accentL,
          }}>
            <div style={{
              fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: V.accent, marginBottom: 6,
            }}>
              Active Case
            </div>
            <div style={{
              fontFamily: sans, fontWeight: 600, fontSize: '0.85rem',
              color: V.text, lineHeight: 1.3,
            }}>
              {activeCase.plaintiff_name || activeCase.client_name}
            </div>
            <div style={{
              fontFamily: mono, fontSize: '0.72rem',
              color: V.text3, marginTop: 2,
            }}>
              {activeCase.case_number}
            </div>
          </div>
        )}

        {/* Case selector dropdown */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${V.border}` }}>
          <select
            value={activeCaseId}
            onChange={e => selectCase(e.target.value)}
            style={{
              width: '100%', padding: '7px 8px', fontSize: '0.78rem', fontFamily: sans,
              border: `1px solid ${V.border}`, borderRadius: 6, background: V.surface,
              color: V.text, outline: 'none', cursor: 'pointer',
            }}
          >
            {cases.length === 0 && <option value="">No cases</option>}
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>
            ))}
          </select>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 400,
                fontFamily: sans,
                background: isActive ? V.accentL : 'transparent',
                color: isActive ? V.accent : V.text2,
                borderLeft: isActive ? `3px solid ${V.accent}` : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.12s',
              })}
            >
              <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Firm Section */}
          <div style={{
            padding: '14px 16px 6px', marginTop: 8,
            fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: V.text3,
          }}>
            Firm
          </div>
          {firmItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', fontSize: '0.8rem',
                fontFamily: sans,
                color: isActive ? V.accent : V.text2,
                background: isActive ? V.accentL : 'transparent',
                borderLeft: '3px solid transparent',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: '0.9rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Back to main app */}
          <div style={{ padding: '8px 16px', marginTop: 8, borderTop: `1px solid ${V.border}`, paddingTop: 14 }}>
            <NavLink
              to="/cases"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: '0.78rem', color: V.text3, textDecoration: 'none',
              }}
            >
              ← Back to Cases
            </NavLink>
          </div>
        </nav>

        {/* Footer */}
        <div style={{
          padding: '14px 16px',
          borderTop: `1px solid ${V.border}`,
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: V.text }}>
            {user?.name || 'User'}
          </div>
          <div style={{
            fontSize: '0.68rem', textTransform: 'capitalize',
            color: V.text3, marginTop: 2,
          }}>
            {user?.role || ''}
          </div>
          <button onClick={handleLogout} style={{
            marginTop: 8, width: '100%', padding: '6px 0',
            fontSize: '0.72rem', fontFamily: sans, fontWeight: 500,
            background: 'transparent', border: `1px solid ${V.border}`,
            borderRadius: 6, color: V.text2, cursor: 'pointer',
          }}>
            Log Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ──────────────────────────────── */}
      <main style={{
        marginLeft: 220, flex: 1, minHeight: '100vh',
        padding: '28px 32px',
        background: V.bg,
      }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ── Exported layout wraps with ActiveCaseProvider ─────────── */
export default function DiscoveryLayout() {
  return (
    <ActiveCaseProvider>
      <DiscoveryInner />
    </ActiveCaseProvider>
  );
}
