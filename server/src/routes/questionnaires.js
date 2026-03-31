import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function questionnairesRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/questionnaires/send/:caseId
  fastify.post('/send/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
      const { rows: caseRows } = await pool.query('SELECT id, client_email, client_name, case_number FROM cases WHERE id = $1', [caseId]);
      if (caseRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const caseData = caseRows[0];
      console.log(`Email would be sent to: ${caseData.client_email}`);

      const { rows } = await pool.query(`
        INSERT INTO discovery_questionnaires (case_id, sent_at, sent_by, client_email, status)
        VALUES ($1, NOW(), $2, $3, 'sent')
        RETURNING *
      `, [caseId, request.user.id, caseData.client_email]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/questionnaires/case/:caseId
  fastify.get('/case/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT dq.*, u.name AS sent_by_name
        FROM discovery_questionnaires dq
        LEFT JOIN users u ON dq.sent_by = u.id
        WHERE dq.case_id = $1
        ORDER BY dq.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/questionnaires/:id
  fastify.patch('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Status is required' });
      }
      const { rows } = await pool.query(`
        UPDATE discovery_questionnaires SET status = $1 WHERE id = $2 RETURNING *
      `, [status, request.params.id]);
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Questionnaire not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/questionnaires/follow-up/:id
  fastify.post('/follow-up/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { rows: existing } = await pool.query('SELECT * FROM discovery_questionnaires WHERE id = $1', [request.params.id]);
      if (existing.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Questionnaire not found' });
      }

      const q = existing[0];
      console.log('Follow-up email would be sent');

      // Check if overdue: sent_at + 10 days < NOW() and status is still 'sent'
      let newStatus = q.status;
      if (q.status === 'sent' && q.sent_at) {
        const sentDate = new Date(q.sent_at);
        const tenDaysLater = new Date(sentDate.getTime() + 10 * 24 * 60 * 60 * 1000);
        if (tenDaysLater < new Date()) {
          newStatus = 'overdue';
        }
      }

      const { rows } = await pool.query(`
        UPDATE discovery_questionnaires SET follow_up_sent_at = NOW(), status = $1 WHERE id = $2 RETURNING *
      `, [newStatus, request.params.id]);

      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
