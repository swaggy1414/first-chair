import { api } from '../api/client';

export async function handleSendLetter(problem) {
  const res = await api.post('/work-queue-actions/send-letter', {
    case_id: problem.case_id,
  });
  return res.message || 'Follow-up letter queued';
}

export async function handleCallClient(problem) {
  const res = await api.post('/work-queue-actions/call-client', {
    case_id: problem.case_id,
  });
  return res.message || 'Call logged';
}

export async function handleEscalate(problem) {
  const res = await api.post('/work-queue-actions/escalate', {
    case_id: problem.case_id,
    description: problem.description,
  });
  return res.message || 'Escalated to attorney';
}

export function getReviewGapsUrl(problem) {
  return `/discovery-workspace?case=${problem.case_id}`;
}

export async function executeAction(actionType, problem) {
  switch (actionType) {
    case 'send_letter':
      return handleSendLetter(problem);
    case 'call_client':
      return handleCallClient(problem);
    case 'escalate':
      return handleEscalate(problem);
    case 'review_gaps':
      return { navigate: getReviewGapsUrl(problem) };
    default:
      return null;
  }
}
