import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import MorningBrief from './pages/MorningBrief';
import CaseList from './pages/CaseList';
import CaseDetail from './pages/CaseDetail';
import RecordsTracker from './pages/RecordsTracker';
import AttorneyQueue from './pages/AttorneyQueue';
import CapacityDashboard from './pages/CapacityDashboard';
import Settings from './pages/Settings';
import DiscoveryLibrary from './pages/DiscoveryLibrary';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MorningBrief />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/records" element={<RecordsTracker />} />
        <Route path="/attorney-queue" element={<AttorneyQueue />} />
        <Route path="/capacity" element={<CapacityDashboard />} />
        <Route path="/discovery-library" element={<DiscoveryLibrary />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
