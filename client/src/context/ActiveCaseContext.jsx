import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const ActiveCaseContext = createContext(null);

export function ActiveCaseProvider({ children }) {
  const [cases, setCases] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState('');
  const [activeCase, setActiveCase] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load paralegal's assigned cases
  useEffect(() => {
    api.get('/discovery-workspace')
      .then((res) => {
        const list = Array.isArray(res) ? res : res.cases || [];
        setCases(list);
        if (list.length > 0 && !activeCaseId) {
          setActiveCaseId(list[0].id);
        }
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  // Load active case details when ID changes
  const loadActiveCase = useCallback(() => {
    if (!activeCaseId) { setActiveCase(null); return; }
    api.get(`/discovery-workspace/${activeCaseId}/summary`)
      .then((res) => {
        if (res && res.case) {
          setActiveCase({
            ...res.case,
            open_gap_count: Array.isArray(res.open_gaps) ? res.open_gaps.reduce((s, g) => s + Number(g.count || 0), 0) : 0,
            pending_supplement_count: Number(res.pending_supplement_count || 0),
            overdue_supplement_count: Number(res.overdue_supplement_count || 0),
            exhibit_count: Number(res.exhibit_count || 0),
            resolved_gap_count: Number(res.resolved_gap_count || 0),
            last_response_date: res.last_response_date,
            ready_to_file: res.ready_to_file || false,
          });
        }
      })
      .catch(() => setActiveCase(null));
  }, [activeCaseId]);

  useEffect(() => { loadActiveCase(); }, [loadActiveCase]);

  const selectCase = (id) => setActiveCaseId(id);
  const refreshCase = loadActiveCase;

  return (
    <ActiveCaseContext.Provider value={{
      cases, activeCaseId, activeCase, loading,
      selectCase, refreshCase,
    }}>
      {children}
    </ActiveCaseContext.Provider>
  );
}

export function useActiveCase() {
  const ctx = useContext(ActiveCaseContext);
  if (!ctx) throw new Error('useActiveCase must be used within ActiveCaseProvider');
  return ctx;
}
