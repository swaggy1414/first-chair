import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import DiscoveryProtectedRoute from './components/DiscoveryProtectedRoute';
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
import RecordsFollowup from './pages/RecordsFollowup';
import FirmBrain from './pages/FirmBrain';
import Integrations from './pages/Integrations';

// Casey's Discovery
import DiscoveryDashboard from './pages/discovery/DiscoveryDashboard';
import DiscoveryLayout from './pages/discovery/DiscoveryLayout';
import GapAnalysis from './pages/discovery/GapAnalysis';
import SupplementTracker from './pages/discovery/SupplementTracker';
import DeficiencyLetters from './pages/discovery/DeficiencyLetters';
import ExhibitRedirect from './pages/discovery/ExhibitRedirect';

function DefaultRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/morning-brief" replace />;
  return <Navigate to="/work-queue" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Casey's Discovery — NO navy Layout */}
      <Route element={<DiscoveryProtectedRoute />}>
        {/* Dashboard renders its own full-page layout with sidebar */}
        <Route path="/discovery/dashboard" element={<DiscoveryDashboard />} />
        {/* Other discovery pages use DiscoveryLayout wrapper */}
        <Route path="/discovery" element={<DiscoveryLayout />}>
          <Route index element={<Navigate to="/discovery/dashboard" replace />} />
          <Route path="gaps" element={<GapAnalysis />} />
          <Route path="supplements" element={<SupplementTracker />} />
          <Route path="deficiency-letters" element={<DeficiencyLetters />} />
          <Route path="exhibits" element={<ExhibitRedirect />} />
        </Route>
      </Route>

      {/* Main app — navy Layout */}
      <Route element={<ProtectedRoute />}>
        <Route path="/work-queue" element={<WorkQueue />} />
        <Route path="/morning-brief" element={<MorningBrief />} />
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/records" element={<RecordsTracker />} />
        <Route path="/records-followup" element={<RecordsFollowup />} />
        <Route path="/attorney-queue" element={<AttorneyQueue />} />
        <Route path="/capacity" element={<CapacityDashboard />} />
        <Route path="/discovery-library" element={<DiscoveryLibrary />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/subpoena-manager" element={<SubpoenaManager />} />
        <Route path="/discovery-workspace" element={<Navigate to="/discovery/dashboard" replace />} />
        <Route path="/firm-brain" element={<FirmBrain />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
