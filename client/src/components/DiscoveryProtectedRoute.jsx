import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DiscoveryProtectedRoute() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f6f5f2' }}>
        <p style={{ color: '#9e9b92', fontSize: '1rem', fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
