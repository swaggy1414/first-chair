import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

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

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function BriefCard({ item, onClick }) {
  return (
    <div style={cardStyle} onClick={onClick}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
        {item.case_number || item.caseNumber || ''}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: 2 }}>
        {item.title || item.description || ''}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
        Due: {formatDate(item.due_date || item.dueDate)}
      </div>
    </div>
  );
}

export default function MorningBrief() {
  const [data, setData] = useState({ today: [], thisWeek: [], watch: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard/morning-brief')
      .then((res) => {
        setData({
          today: res.today_deadlines || [],
          thisWeek: res.week_deadlines || [],
          watch: [...(res.overdue_items || []), ...(res.flagged_cases || [])],
        });
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
    </div>
  );
}
