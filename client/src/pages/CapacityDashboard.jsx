import { useState, useEffect } from 'react';
import { api } from '../api/client';

function capacityLevel(count) {
  if (count >= 20) return { color: 'var(--red)', label: 'Critical' };
  if (count >= 15) return { color: 'var(--yellow)', label: 'Warning' };
  return { color: 'var(--green)', label: 'Good' };
}

const cardStyle = {
  background: 'var(--white)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
};

const gaugeContainer = {
  width: '100%',
  height: 10,
  background: 'var(--light-gray)',
  borderRadius: 5,
  overflow: 'hidden',
  marginTop: 10,
};

const pdfBtnStyle = {
  padding: '10px 22px',
  background: 'var(--navy)',
  color: 'var(--white)',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.9rem',
  fontWeight: 600,
};

export default function CapacityDashboard() {
  const [paralegals, setParalegals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/capacity')
      .then((res) => setParalegals(Array.isArray(res) ? res : res.paralegals || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--text-light)' }}>Loading capacity data...</p>;
  if (error) return <p style={{ color: 'var(--red)' }}>Error: {error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)' }}>Capacity Dashboard</h1>
        <button style={pdfBtnStyle} onClick={() => alert('Coming soon')}>Download PDF</button>
      </div>

      {paralegals.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No paralegal data available</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {paralegals.map((p) => {
            const cap = capacityLevel(p.active_cases || 0);
            const pct = Math.min(((p.active_cases || 0) / 25) * 100, 100);
            return (
              <div key={p.id || p.name} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 2 }}>
                      {cap.label}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    padding: '3px 10px', borderRadius: 12,
                    background: cap.color + '1A', color: cap.color,
                  }}>
                    {p.active_cases || 0} cases
                  </span>
                </div>

                <div style={gaugeContainer}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: cap.color,
                    borderRadius: 5,
                    transition: 'width 0.3s',
                  }} />
                </div>

                <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: '0.82rem', color: 'var(--text-light)' }}>
                  <span>Open Deadlines: <strong style={{ color: 'var(--text)' }}>{p.open_deadlines ?? 0}</strong></span>
                  <span>Pending Records: <strong style={{ color: 'var(--text)' }}>{p.pending_records ?? 0}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
