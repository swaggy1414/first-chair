import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function treatmentsRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/treatments
  fastify.get('/', async (request, reply) => {
    try {
      const { case_id } = request.query;
      let query = `
        SELECT t.*, c.case_number
        FROM treatments t
        JOIN cases c ON t.case_id = c.id
      `;
      const params = [];

      if (case_id) {
        params.push(case_id);
        query += ` WHERE t.case_id = $1`;
      }
      query += ' ORDER BY t.start_date DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/treatments
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { case_id, provider_name, treatment_type, start_date, end_date, status, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO treatments (case_id, provider_name, treatment_type, start_date, end_date, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [case_id, provider_name, treatment_type, start_date, end_date, status || 'active', notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/treatments/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['case_id', 'provider_name', 'treatment_type', 'start_date', 'end_date', 'status', 'notes'];
      const sets = [];
      const params = [];
      for (const key of allowed) {
        if (key in fields) { params.push(fields[key]); sets.push(`${key} = $${params.length}`); }
      }
      if (sets.length === 0) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No valid fields' });
      params.push(request.params.id);
      const { rows } = await pool.query(`UPDATE treatments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
      if (rows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Treatment not found' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/treatments/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM treatments WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Treatment not found' });
      }
      return { message: 'Treatment deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
