import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function contactsRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/contacts
  fastify.get('/', async (request, reply) => {
    try {
      const { case_id } = request.query;
      let query = `
        SELECT cl.*,
          u.name AS logged_by_name
        FROM contact_log cl
        LEFT JOIN users u ON cl.logged_by = u.id
      `;
      const params = [];

      if (case_id) {
        params.push(case_id);
        query += ` WHERE cl.case_id = $1`;
      }
      query += ' ORDER BY cl.contact_date DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/contacts
  fastify.post('/', async (request, reply) => {
    try {
      const { case_id, contact_type, contact_date, notes, logged_by } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO contact_log (case_id, contact_type, contact_date, notes, logged_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [case_id, contact_type, contact_date || new Date().toISOString().split('T')[0], notes, logged_by || request.user.id]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/contacts/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM contact_log WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Contact log entry not found' });
      }
      return { message: 'Contact log entry deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
