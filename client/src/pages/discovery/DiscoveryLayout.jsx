import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ActiveCaseProvider, useActiveCase } from '../../context/ActiveCaseContext';

const URGENCY_COLORS = { red: '#E53E3E', yellow: '#DD6B20', green: '#38A169' };

function CaseSelector() {
  const { cases, activeCaseId, selectCase, loading } = useActiveCase();
  const [search, setSearch] = useState('');

  const filtered = search
    ? cases.filter(c => c.client_name.toLowerCase().includes(search.toLowerCase()) || c.case_number.toLowerCase().includes(search.toLowerCase()))
    : cases;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', padding: '0 16px', marginBottom: 8 }}>
        Active Case
      </div>
      <div style={{ padding: '0 12px', marginBottom: 8 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cases..."
          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
        />
      </div>
      {loading ? (
        <div style={{ padding: '8px 16px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
      ) : (
        filtered.map((c) => {
          const active = c.id === activeCaseId;
          return (
            <div
              key={c.id}
              onClick={() => selectCase(c.id)}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                background: active ? 'rgba(42,109,181,0.25)' : 'transparent',
                borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: active ? 600 : 400, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                {c.case_number}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{c.client_name}</span>
                {Number(c.open_gap_count) > 0 && (
                  <span style={{ background: 'var(--red)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                    {c.open_gap_count}
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const subNavItems = [
  { to: '/discovery/dashboard', label: 'Dashboard' },
  { to: '/discovery/gaps', label: 'Gap Analysis' },
  { to: '/discovery/supplements', label: 'Supplements' },
  { to: '/discovery/deficiency-letters', label: 'Deficiency Letters' },
  { to: '/discovery/exhibits', label: 'Exhibits' },
];

const linkBase = {
  display: 'block', padding: '8px 16px', fontSize: '0.82rem',
  color: 'rgba(255,255,255,0.6)', borderLeft: '3px solid transparent',
  transition: 'all 0.1s',
};
const linkActive = {
  ...linkBase, color: '#fff', background: 'rgba(42,109,181,0.2)',
  borderLeft: '3px solid rgba(255,255,255,0.5)',
};

function DiscoverySidebar() {
  return (
    <div style={{ width: 210, background: 'var(--navy)', minHeight: '100vh', position: 'fixed', top: 0, left: 240, bottom: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ padding: '18px 16px 12px', fontSize: '1rem', fontWeight: 700, color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        Discovery
      </div>
      <div style={{ flex: 1, paddingTop: 12, overflowY: 'auto' }}>
        <CaseSelector />
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 8, paddingTop: 8 }}>
          {subNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => isActive ? linkActive : linkBase}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryLayout() {
  return (
    <ActiveCaseProvider>
      <div style={{ display: 'flex' }}>
        <DiscoverySidebar />
        <div style={{ marginLeft: 210, flex: 1, padding: '24px 28px', minHeight: '100vh' }}>
          <Outlet />
        </div>
      </div>
    </ActiveCaseProvider>
  );
}
