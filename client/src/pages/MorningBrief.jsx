import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 28,
};

const columnContainer = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 24,
};

const columnStyle = {
  background: 'var(--light-gray)',
  borderRadius: 8,
  padding: 20,
  minHeight: 300,
};

const columnTitle = {
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const cardStyle = {
  background: 'var(--white)',
  borderRadius: 6,
  padding: '12px 14px',
  marginBottom: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  cursor: 'pointer',
};

const aiBtnStyle = {
  padding: '8px 18px',
  background: 'var(--navy)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  fontWeight: 600,
};

const sectionHeading = {
  fontSize: '1.1rem',
  fontWeight: 600,
  color: 'var(--navy)',
  marginBottom: 14,
  marginTop: 32,
};

const statCard = {
  background: 'var(--light-gray)',
  borderRadius: 8,
  padding: 16,
};

const progressBarBg = {
  width: '100%',
  height: 8,
  background: 'var(--border)',
  borderRadius: 4,
  overflow: 'hidden',
  marginTop: 6,
};

const thStyle = { textAlign: 'left', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-light)' };
const tdStyle = { padding: '10px 12px', fontSize: '0.85rem' };

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={progressBarBg}>
      <div style={{ width: pct + '%', height: '100%', background: color || 'var(--blue)', borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function BriefCard({ item, onClick }) {
  const isSubpoena = !!item.recipient_name;
  return (
    <div style={cardStyle} onClick={onClick}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
        {item.case_number || ''}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: 2 }}>
        {isSubpoena ? `Subpoena due: ${item.recipient_name}` : (item.title || item.gap_description || '')}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
        Due: {formatDate(item.due_date || item.response_due_date)}
      </div>
    </div>
  );
}

// ─── Paralegal Dashboard ───
function ParalegalDashboard({ roleData, navigate }) {
  const myCases = roleData.my_cases || [];
  const overdueRecords = roleData.overdue_records || [];
  const discoveryGaps = roleData.discovery_gaps || [];
  const deadlines = roleData.upcoming_deadlines || [];
  const capacity = roleData.capacity || {};

  return (
    <div>
      {/* My Capacity */}
      <h2 style={sectionHeading}>My Capacity</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Active Cases</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{capacity.active_cases || 0}</div>
          <ProgressBar value={capacity.active_cases || 0} max={20} color="var(--blue)" />
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Open Deadlines</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{capacity.open_deadlines || 0}</div>
          <ProgressBar value={capacity.open_deadlines || 0} max={30} color="var(--yellow)" />
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Pending Records</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{capacity.pending_records || 0}</div>
          <ProgressBar value={capacity.pending_records || 0} max={20} color="var(--green)" />
        </div>
      </div>

      {/* My Cases */}
      <h2 style={sectionHeading}>My Cases</h2>
      {myCases.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No cases assigned</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thStyle}>Case #</th><th style={thStyle}>Client</th><th style={thStyle}>Status</th><th style={thStyle}>Type</th></tr></thead>
          <tbody>
            {myCases.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                <td style={tdStyle}>{c.case_number}</td>
                <td style={tdStyle}>{c.client_name}</td>
                <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{c.status}</td>
                <td style={tdStyle}>{c.incident_type || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Records Overdue */}
      {overdueRecords.length > 0 && (
        <>
          <h2 style={sectionHeading}>Records Overdue</h2>
          {overdueRecords.map((r, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--red)', cursor: 'pointer' }} onClick={() => r.case_id && navigate(`/cases/${r.case_id}`)}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--red)' }}>{r.provider_name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{r.case_number} - Due: {formatDate(r.due_date)}</div>
            </div>
          ))}
        </>
      )}

      {/* Discovery Gaps */}
      {discoveryGaps.length > 0 && (
        <>
          <h2 style={sectionHeading}>Discovery Gaps</h2>
          {discoveryGaps.map((g, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--yellow)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{g.gap_description}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{g.case_number} - Priority: {g.priority || 'high'}</div>
            </div>
          ))}
        </>
      )}

      {/* Upcoming Deadlines */}
      {deadlines.length > 0 && (
        <>
          <h2 style={sectionHeading}>Upcoming Deadlines (Next 7 Days)</h2>
          {deadlines.map((d, i) => (
            <div key={i} style={cardStyle} onClick={() => d.case_id && navigate(`/cases/${d.case_id}`)}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{d.case_number} - Due: {formatDate(d.due_date)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Supervisor/Admin Dashboard ───
const flagDot = (color) => color ? { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color === 'red' ? 'var(--red)' : color === 'yellow' ? 'var(--yellow)' : 'var(--green)', marginRight: 8 } : { display: 'none' };

function SupervisorDashboard({ roleData, navigate }) {
  const paralegals = roleData.paralegal_capacity || [];
  const overdueItems = roleData.overdue_all || [];
  const staleCases = roleData.stale_cases || [];
  const bottlenecks = roleData.queue_bottlenecks || [];
  const volume = roleData.weekly_volume || {};
  const allCases = roleData.all_active_cases || [];

  // Group cases by paralegal, sorted by workload (highest first)
  const sortedParalegals = [...paralegals].sort((a, b) => (Number(b.active_cases) || 0) - (Number(a.active_cases) || 0));
  const casesByParalegal = {};
  const unassigned = [];
  for (const c of allCases) {
    if (c.assigned_paralegal_id && c.paralegal_name) {
      if (!casesByParalegal[c.paralegal_name]) casesByParalegal[c.paralegal_name] = [];
      casesByParalegal[c.paralegal_name].push(c);
    } else {
      unassigned.push(c);
    }
  }

  return (
    <div>
      {/* Weekly Volume */}
      <h2 style={sectionHeading}>Weekly Volume</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>New Cases</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{volume.new_cases_week || volume.new_cases || 0}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Closed Cases</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{volume.closed_week || volume.closed_cases || 0}</div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>Total Active</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{volume.total_active || 0}</div>
        </div>
      </div>

      {/* Paralegal Capacity */}
      <h2 style={sectionHeading}>Paralegal Capacity</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {paralegals.map((p, i) => (
          <div key={i} style={statCard}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>{p.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 2 }}>Cases: {p.active_cases || 0}</div>
            <ProgressBar value={p.active_cases || 0} max={p.max_cases || 20} color="var(--blue)" />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 6, marginBottom: 2 }}>Deadlines: {p.open_deadlines || 0}</div>
            <ProgressBar value={p.open_deadlines || 0} max={30} color="var(--yellow)" />
          </div>
        ))}
        {paralegals.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No paralegal data available</p>}
      </div>

      {/* Cases by Paralegal */}
      <h2 style={sectionHeading}>Cases by Paralegal</h2>
      {sortedParalegals.map((p) => {
        const cases = casesByParalegal[p.name] || [];
        return (
          <div key={p.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy)' }}>{p.name}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', background: 'var(--light-gray)', padding: '2px 10px', borderRadius: 12 }}>{cases.length} active case{cases.length !== 1 ? 's' : ''}</span>
            </div>
            {cases.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', paddingLeft: 12 }}>No active cases</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thStyle}>Flag</th><th style={thStyle}>Case #</th><th style={thStyle}>Client</th><th style={thStyle}>Type</th><th style={thStyle}>Status</th><th style={thStyle}>Phase</th><th style={thStyle}>Attorney</th></tr></thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                      <td style={tdStyle}><span style={flagDot(c.flag_color)} /></td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{c.case_number}</td>
                      <td style={tdStyle}>{c.client_name}</td>
                      <td style={tdStyle}>{c.incident_type || '-'}</td>
                      <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{c.status}</td>
                      <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{(c.phase || '').replace(/_/g, ' ')}</td>
                      <td style={tdStyle}>{c.attorney_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--red)' }}>Unassigned</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', background: '#FED7D7', padding: '2px 10px', borderRadius: 12 }}>{unassigned.length}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thStyle}>Case #</th><th style={thStyle}>Client</th><th style={thStyle}>Type</th><th style={thStyle}>Status</th></tr></thead>
            <tbody>
              {unassigned.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{c.case_number}</td>
                  <td style={tdStyle}>{c.client_name}</td>
                  <td style={tdStyle}>{c.incident_type || '-'}</td>
                  <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Overdue Items */}
      {overdueItems.length > 0 && (
        <>
          <h2 style={sectionHeading}>Overdue Items</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thStyle}>Case #</th><th style={thStyle}>Item</th><th style={thStyle}>Due Date</th><th style={thStyle}>Assigned To</th></tr></thead>
            <tbody>
              {overdueItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)}>
                  <td style={tdStyle}>{item.case_number || '-'}</td>
                  <td style={tdStyle}>{item.title}</td>
                  <td style={{ ...tdStyle, color: 'var(--red)' }}>{formatDate(item.due_date)}</td>
                  <td style={tdStyle}>{item.assigned_to_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Stale Cases */}
      {staleCases.length > 0 && (
        <>
          <h2 style={sectionHeading}>Stale Cases (No Activity 14+ Days)</h2>
          {staleCases.map((c, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--yellow)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.case_number} - {c.client_name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>Last activity: {formatDate(c.last_activity) || 'Unknown'}</div>
            </div>
          ))}
        </>
      )}

      {/* Queue Bottlenecks */}
      {bottlenecks.length > 0 && (
        <>
          <h2 style={sectionHeading}>Queue Bottlenecks (7+ Days)</h2>
          {bottlenecks.map((b, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--red)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{b.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{b.case_number} - Waiting {b.days_waiting || '7+'} days</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Attorney Dashboard ───
function AttorneyDashboard({ roleData, navigate }) {
  const queue = roleData.my_queue || [];
  const myCases = roleData.my_cases || [];
  const decisions = roleData.critical_decisions || [];
  const activity = roleData.recent_activity || [];

  return (
    <div>
      {/* My Queue */}
      {queue.length > 0 && (
        <>
          <h2 style={sectionHeading}>My Queue (Critical / High)</h2>
          {queue.map((item, i) => {
            const isCritical = (item.priority || '').toLowerCase() === 'critical';
            return (
              <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${isCritical ? 'var(--red)' : 'var(--yellow)'}`, cursor: 'pointer' }} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isCritical ? 'var(--red)' : 'var(--yellow)', textTransform: 'uppercase' }}>{item.priority}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{item.case_number}</div>
              </div>
            );
          })}
        </>
      )}

      {/* My Cases */}
      <h2 style={sectionHeading}>My Cases</h2>
      {myCases.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No cases assigned</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead><tr style={{ borderBottom: '2px solid var(--border)' }}><th style={thStyle}>Case #</th><th style={thStyle}>Client</th><th style={thStyle}>Status</th><th style={thStyle}>Type</th></tr></thead>
          <tbody>
            {myCases.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                <td style={tdStyle}>{c.case_number}</td>
                <td style={tdStyle}>{c.client_name}</td>
                <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{c.status}</td>
                <td style={tdStyle}>{c.incident_type || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Decisions Needed */}
      {decisions.length > 0 && (
        <>
          <h2 style={sectionHeading}>Decisions Needed (48+ Hours)</h2>
          {decisions.map((d, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft: '3px solid var(--red)', cursor: 'pointer' }} onClick={() => d.case_id && navigate(`/cases/${d.case_id}`)}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{d.case_number} - Waiting since {formatDate(d.created_at)}</div>
            </div>
          ))}
        </>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <>
          <h2 style={sectionHeading}>Recent Activity</h2>
          {activity.map((a, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.case_number} - {a.contact_type || a.type || ''}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: 2 }}>{a.notes || a.description || ''}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>{formatDate(a.contact_date || a.created_at)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function MorningBrief() {
  const { user } = useAuth();
  const [data, setData] = useState({ today: [], thisWeek: [], watch: [] });
  const [roleData, setRoleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/morning-brief'),
      api.get('/dashboard/role').catch(() => null),
    ])
      .then(([briefRes, roleRes]) => {
        setData({
          today: [...(briefRes.today_deadlines || []), ...(briefRes.subpoenas_due_today || [])],
          thisWeek: briefRes.week_deadlines || [],
          watch: [...(briefRes.overdue_items || []), ...(briefRes.flagged_cases || []), ...(briefRes.subpoenas_overdue || [])],
        });
        setRoleData(roleRes);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAiBrief = () => {
    setAiMessage('Coming soon');
    setTimeout(() => setAiMessage(''), 3000);
  };

  if (loading) {
    return <p style={{ color: 'var(--text-light)' }}>Loading morning brief...</p>;
  }

  if (error) {
    return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;
  }

  const role = roleData?.role || user?.role;

  return (
    <div>
      <div style={headerStyle}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)' }}>Morning Brief</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {aiMessage && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>{aiMessage}</span>
          )}
          <button style={aiBtnStyle} onClick={handleAiBrief}>AI Brief</button>
        </div>
      </div>

      <div style={columnContainer}>
        <div style={columnStyle}>
          <div style={{ ...columnTitle, color: 'var(--red)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
            Today
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-light)' }}>
              {data.today.length}
            </span>
          </div>
          {data.today.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No deadlines due today</p>
          )}
          {data.today.map((item, i) => (
            <BriefCard key={i} item={item} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)} />
          ))}
        </div>

        <div style={columnStyle}>
          <div style={{ ...columnTitle, color: 'var(--yellow)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block' }} />
            This Week
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-light)' }}>
              {data.thisWeek.length}
            </span>
          </div>
          {data.thisWeek.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>No deadlines this week</p>
          )}
          {data.thisWeek.map((item, i) => (
            <BriefCard key={i} item={item} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)} />
          ))}
        </div>

        <div style={columnStyle}>
          <div style={{ ...columnTitle, color: 'var(--red)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
            Watch
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-light)' }}>
              {data.watch.length}
            </span>
          </div>
          {data.watch.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Nothing to watch</p>
          )}
          {data.watch.map((item, i) => (
            <BriefCard key={i} item={item} onClick={() => item.case_id && navigate(`/cases/${item.case_id}`)} />
          ))}
        </div>
      </div>

      {/* Role-specific sections */}
      {roleData && role === 'paralegal' && <ParalegalDashboard roleData={roleData} navigate={navigate} />}
      {roleData && (role === 'supervisor' || role === 'admin') && <SupervisorDashboard roleData={roleData} navigate={navigate} />}
      {roleData && role === 'attorney' && <AttorneyDashboard roleData={roleData} navigate={navigate} />}
    </div>
  );
}
