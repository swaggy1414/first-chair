import pool from '../db.js';

export async function checkReadiness(caseId) {
  const blockers = [];

  // 1. Check discovery gaps — every gap must be confirmed or dismissed (not open)
  const { rows: openGaps } = await pool.query(`
    SELECT dg.id, dg.gap_type, dg.request_number, dg.request_type, dg.gap_description, dg.status, dg.gap_action
    FROM discovery_gaps dg
    WHERE dg.case_id = $1
      AND dg.status NOT IN ('resolved', 'waived')
      AND (dg.gap_action IS NULL OR dg.gap_action NOT IN ('confirmed', 'dismissed'))
  `, [caseId]);

  for (const g of openGaps) {
    blockers.push({
      category: 'discovery_gap',
      severity: 'high',
      message: `${g.request_type || 'Request'} #${g.request_number || '?'} — ${g.gap_type?.replace(/_/g, ' ')} — needs confirm or dismiss`,
      detail: g.gap_description || null,
      id: g.id,
    });
  }

  // 2. Check supplementation requests — all must have response_received
  const { rows: pendingSupplements } = await pool.query(`
    SELECT sr.id, sr.sent_at, sr.status,
      dr.file_name as response_file,
      (CURRENT_DATE - sr.sent_at::date) as days_waiting
    FROM supplementation_requests sr
    JOIN discovery_responses dr ON sr.discovery_response_id = dr.id
    WHERE sr.case_id = $1
      AND sr.status = 'sent'
      AND sr.client_responded_at IS NULL
  `, [caseId]);

  for (const s of pendingSupplements) {
    const overdue = s.days_waiting > 10;
    blockers.push({
      category: 'supplement',
      severity: overdue ? 'high' : 'medium',
      message: `Supplementation request pending${overdue ? ' (OVERDUE)' : ''} — ${s.days_waiting} days waiting`,
      detail: `Response file: ${s.response_file}`,
      id: s.id,
    });
  }

  // 3. Check client questionnaires — none should be in 'sent' status (not responded)
  const { rows: pendingQuestionnaires } = await pool.query(`
    SELECT dq.id, dq.sent_at, dq.status, dq.client_email,
      (CURRENT_DATE - dq.sent_at::date) as days_waiting
    FROM discovery_questionnaires dq
    WHERE dq.case_id = $1
      AND dq.status IN ('sent', 'overdue')
  `, [caseId]);

  for (const q of pendingQuestionnaires) {
    blockers.push({
      category: 'questionnaire',
      severity: q.status === 'overdue' ? 'high' : 'medium',
      message: `Client questionnaire ${q.status === 'overdue' ? 'OVERDUE' : 'pending'} — sent ${q.days_waiting} days ago to ${q.client_email || 'client'}`,
      detail: null,
      id: q.id,
    });
  }

  // 4. Check we actually have discovery responses
  const { rows: responseCount } = await pool.query(
    'SELECT COUNT(*) as count FROM discovery_responses WHERE case_id = $1',
    [caseId]
  );
  const hasResponses = Number(responseCount[0].count) > 0;

  if (!hasResponses) {
    blockers.push({
      category: 'no_responses',
      severity: 'high',
      message: 'No discovery responses uploaded yet',
      detail: null,
      id: null,
    });
  }

  // 5. Check for gaps that are confirmed but not yet resolved (motion may be needed)
  const { rows: confirmedNotResolved } = await pool.query(`
    SELECT COUNT(*) as count
    FROM discovery_gaps
    WHERE case_id = $1
      AND gap_action = 'confirmed'
      AND status NOT IN ('resolved', 'waived')
  `, [caseId]);
  const confirmedPending = Number(confirmedNotResolved[0].count);
  if (confirmedPending > 0) {
    blockers.push({
      category: 'confirmed_gaps',
      severity: 'medium',
      message: `${confirmedPending} confirmed gap(s) still open — motion to compel may be needed`,
      detail: null,
      id: null,
    });
  }

  const ready = blockers.length === 0 && hasResponses;

  return {
    ready,
    blocker_count: blockers.length,
    blockers,
    summary: {
      open_gaps: openGaps.length,
      pending_supplements: pendingSupplements.length,
      pending_questionnaires: pendingQuestionnaires.length,
      confirmed_pending_resolution: confirmedPending,
      has_responses: hasResponses,
    },
  };
}
