import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function workQueueRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/work-queue
  fastify.get('/', async (request, reply) => {
    try {
      const { role, id: userId } = request.user;
      const problems = [];
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

      // --- PARALEGAL PROBLEMS ---
      if (role === 'paralegal') {
        // 1. discovery_gap_overdue
        const { rows: gapRows } = await pool.query(`
          SELECT dg.id, dg.case_id, dg.gap_description, dg.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - dg.created_at)::int AS days
          FROM discovery_gaps dg
          JOIN cases c ON dg.case_id = c.id
          WHERE dg.status = 'open' AND dg.created_at < NOW() - INTERVAL '7 days'
          AND c.assigned_paralegal_id = $1
          ORDER BY dg.created_at ASC
        `, [userId]);
        for (const row of gapRows) {
          const urgency = row.days >= 30 ? 'critical' : row.days >= 14 ? 'high' : 'medium';
          problems.push({
            id: `discovery_gap_overdue_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'discovery_gap_overdue',
            description: `Discovery gap open ${row.days} days: ${row.gap_description}`,
            urgency,
            days_outstanding: row.days,
            recommended_action: 'Review gap and send supplementation request',
            action_type: 'review_gaps',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 2. records_no_response
        const { rows: recordsRows } = await pool.query(`
          SELECT rr.id, rr.case_id, rr.provider_name, rr.requested_date, rr.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - rr.requested_date)::int AS days
          FROM records_requests rr
          JOIN cases c ON rr.case_id = c.id
          WHERE rr.status IN ('pending','sent') AND rr.requested_date < NOW() - INTERVAL '30 days'
          AND c.assigned_paralegal_id = $1
          ORDER BY rr.requested_date ASC
        `, [userId]);
        for (const row of recordsRows) {
          const urgency = row.days >= 60 ? 'critical' : row.days >= 45 ? 'high' : 'medium';
          problems.push({
            id: `records_no_response_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'records_no_response',
            description: `No response from ${row.provider_name} after ${row.days} days`,
            urgency,
            days_outstanding: row.days,
            recommended_action: `Send follow-up letter to ${row.provider_name}`,
            action_type: 'send_letter',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 3. questionnaire_overdue
        const { rows: questRows } = await pool.query(`
          SELECT dq.id, dq.case_id, dq.sent_at, dq.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - dq.sent_at)::int AS days
          FROM discovery_questionnaires dq
          JOIN cases c ON dq.case_id = c.id
          WHERE dq.status IN ('sent','overdue') AND dq.sent_at < NOW() - INTERVAL '10 days'
          AND c.assigned_paralegal_id = $1
        `, [userId]);
        for (const row of questRows) {
          problems.push({
            id: `questionnaire_overdue_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'questionnaire_overdue',
            description: `Client questionnaire unanswered after ${row.days} days`,
            urgency: 'high',
            days_outstanding: row.days,
            recommended_action: 'Call client to follow up on questionnaire',
            action_type: 'call_client',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 4. case_inactive
        const { rows: inactiveRows } = await pool.query(`
          SELECT c.id AS case_id, c.case_number, c.client_name, c.updated_at, c.created_at,
            EXTRACT(DAY FROM NOW() - c.updated_at)::int AS days
          FROM cases c
          WHERE c.assigned_paralegal_id = $1 AND c.updated_at < NOW() - INTERVAL '14 days'
          AND c.status NOT IN ('settled','closed')
        `, [userId]);
        for (const row of inactiveRows) {
          problems.push({
            id: `case_inactive_${row.case_id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'case_inactive',
            description: `Case inactive for ${row.days} days — no updates`,
            urgency: 'medium',
            days_outstanding: row.days,
            recommended_action: 'Review case and log activity',
            action_type: 'none',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 5. subpoena_overdue
        const { rows: subRows } = await pool.query(`
          SELECT s.id, s.case_id, s.recipient_name, s.response_due_date, s.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - s.response_due_date)::int AS days
          FROM subpoenas s
          JOIN cases c ON s.case_id = c.id
          WHERE s.status IN ('issued','served') AND s.response_due_date < CURRENT_DATE
          AND c.assigned_paralegal_id = $1
        `, [userId]);
        for (const row of subRows) {
          const urgency = row.days >= 30 ? 'critical' : row.days >= 14 ? 'high' : 'medium';
          problems.push({
            id: `subpoena_overdue_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'subpoena_overdue',
            description: `Subpoena to ${row.recipient_name} overdue by ${row.days} days`,
            urgency,
            days_outstanding: row.days,
            recommended_action: 'Follow up on subpoena response',
            action_type: 'send_letter',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }
      }

      // --- ATTORNEY PROBLEMS ---
      if (role === 'attorney') {
        // 1. attorney_request_stuck
        const { rows: stuckRows } = await pool.query(`
          SELECT ar.id, ar.case_id, ar.title, ar.priority, ar.created_at, c.case_number, c.client_name,
            EXTRACT(EPOCH FROM NOW() - ar.created_at)::int / 3600 AS hours
          FROM attorney_requests ar
          JOIN cases c ON ar.case_id = c.id
          WHERE ar.status = 'open' AND ar.priority IN ('critical','high')
          AND ar.created_at < NOW() - INTERVAL '48 hours'
          AND ar.requested_by = $1
        `, [userId]);
        for (const row of stuckRows) {
          problems.push({
            id: `attorney_request_stuck_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'attorney_request_stuck',
            description: `${row.priority} request "${row.title}" open ${Math.floor(row.hours / 24)} days`,
            urgency: 'critical',
            days_outstanding: Math.floor(row.hours / 24),
            recommended_action: 'Review and respond to request',
            action_type: 'approve',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 2. case_demand_ready
        const { rows: demandRows } = await pool.query(`
          SELECT c.id AS case_id, c.case_number, c.client_name, c.updated_at, c.created_at,
            EXTRACT(DAY FROM NOW() - c.updated_at)::int AS days
          FROM cases c
          WHERE c.assigned_attorney_id = $1 AND c.phase = 'demand'
          AND c.updated_at < NOW() - INTERVAL '7 days'
        `, [userId]);
        for (const row of demandRows) {
          problems.push({
            id: `case_demand_ready_${row.case_id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'case_demand_ready',
            description: `Demand phase case inactive ${row.days} days — action needed`,
            urgency: 'high',
            days_outstanding: row.days,
            recommended_action: 'Review demand package and send or escalate',
            action_type: 'approve',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 3. lien_unresolved
        const { rows: lienRows } = await pool.query(`
          SELECT l.id, l.case_id, l.health_plan_name, l.lien_amount, l.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - l.created_at)::int AS days
          FROM liens l
          JOIN cases c ON l.case_id = c.id
          WHERE l.lien_status NOT IN ('resolved') AND c.assigned_attorney_id = $1
          AND c.status NOT IN ('closed','settled')
          AND l.created_at < NOW() - INTERVAL '30 days'
        `, [userId]);
        for (const row of lienRows) {
          problems.push({
            id: `lien_unresolved_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'lien_unresolved',
            description: `Unresolved ${row.health_plan_name} lien ($${row.lien_amount}) — ${row.days} days`,
            urgency: 'high',
            days_outstanding: row.days,
            recommended_action: 'Negotiate or resolve lien',
            action_type: 'none',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }
      }

      // --- SUPERVISOR PROBLEMS ---
      if (role === 'supervisor' || role === 'admin') {
        // 1. case_stalled
        const { rows: stalledRows } = await pool.query(`
          SELECT c.id AS case_id, c.case_number, c.client_name, c.updated_at, c.created_at,
            p.name AS paralegal_name,
            EXTRACT(DAY FROM NOW() - c.updated_at)::int AS days
          FROM cases c
          LEFT JOIN users p ON c.assigned_paralegal_id = p.id
          WHERE c.updated_at < NOW() - INTERVAL '21 days'
          AND c.status NOT IN ('settled','closed')
          ORDER BY c.updated_at ASC
        `);
        for (const row of stalledRows) {
          problems.push({
            id: `case_stalled_${row.case_id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'case_stalled',
            description: `Case stalled ${row.days} days — assigned to ${row.paralegal_name || 'unassigned'}`,
            urgency: 'medium',
            days_outstanding: row.days,
            recommended_action: 'Review case and reassign if needed',
            action_type: 'reassign',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 2. attorney_queue_bottleneck
        const { rows: bottleneckRows } = await pool.query(`
          SELECT ar.id, ar.case_id, ar.title, ar.created_at, c.case_number, c.client_name,
            u.name AS attorney_name,
            EXTRACT(DAY FROM NOW() - ar.created_at)::int AS days
          FROM attorney_requests ar
          JOIN cases c ON ar.case_id = c.id
          LEFT JOIN users u ON ar.requested_by = u.id
          WHERE ar.status = 'open' AND ar.priority = 'critical'
          AND ar.created_at < NOW() - INTERVAL '7 days'
        `);
        for (const row of bottleneckRows) {
          problems.push({
            id: `attorney_queue_bottleneck_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'attorney_queue_bottleneck',
            description: `Critical request "${row.title}" stuck ${row.days} days — ${row.attorney_name}`,
            urgency: 'critical',
            days_outstanding: row.days,
            recommended_action: 'Escalate to attorney',
            action_type: 'escalate',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }

        // 3. records_firm_overdue
        const { rows: firmOverdueRows } = await pool.query(`
          SELECT rr.id, rr.case_id, rr.provider_name, rr.requested_date, rr.created_at, c.case_number, c.client_name,
            EXTRACT(DAY FROM NOW() - rr.requested_date)::int AS days
          FROM records_requests rr
          JOIN cases c ON rr.case_id = c.id
          WHERE rr.status IN ('pending','sent') AND rr.requested_date < NOW() - INTERVAL '45 days'
          ORDER BY rr.requested_date ASC
        `);
        for (const row of firmOverdueRows) {
          problems.push({
            id: `records_firm_overdue_${row.id}`,
            case_id: row.case_id,
            case_number: row.case_number,
            client_name: row.client_name,
            problem_type: 'records_firm_overdue',
            description: `Records from ${row.provider_name} overdue ${row.days} days — ${row.case_number}`,
            urgency: 'high',
            days_outstanding: row.days,
            recommended_action: 'Send follow-up letter',
            action_type: 'send_letter',
            action_url: `/cases/${row.case_id}`,
            created_at: row.created_at,
          });
        }
      }

      // --- ADMIN-ONLY ADDITIONS ---
      if (role === 'admin') {
        // 1. users_forced_password
        const { rows: pwRows } = await pool.query(`
          SELECT u.id, u.name, u.email, u.created_at,
            EXTRACT(DAY FROM NOW() - u.created_at)::int AS days
          FROM users u
          WHERE u.force_password_change = true AND u.created_at < NOW() - INTERVAL '7 days'
        `);
        for (const row of pwRows) {
          problems.push({
            id: `users_forced_password_${row.id}`,
            case_id: null,
            case_number: null,
            client_name: null,
            problem_type: 'users_forced_password',
            description: `${row.name} (${row.email}) hasn't changed default password — ${row.days} days`,
            urgency: 'low',
            days_outstanding: row.days,
            recommended_action: 'Remind user to change password',
            action_type: 'none',
            action_url: null,
            created_at: row.created_at,
          });
        }
      }

      // Sort: urgency order, then days_outstanding descending
      problems.sort((a, b) => {
        const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgDiff !== 0) return urgDiff;
        return b.days_outstanding - a.days_outstanding;
      });

      return { problems };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
