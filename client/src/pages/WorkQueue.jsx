import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { executeAction, getReviewGapsUrl } from '../services/work-queue-actions';

const ACTION_LABELS = {
  send_letter: 'Send Letter',
  call_client: 'Call Client',
  review_gaps: 'Review Gaps',
  escalate: 'Escalate',
  reassign: 'Reassign',
  approve: 'Approve',
};

const URGENCY_COLORS = {
  critical: '#E53E3E',
  high: '#DD6B20',
  medium: '#2A6DB5',
  low: '#A0AEC0',
};

const FILTER_OPTIONS = ['all', 'critical', 'high', 'medium', 'low'];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function StatCard({ label, count, bg }) {
  return (
    <div style={{
      background: bg,
      color: '#fff',
      borderRadius: 8,
      padding: '16px 20px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{count}</div>
      <div style={{ fontSize: '0.78rem', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function UrgencyBadge({ urgency }) {
  const bg = URGENCY_COLORS[urgency] || '#A0AEC0';
  return (
    <span style={{
      display: 'inline-block',
      background: bg,
      color: '#fff',
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 4,
      marginBottom: 4,
    }}>
      {urgency}
    </span>
  );
}

export default function WorkQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionStatus, setActionStatus] = useState({});  // { [problemId]: { msg, ok } }

  useEffect(() => {
    function fetchProblems() {
      api.get('/work-queue')
        .then((data) => {
          setProblems(Array.isArray(data) ? data : data.problems || []);
          setError('');
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }

    fetchProblems();
    const interval = setInterval(fetchProblems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = problems.filter((p) => p.urgency === 'critical').length;
  const highCount = problems.filter((p) => p.urgency === 'high').length;
  const mediumCount = problems.filter((p) => p.urgency === 'medium').length;

  const filtered = filter === 'all'
    ? problems
    : problems.filter((p) => p.urgency === filter);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>
        Scanning cases...
      </div>
    );
  }

  if (error) {
    return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;
  }

  return (
    <div>
      {/* Header */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
        Work Queue
      </h1>
      <div style={{ fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: 24 }}>
        {user?.name || 'User'} &mdash; {formatDate(new Date())}
      </div>

      {/* Summary Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total" count={problems.length} bg="#1C3557" />
        <StatCard label="Critical" count={criticalCount} bg="#E53E3E" />
        <StatCard label="High" count={highCount} bg="#DD6B20" />
        <StatCard label="Medium" count={mediumCount} bg="#2A6DB5" />
      </div>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? 'var(--navy)' : 'transparent',
                color: active ? '#fff' : 'var(--text)',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Problem List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>
          No problems detected. All cases are on track.
        </div>
      ) : (
        filtered.map((problem, i) => (
          <div
            key={problem.id || i}
            onClick={() => navigate(problem.action_url || `/cases/${problem.case_id}`)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              padding: 16,
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--light-gray)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Left side */}
            <div style={{ flex: 1 }}>
              <UrgencyBadge urgency={problem.urgency} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                {problem.case_number} &mdash; {problem.client_name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: 2 }}>
                {problem.description}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginTop: 4 }}>
                {problem.days_outstanding} day{problem.days_outstanding !== 1 ? 's' : ''} outstanding
              </div>
            </div>

            {/* Right side */}
            <div style={{ textAlign: 'right', marginLeft: 16, flexShrink: 0 }}>
              {problem.recommended_action && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: 6 }}>
                  {problem.recommended_action}
                </div>
              )}
              {actionStatus[problem.id] && (
                <div style={{ fontSize: '0.75rem', marginBottom: 4, color: actionStatus[problem.id].ok ? 'var(--green)' : 'var(--red)' }}>
                  {actionStatus[problem.id].msg}
                </div>
              )}
              {problem.action_type && problem.action_type !== 'none' && ACTION_LABELS[problem.action_type] && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (problem.action_type === 'review_gaps') {
                      navigate(getReviewGapsUrl(problem));
                      return;
                    }
                    try {
                      const result = await executeAction(problem.action_type, problem);
                      if (result && result.navigate) {
                        navigate(result.navigate);
                      } else if (result) {
                        setActionStatus(prev => ({ ...prev, [problem.id]: { msg: result, ok: true } }));
                        setTimeout(() => setActionStatus(prev => { const n = { ...prev }; delete n[problem.id]; return n; }), 4000);
                      }
                    } catch (err) {
                      setActionStatus(prev => ({ ...prev, [problem.id]: { msg: err.message || 'Action failed', ok: false } }));
                    }
                  }}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {ACTION_LABELS[problem.action_type]}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
