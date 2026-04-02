import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function discoveryWorkspaceRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/discovery-workspace
  fastify.get('/', async (request, reply) => {
    try {
      const { role, id: userId } = request.user;

      let query = `
        SELECT c.id, c.case_number, c.client_name, c.status, c.phase, c.assigned_paralegal_id,
          (SELECT COUNT(*) FROM discovery_gaps dg WHERE dg.case_id = c.id AND dg.status = 'open') AS open_gap_count,
          (SELECT COUNT(*) FROM supplementation_requests sr WHERE sr.case_id = c.id AND sr.status = 'sent' AND sr.client_responded_at IS NULL) AS pending_supplement_count,
          CASE WHEN
            (SELECT COUNT(*) FROM discovery_responses dr WHERE dr.case_id = c.id) > 0
            AND (SELECT COUNT(*) FROM discovery_gaps dg WHERE dg.case_id = c.id AND dg.status = 'open') = 0
            AND (SELECT COUNT(*) FROM supplementation_requests sr WHERE sr.case_id = c.id AND sr.status = 'sent' AND sr.client_responded_at IS NULL) = 0
          THEN true ELSE false END AS ready_to_file
        FROM cases c
        WHERE c.status NOT IN ('closed', 'settled')
      `;
      const params = [];

      if (role === 'paralegal') {
        params.push(userId);
        query += ` AND c.assigned_paralegal_id = $1`;
      }

      query += ` ORDER BY open_gap_count DESC, c.case_number`;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/discovery-workspace/:caseId/summary
  fastify.get('/:caseId/summary', async (request, reply) => {
    try {
      const { caseId } = request.params;

      const { rows: caseRows } = await pool.query('SELECT c.* FROM cases c WHERE c.id = $1', [caseId]);
      if (caseRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const { rows: gapBreakdown } = await pool.query(
        `SELECT gap_type, priority, COUNT(*) as count FROM discovery_gaps WHERE case_id = $1 AND status = 'open' GROUP BY gap_type, priority`,
        [caseId]
      );

      const { rows: pendingSupplements } = await pool.query(
        `SELECT COUNT(*) as count FROM supplementation_requests WHERE case_id = $1 AND status = 'sent' AND client_responded_at IS NULL`,
        [caseId]
      );

      const { rows: overdueSupplements } = await pool.query(
        `SELECT COUNT(*) as overdue FROM supplementation_requests WHERE case_id = $1 AND status = 'sent' AND client_responded_at IS NULL AND sent_at < NOW() - INTERVAL '10 days'`,
        [caseId]
      );

      const { rows: exhibitCount } = await pool.query(
        `SELECT COUNT(*) as count FROM exhibits WHERE case_id = $1`,
        [caseId]
      );

      const { rows: resolvedGaps } = await pool.query(
        `SELECT COUNT(*) as count FROM discovery_gaps WHERE case_id = $1 AND status = 'resolved'`,
        [caseId]
      );

      const { rows: lastResponse } = await pool.query(
        `SELECT MAX(created_at) as last_response FROM discovery_responses WHERE case_id = $1`,
        [caseId]
      );

      const openGapCount = gapBreakdown.reduce((sum, r) => sum + Number(r.count), 0);
      const pendingCount = Number(pendingSupplements[0].count);
      const hasResponses = (await pool.query('SELECT COUNT(*) as count FROM discovery_responses WHERE case_id = $1', [caseId])).rows[0].count > 0;
      const readyToFile = hasResponses && openGapCount === 0 && pendingCount === 0;

      return {
        case: caseRows[0],
        open_gaps: gapBreakdown,
        pending_supplement_count: pendingCount,
        overdue_supplement_count: Number(overdueSupplements[0].overdue),
        exhibit_count: Number(exhibitCount[0].count),
        resolved_gap_count: Number(resolvedGaps[0].count),
        last_response_date: lastResponse[0].last_response,
        ready_to_file: readyToFile,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/discovery-workspace/:caseId/gaps
  fastify.get('/:caseId/gaps', async (request, reply) => {
    try {
      const { caseId } = request.params;

      const { rows } = await pool.query(`
        SELECT dg.*,
          EXTRACT(DAY FROM NOW() - dg.created_at)::int AS days_open,
          u.name AS assigned_to_name
        FROM discovery_gaps dg
        LEFT JOIN users u ON dg.assigned_to = u.id
        WHERE dg.case_id = $1
        ORDER BY
          CASE dg.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          dg.created_at ASC
      `, [caseId]);

      return {
        gaps: rows,
        missing: rows.filter(g => ['no_answer', 'missing_document'].includes(g.gap_type)),
        insufficient: rows.filter(g => ['incomplete_answer', 'evasive_answer', 'objection_only'].includes(g.gap_type)),
        confirmed: rows.filter(g => g.status === 'resolved'),
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
