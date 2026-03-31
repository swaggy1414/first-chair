import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function attorneyNotesRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/attorney-notes/case/:caseId
  fastify.get('/case/:caseId', async (request, reply) => {
    try {
      const role = request.user.role;
      let query = `
        SELECT an.*, u.name AS attorney_name
        FROM attorney_notes an
        JOIN users u ON an.attorney_id = u.id
        WHERE an.case_id = $1
      `;
      const params = [request.params.caseId];

      // Paralegals and records_team only see non-private notes
      if (role === 'paralegal' || role === 'records_team') {
        query += ' AND an.is_private = false';
      }
      // Attorneys see their own private notes + all non-private
      if (role === 'attorney') {
        params.push(request.user.id);
        query += ` AND (an.is_private = false OR an.attorney_id = $${params.length})`;
      }
      // Admin and supervisor see everything

      query += ' ORDER BY an.created_at DESC';
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/attorney-notes
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, note_text, note_type, is_private } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO attorney_notes (case_id, attorney_id, note_text, note_type, is_private)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [case_id, request.user.id, note_text, note_type || 'general', is_private || false]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/attorney-notes/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor', 'attorney')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM attorney_notes WHERE id = $1', [request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' });
      // Attorneys can only delete their own notes
      if (request.user.role === 'attorney' && rows[0].attorney_id !== request.user.id) {
        return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot delete another attorney\'s notes' });
      }
      await pool.query('DELETE FROM attorney_notes WHERE id = $1', [request.params.id]);
      return { message: 'Note deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
