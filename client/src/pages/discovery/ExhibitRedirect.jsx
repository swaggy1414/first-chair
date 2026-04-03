import { Navigate } from 'react-router-dom';
import { useActiveCase } from '../../context/ActiveCaseContext';

export default function ExhibitRedirect() {
  const { activeCaseId } = useActiveCase();
  if (activeCaseId) {
    return <Navigate to={`/cases/${activeCaseId}`} replace />;
  }
  return <Navigate to="/cases" replace />;
}
