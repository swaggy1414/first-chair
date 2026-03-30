import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/dashboard/morning-brief
  fastify.get('/morning-brief', async (request, reply) => {
    try {
      const [todayDeadlines, weekDeadlines, overdueItems, flaggedCases, recentContacts] = await Promise.all([
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
        `)
      ]);

      return {
        today_deadlines: todayDeadlines.rows,
        week_deadlines: weekDeadlines.rows,
        overdue_items: overdueItems.rows,
        flagged_cases: flaggedCases.rows,
        recent_contacts: recentContacts.rows,
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
}
