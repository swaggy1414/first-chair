import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/dashboard/morning-brief
  fastify.get('/morning-brief', async (request, reply) => {
    try {
      const [todayDeadlines, weekDeadlines, overdueItems, flaggedCases, recentContacts, questionnaireFollowups, questionnaireOverdue, subpoenasDueToday, subpoenasOverdue] = await Promise.all([
        // Today's deadlines
        pool.query(`
          SELECT d.*, c.case_number, c.client_name, u.name AS assigned_to_name
          FROM deadlines d
          JOIN cases c ON d.case_id = c.id
          LEFT JOIN users u ON d.assigned_to = u.id
          WHERE d.due_date = CURRENT_DATE AND d.status != 'completed'
          ORDER BY d.due_date ASC
        `),
        // This week's deadlines
        pool.query(`
          SELECT d.*, c.case_number, c.client_name, u.name AS assigned_to_name
          FROM deadlines d
          JOIN cases c ON d.case_id = c.id
          LEFT JOIN users u ON d.assigned_to = u.id
          WHERE d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            AND d.status != 'completed'
          ORDER BY d.due_date ASC
        `),
        // Overdue items
        pool.query(`
          SELECT d.*, c.case_number, c.client_name, u.name AS assigned_to_name
          FROM deadlines d
          JOIN cases c ON d.case_id = c.id
          LEFT JOIN users u ON d.assigned_to = u.id
          WHERE d.due_date < CURRENT_DATE AND d.status != 'completed'
          ORDER BY d.due_date ASC
        `),
        // Flagged cases (red/yellow)
        pool.query(`
          SELECT c.*, p.name AS paralegal_name, a.name AS attorney_name
          FROM cases c
          LEFT JOIN users p ON c.assigned_paralegal_id = p.id
          LEFT JOIN users a ON c.assigned_attorney_id = a.id
          WHERE c.flag_color IN ('red', 'yellow')
          ORDER BY CASE c.flag_color WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 END
        `),
        // Recent contact log entries (last 7 days)
        pool.query(`
          SELECT cl.*, c.case_number, c.client_name, u.name AS logged_by_name
          FROM contact_log cl
          JOIN cases c ON cl.case_id = c.id
          LEFT JOIN users u ON cl.logged_by = u.id
          WHERE cl.contact_date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY cl.contact_date DESC
        `),
        // Questionnaire follow-ups needed (sent 5+ days ago, no follow-up yet)
        pool.query(`
          SELECT dq.*, c.case_number, c.client_name
          FROM discovery_questionnaires dq
          JOIN cases c ON dq.case_id = c.id
          WHERE dq.sent_at + INTERVAL '5 days' <= CURRENT_DATE
            AND dq.follow_up_sent_at IS NULL
            AND dq.status = 'sent'
          ORDER BY dq.sent_at ASC
        `),
        // Questionnaire overdue (written_discovery phase, latest questionnaire not responded, 10+ days)
        pool.query(`
          SELECT DISTINCT ON (c.id) c.id, c.case_number, c.client_name, dq.sent_at, dq.status AS questionnaire_status
          FROM cases c
          JOIN discovery_questionnaires dq ON dq.case_id = c.id
          WHERE c.phase = 'written_discovery'
            AND dq.status != 'responded'
            AND dq.sent_at + INTERVAL '10 days' < NOW()
          ORDER BY c.id, dq.sent_at DESC
        `),
        // Subpoenas due today
        pool.query(`
          SELECT s.*, c.case_number
          FROM subpoenas s
          JOIN cases c ON s.case_id = c.id
          WHERE s.response_due_date = CURRENT_DATE
            AND s.status IN ('served', 'issued')
          ORDER BY s.recipient_name
        `),
        // Subpoenas overdue
        pool.query(`
          SELECT s.*, c.case_number
          FROM subpoenas s
          JOIN cases c ON s.case_id = c.id
          WHERE s.response_due_date < CURRENT_DATE
            AND s.status IN ('served', 'issued')
          ORDER BY s.response_due_date ASC
        `)
      ]);

      return {
        today_deadlines: todayDeadlines.rows,
        week_deadlines: weekDeadlines.rows,
        overdue_items: overdueItems.rows,
        flagged_cases: flaggedCases.rows,
        recent_contacts: recentContacts.rows,
        questionnaire_followups: questionnaireFollowups.rows,
        questionnaire_overdue: questionnaireOverdue.rows,
        subpoenas_due_today: subpoenasDueToday.rows,
        subpoenas_overdue: subpoenasOverdue.rows,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/dashboard/capacity
  fastify.get('/capacity', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          u.id,
          u.name,
          COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('closed', 'settled')) AS active_cases,
          COUNT(DISTINCT d.id) FILTER (WHERE d.status != 'completed') AS open_deadlines,
          COUNT(DISTINCT rr.id) FILTER (WHERE rr.status IN ('sent', 'follow_up')) AS pending_records
        FROM users u
        LEFT JOIN cases c ON c.assigned_paralegal_id = u.id
        LEFT JOIN deadlines d ON d.assigned_to = u.id
        LEFT JOIN records_requests rr ON rr.case_id = c.id
        WHERE u.role = 'paralegal'
        GROUP BY u.id, u.name
        ORDER BY u.name
      `);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/dashboard/role — role-specific dashboard data
  fastify.get('/role', async (request, reply) => {
    try {
      const { role, id: userId } = request.user;

      if (role === 'paralegal') {
        const [myCases, overdueRecords, discoveryGaps, upcomingDeadlines, capacity] = await Promise.all([
          pool.query(`SELECT c.*, a.name AS attorney_name FROM cases c LEFT JOIN users a ON c.assigned_attorney_id = a.id WHERE c.assigned_paralegal_id = $1 AND c.status NOT IN ('closed','settled') ORDER BY c.updated_at DESC`, [userId]),
          pool.query(`SELECT rr.*, c.case_number FROM records_requests rr JOIN cases c ON rr.case_id = c.id WHERE c.assigned_paralegal_id = $1 AND rr.status IN ('sent','follow_up') AND rr.requested_date < CURRENT_DATE - INTERVAL '60 days' ORDER BY rr.requested_date ASC`, [userId]),
          pool.query(`SELECT dg.*, c.case_number, dr.file_name FROM discovery_gaps dg JOIN cases c ON dg.case_id = c.id JOIN discovery_responses dr ON dg.discovery_response_id = dr.id WHERE c.assigned_paralegal_id = $1 AND dg.priority = 'high' AND dg.status = 'open' ORDER BY dg.created_at DESC`, [userId]),
          pool.query(`SELECT d.*, c.case_number, c.client_name FROM deadlines d JOIN cases c ON d.case_id = c.id WHERE d.assigned_to = $1 AND d.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND d.status != 'completed' ORDER BY d.due_date ASC`, [userId]),
          pool.query(`SELECT COUNT(DISTINCT c.id) as active_cases, COUNT(DISTINCT d.id) FILTER (WHERE d.status != 'completed') as open_deadlines, COUNT(DISTINCT rr.id) FILTER (WHERE rr.status IN ('sent','follow_up')) as pending_records FROM cases c LEFT JOIN deadlines d ON d.case_id = c.id LEFT JOIN records_requests rr ON rr.case_id = c.id WHERE c.assigned_paralegal_id = $1 AND c.status NOT IN ('closed','settled')`, [userId]),
        ]);
        return { role: 'paralegal', my_cases: myCases.rows, overdue_records: overdueRecords.rows, discovery_gaps: discoveryGaps.rows, upcoming_deadlines: upcomingDeadlines.rows, capacity: capacity.rows[0] || {} };
      }

      if (role === 'supervisor' || role === 'admin') {
        const [paraCapacity, overdueAll, staleCases, queueBottlenecks, weeklyVolume, allActiveCases] = await Promise.all([
          pool.query(`SELECT u.id, u.name, COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('closed','settled')) AS active_cases, COUNT(DISTINCT d.id) FILTER (WHERE d.status != 'completed') AS open_deadlines, COUNT(DISTINCT rr.id) FILTER (WHERE rr.status IN ('sent','follow_up')) AS pending_records FROM users u LEFT JOIN cases c ON c.assigned_paralegal_id = u.id LEFT JOIN deadlines d ON d.assigned_to = u.id LEFT JOIN records_requests rr ON rr.case_id = c.id WHERE u.role = 'paralegal' GROUP BY u.id, u.name ORDER BY u.name`),
          pool.query(`SELECT d.*, c.case_number, c.client_name, u.name AS assigned_to_name FROM deadlines d JOIN cases c ON d.case_id = c.id LEFT JOIN users u ON d.assigned_to = u.id WHERE d.due_date < CURRENT_DATE AND d.status != 'completed' ORDER BY d.due_date ASC`),
          pool.query(`SELECT c.*, p.name AS paralegal_name, a.name AS attorney_name FROM cases c LEFT JOIN users p ON c.assigned_paralegal_id = p.id LEFT JOIN users a ON c.assigned_attorney_id = a.id WHERE c.status NOT IN ('closed','settled') AND c.updated_at < CURRENT_DATE - INTERVAL '14 days' ORDER BY c.updated_at ASC`),
          pool.query(`SELECT ar.*, c.case_number, u.name AS requester_name FROM attorney_requests ar JOIN cases c ON ar.case_id = c.id LEFT JOIN users u ON ar.requested_by = u.id WHERE ar.status IN ('open','in_progress') AND ar.created_at < CURRENT_DATE - INTERVAL '7 days' ORDER BY ar.priority DESC, ar.created_at ASC`),
          pool.query(`SELECT COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS new_cases_week, COUNT(*) FILTER (WHERE status IN ('closed','settled') AND updated_at >= CURRENT_DATE - INTERVAL '7 days') AS closed_week, COUNT(*) FILTER (WHERE status NOT IN ('closed','settled')) AS total_active FROM cases`),
          pool.query(`SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase, c.flag_color, c.assigned_paralegal_id, p.name AS paralegal_name, a.name AS attorney_name FROM cases c LEFT JOIN users p ON c.assigned_paralegal_id = p.id LEFT JOIN users a ON c.assigned_attorney_id = a.id WHERE c.status NOT IN ('closed','settled') ORDER BY p.name, c.case_number`),
        ]);
        return { role, paralegal_capacity: paraCapacity.rows, overdue_all: overdueAll.rows, stale_cases: staleCases.rows, queue_bottlenecks: queueBottlenecks.rows, weekly_volume: weeklyVolume.rows[0] || {}, all_active_cases: allActiveCases.rows };
      }

      if (role === 'attorney') {
        const [myQueue, myCases, criticalDecisions, recentActivity] = await Promise.all([
          pool.query(`SELECT ar.*, c.case_number, c.client_name FROM attorney_requests ar JOIN cases c ON ar.case_id = c.id WHERE ar.requested_by = $1 AND ar.status IN ('open','in_progress') AND ar.priority IN ('critical','high') ORDER BY CASE ar.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 END, ar.created_at ASC`, [userId]),
          pool.query(`SELECT c.*, p.name AS paralegal_name FROM cases c LEFT JOIN users p ON c.assigned_paralegal_id = p.id WHERE c.assigned_attorney_id = $1 AND c.status NOT IN ('closed','settled') ORDER BY c.updated_at DESC`, [userId]),
          pool.query(`SELECT ar.*, c.case_number FROM attorney_requests ar JOIN cases c ON ar.case_id = c.id WHERE ar.requested_by = $1 AND ar.priority = 'critical' AND ar.status IN ('open','in_progress') AND ar.created_at < NOW() - INTERVAL '48 hours' ORDER BY ar.created_at ASC`, [userId]),
          pool.query(`SELECT cl.*, c.case_number, u.name AS logged_by_name FROM contact_log cl JOIN cases c ON cl.case_id = c.id LEFT JOIN users u ON cl.logged_by = u.id WHERE c.assigned_attorney_id = $1 AND cl.contact_date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY cl.contact_date DESC LIMIT 20`, [userId]),
        ]);
        return { role: 'attorney', my_queue: myQueue.rows, my_cases: myCases.rows, critical_decisions: criticalDecisions.rows, recent_activity: recentActivity.rows };
      }

      // Default for records_team or other roles
      return { role, message: 'No role-specific dashboard available' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
