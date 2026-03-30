import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 30;

export default async function authRoutes(fastify, opts) {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, password } = request.body || {};
      if (!email || !password) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Email and password are required' });
      }

      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (rows.length === 0) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password' });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password' });
      }

      const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const access_token = fastify.jwt.sign(tokenPayload);

      const refresh_token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refresh_token, expires_at]
      );

      const response = { access_token, refresh_token };
      if (user.force_password_change) {
        response.force_password_change = true;
      }

      return response;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/auth/change-password
  fastify.post('/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { new_password } = request.body || {};
      if (!new_password) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'new_password is required' });
      }

      const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
      await pool.query(
        'UPDATE users SET password_hash = $1, force_password_change = false WHERE id = $2',
        [hash, request.user.id]
      );

      return { message: 'Password changed successfully' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    try {
      const { refresh_token } = request.body || {};
      if (!refresh_token) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'refresh_token is required' });
      }

      const { rows } = await pool.query(
        'SELECT rt.*, u.email, u.role, u.name FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = $1 AND rt.expires_at > NOW()',
        [refresh_token]
      );

      if (rows.length === 0) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired refresh token' });
      }

      const row = rows[0];
      const tokenPayload = { id: row.user_id, email: row.email, role: row.role, name: row.name };
      const access_token = fastify.jwt.sign(tokenPayload);

      return { access_token };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { refresh_token } = request.body || {};
      if (refresh_token) {
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2', [refresh_token, request.user.id]);
      }
      return { message: 'Logged out' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, name, email, role, force_password_change, created_at FROM users WHERE id = $1',
        [request.user.id]
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
