import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function deadlinesRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/deadlines
  fastify.get('/', async (request, reply) => {
    try {
      const { case_id } = request.query;
      let query = `
        SELECT d.*,
          c.case_number,
          u.name AS assigned_to_name
        FROM deadlines d
        JOIN cases c ON d.case_id = c.id
        LEFT JOIN users u ON d.assigned_to = u.id
      `;
      const params = [];

      if (case_id) {
        params.push(case_id);
        query += ` WHERE d.case_id = $1`;
      }
      query += ' ORDER BY d.due_date ASC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/deadlines/upcoming
  fastify.get('/upcoming', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT d.*,
          c.case_number,
          c.client_name,
          u.name AS assigned_to_name
        FROM deadlines d
        JOIN cases c ON d.case_id = c.id
        LEFT JOIN users u ON d.assigned_to = u.id
        WHERE d.due_date <= CURRENT_DATE + INTERVAL '7 days'
          AND d.status != 'completed'
        ORDER BY d.due_date ASC
      `);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/deadlines
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, title, due_date, type, status, assigned_to, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO deadlines (case_id, title, due_date, type, status, assigned_to, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [case_id, title, due_date, type, status || 'pending', assigned_to, notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/deadlines/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, title, due_date, type, status, assigned_to, notes } = request.body;
      const { rows } = await pool.query(`
        UPDATE deadlines SET case_id = $1, title = $2, due_date = $3, type = $4, status = $5, assigned_to = $6, notes = $7, updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [case_id, title, due_date, type, status, assigned_to, notes, request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deadline not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/deadlines/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM deadlines WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Deadline not found' });
      }
      return { message: 'Deadline deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
