import bcrypt from 'bcrypt';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

export default async function usersRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/users/attorneys — any authenticated user can see attorney list
  fastify.get('/attorneys', async (request, reply) => {
    try {
      const { rows } = await pool.query(
        "SELECT id, name, email FROM users WHERE role = 'attorney' ORDER BY name"
      );
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/users
  fastify.get('/', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, email, role, force_password_change, created_at FROM users ORDER BY name'
      );
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/users
  fastify.post('/', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { name, email, password, role, force_password_change } = request.body;
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      const { rows } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role, force_password_change)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, force_password_change, created_at
      `, [name, email, password_hash, role, force_password_change !== false]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/users/:id
  fastify.put('/:id', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { name, email, role, force_password_change } = request.body;
      const { rows } = await pool.query(`
        UPDATE users SET name = $1, email = $2, role = $3, force_password_change = $4
        WHERE id = $5
        RETURNING id, name, email, role, force_password_change, created_at
      `, [name, email, role, force_password_change, request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/users/:id
  fastify.delete('/:id', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }
      return { message: 'User deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
