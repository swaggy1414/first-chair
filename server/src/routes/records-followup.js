import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { runFollowupCheck } from '../services/records-followup.js';

export default async function recordsFollowupRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/records-followup/run — manually trigger follow-up check
  fastify.post('/run', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const results = await runFollowupCheck();
      return results;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/records-followup/log — all follow-up logs
  fastify.get('/log', async (request, reply) => {
    try {
      const { case_id, status, followup_type } = request.query;
      let query = `
        SELECT fl.*, rr.provider_name, rr.request_type, rr.requested_date,
          c.case_number, c.client_name, u.name AS sent_by_name,
          (CURRENT_DATE - rr.requested_date) AS days_outstanding
        FROM records_followup_log fl
        JOIN records_requests rr ON fl.records_request_id = rr.id
        JOIN cases c ON fl.case_id = c.id
        LEFT JOIN users u ON fl.sent_by = u.id
      `;
      const conditions = [];
      const params = [];
      if (case_id) { params.push(case_id); conditions.push(`fl.case_id = $${params.length}`); }
      if (status) { params.push(status); conditions.push(`fl.status = $${params.length}`); }
      if (followup_type) { params.push(followup_type); conditions.push(`fl.followup_type = $${params.length}`); }
      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY fl.created_at DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/records-followup/queued — queued follow-ups ready to send
  fastify.get('/queued', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT fl.*, rr.provider_name, rr.request_type,
          c.case_number, c.client_name,
          (CURRENT_DATE - rr.requested_date) AS days_outstanding
        FROM records_followup_log fl
        JOIN records_requests rr ON fl.records_request_id = rr.id
        JOIN cases c ON fl.case_id = c.id
        WHERE fl.status = 'queued'
        ORDER BY fl.created_at ASC
      `);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/records-followup/:id/send — mark as sent
  fastify.patch('/:id/send', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `UPDATE records_followup_log SET status = 'sent', sent_at = NOW(), sent_by = $1 WHERE id = $2 AND status = 'queued' RETURNING *`,
        [request.user.id, request.params.id]
      );
      if (rows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Follow-up not found or already sent' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/records-followup/:id/cancel — cancel a queued follow-up
  fastify.patch('/:id/cancel', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query(
        `UPDATE records_followup_log SET status = 'cancelled' WHERE id = $1 AND status = 'queued' RETURNING *`,
        [request.params.id]
      );
      if (rows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Follow-up not found or not cancellable' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/records-followup/:id/letter — get the letter text
  fastify.get('/:id/letter', async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM records_followup_log WHERE id = $1', [request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Follow-up not found' });
      return { letter_text: rows[0].letter_text, followup_type: rows[0].followup_type, status: rows[0].status };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
