import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function discoveryLibraryRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/discovery-library
  fastify.get('/', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT dl.*, u.name AS added_by_name
        FROM discovery_response_library dl
        LEFT JOIN users u ON dl.added_by = u.id
        ORDER BY dl.created_at DESC
      `);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/discovery-library/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM discovery_response_library WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Library entry not found' });
      }
      return { message: 'Library entry deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
