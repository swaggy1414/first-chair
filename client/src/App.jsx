import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import MorningBrief from './pages/MorningBrief';
import WorkQueue from './pages/WorkQueue';
import CaseList from './pages/CaseList';
import CaseDetail from './pages/CaseDetail';
import RecordsTracker from './pages/RecordsTracker';
import AttorneyQueue from './pages/AttorneyQueue';
import CapacityDashboard from './pages/CapacityDashboard';
import Settings from './pages/Settings';
import DiscoveryLibrary from './pages/DiscoveryLibrary';
import KnowledgeBase from './pages/KnowledgeBase';
import SubpoenaManager from './pages/SubpoenaManager';

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/morning-brief" replace />;
  return <Navigate to="/work-queue" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/work-queue" element={<WorkQueue />} />
        <Route path="/morning-brief" element={<MorningBrief />} />
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/records" element={<RecordsTracker />} />
        <Route path="/attorney-queue" element={<AttorneyQueue />} />
        <Route path="/capacity" element={<CapacityDashboard />} />
        <Route path="/discovery-library" element={<DiscoveryLibrary />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/subpoena-manager" element={<SubpoenaManager />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
