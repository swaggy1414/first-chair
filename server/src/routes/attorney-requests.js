import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function attorneyRequestsRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/attorney-requests
  fastify.get('/', async (request, reply) => {
    try {
      const { priority, status } = request.query;
      let query = `
        SELECT ar.*,
          c.case_number,
          u.name AS requester_name
        FROM attorney_requests ar
        JOIN cases c ON ar.case_id = c.id
        LEFT JOIN users u ON ar.requested_by = u.id
      `;
      const conditions = [];
      const params = [];

      // Attorneys see only their own requests
      if (request.user.role === 'attorney') {
        params.push(request.user.id);
        conditions.push(`ar.requested_by = $${params.length}`);
      }

      if (priority) {
        params.push(priority);
        conditions.push(`ar.priority = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`ar.status = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY ar.created_at DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/attorney-requests
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, requested_by, priority, title, description, status, due_date } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO attorney_requests (case_id, requested_by, priority, title, description, status, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [case_id, requested_by || request.user.id, priority || 'standard', title, description, status || 'open', due_date]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/attorney-requests/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, requested_by, priority, title, description, status, due_date, completed_at } = request.body;
      const { rows } = await pool.query(`
        UPDATE attorney_requests SET case_id = $1, requested_by = $2, priority = $3, title = $4, description = $5, status = $6, due_date = $7, completed_at = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [case_id, requested_by, priority, title, description, status, due_date, completed_at, request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Attorney request not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/attorney-requests/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor', 'attorney')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM attorney_requests WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Attorney request not found' });
      }
      return { message: 'Attorney request deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
