import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function casesRoutes(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/cases
  fastify.get('/', async (request, reply) => {
    try {
      const { status, search } = request.query;
      let query = `
        SELECT c.*,
          p.name AS paralegal_name,
          a.name AS attorney_name
        FROM cases c
        LEFT JOIN users p ON c.assigned_paralegal_id = p.id
        LEFT JOIN users a ON c.assigned_attorney_id = a.id
      `;
      const conditions = [];
      const params = [];

      if (status) {
        params.push(status);
        conditions.push(`c.status = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(c.case_number ILIKE $${params.length} OR c.client_name ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY c.created_at DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/cases/:id
  fastify.get('/:id', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT c.*,
          p.name AS paralegal_name,
          a.name AS attorney_name
        FROM cases c
        LEFT JOIN users p ON c.assigned_paralegal_id = p.id
        LEFT JOIN users a ON c.assigned_attorney_id = a.id
        WHERE c.id = $1
      `, [request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/cases
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { case_number, client_name, client_phone, client_email, incident_date, incident_type, status, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO cases (case_number, client_name, client_phone, client_email, incident_date, incident_type, status, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [case_number, client_name, client_phone, client_email, incident_date, incident_type, status || 'intake', assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/cases/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_number, client_name, client_phone, client_email, incident_date, incident_type, status, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes, phase } = request.body;
      const { rows } = await pool.query(`
        UPDATE cases SET case_number = $1, client_name = $2, client_phone = $3, client_email = $4, incident_date = $5, incident_type = $6, status = $7, assigned_paralegal_id = $8, assigned_attorney_id = $9, flag_color = $10, flag_note = $11, notes = $12, phase = $13, updated_at = NOW()
        WHERE id = $14
        RETURNING *
      `, [case_number, client_name, client_phone, client_email, incident_date, incident_type, status, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes, phase, request.params.id]);

      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      // Auto-copy discovery responses to library when phase changes to closed
      const updatedCase = rows[0];
      if (updatedCase.phase === 'closed') {
        const { rows: responses } = await pool.query(
          'SELECT * FROM discovery_responses WHERE case_id = $1 AND status = $2',
          [request.params.id, 'complete']
        );
        for (const resp of responses) {
          // Skip if already in library
          const { rows: existing } = await pool.query(
            'SELECT id FROM discovery_response_library WHERE source_response_id = $1',
            [resp.id]
          );
          if (existing.length === 0) {
            await pool.query(`
              INSERT INTO discovery_response_library (case_number, client_name, incident_type, responding_party, file_name, interrogatory_count, rfa_count, rpd_count, notes, added_by, source_case_id, source_response_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [updatedCase.case_number, updatedCase.client_name, updatedCase.incident_type, resp.responding_party, resp.file_name, resp.interrogatory_count, resp.rfa_count, resp.rpd_count, 'Auto-added on case close.', request.user.id, updatedCase.id, resp.id]);
          }
        }
      }

      return updatedCase;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/cases/:id
  fastify.delete('/:id', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM cases WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }
      return { message: 'Case deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
