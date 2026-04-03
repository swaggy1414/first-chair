import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

export default async function supplementRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/supplements/:caseId — all supplementation requests for a case
  fastify.get('/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT sr.*,
          dr.file_name AS response_file_name,
          dr.response_party,
          u.name AS sent_by_name,
          CASE WHEN sr.sent_at IS NOT NULL
            THEN EXTRACT(DAY FROM NOW() - sr.sent_at)::int
            ELSE NULL
          END AS days_outstanding,
          CASE WHEN sr.status = 'sent' AND sr.sent_at IS NOT NULL
            AND sr.sent_at < NOW() - INTERVAL '10 days'
            AND sr.client_responded_at IS NULL
            THEN true ELSE false
          END AS is_overdue
        FROM supplementation_requests sr
        LEFT JOIN discovery_responses dr ON sr.discovery_response_id = dr.id
        LEFT JOIN users u ON sr.sent_by = u.id
        WHERE sr.case_id = $1
        ORDER BY sr.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/supplements/:id/send — mark as sent
  fastify.patch('/:id/send', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        UPDATE supplementation_requests
        SET status = 'sent', sent_at = NOW(), sent_by = $1
        WHERE id = $2 AND status = 'draft'
        RETURNING *
      `, [request.user.id, request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found or already sent' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/supplements/:id/respond — mark client responded
  fastify.patch('/:id/respond', async (request, reply) => {
    try {
      const { client_response } = request.body || {};
      const { rows } = await pool.query(`
        UPDATE supplementation_requests
        SET status = 'responded', client_responded_at = NOW(), client_response = $1
        WHERE id = $2 AND status = 'sent'
        RETURNING *
      `, [client_response || 'Client response received', request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found or not in sent status' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/supplements/:id/close — close a supplement request
  fastify.patch('/:id/close', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        UPDATE supplementation_requests SET status = 'closed' WHERE id = $1 RETURNING *
      `, [request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
