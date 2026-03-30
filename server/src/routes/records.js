import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function recordsRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/records
  fastify.get('/', async (request, reply) => {
    try {
      const { case_id, status } = request.query;
      let query = `
        SELECT r.*, c.case_number
        FROM records_requests r
        JOIN cases c ON r.case_id = c.id
      `;
      const conditions = [];
      const params = [];

      if (case_id) {
        params.push(case_id);
        conditions.push(`r.case_id = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY r.requested_date DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/records
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'records_team')] }, async (request, reply) => {
    try {
      const { case_id, provider_name, request_type, requested_date, received_date, status, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO records_requests (case_id, provider_name, request_type, requested_date, received_date, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [case_id, provider_name, request_type, requested_date || new Date().toISOString().split('T')[0], received_date, status || 'sent', notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/records/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'records_team')] }, async (request, reply) => {
    try {
      const { case_id, provider_name, request_type, requested_date, received_date, status, notes } = request.body;
      const { rows } = await pool.query(`
        UPDATE records_requests SET case_id = $1, provider_name = $2, request_type = $3, requested_date = $4, received_date = $5, status = $6, notes = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [case_id, provider_name, request_type, requested_date, received_date, status, notes, request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Record request not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/records/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM records_requests WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Record request not found' });
      }
      return { message: 'Record request deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
