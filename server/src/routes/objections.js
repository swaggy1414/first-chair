import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function objectionsRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/objections
  fastify.get('/', async (request, reply) => {
    try {
      const { category } = request.query;
      let query = 'SELECT * FROM objections';
      const params = [];
      if (category) {
        params.push(category);
        query += ` WHERE category = $${params.length}`;
      }
      query += ' ORDER BY category, title';
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/objections
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { title, objection_text, category } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO objections (title, objection_text, category, source, created_by)
        VALUES ($1, $2, $3, 'manual', $4)
        RETURNING *
      `, [title, objection_text, category, request.user.id]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/objections/import
  fastify.post('/import', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
      }

      const buffer = await file.toBuffer();
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value;

      let objections = [];
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.log('ANTHROPIC_API_KEY not set — returning mock objections');
        objections = [
          { title: 'Vague and Ambiguous', objection_text: 'Objection. This request is vague, ambiguous, and unintelligible in that it fails to adequately define key terms.', category: 'General Objections' },
          { title: 'Overly Broad', objection_text: 'Objection. This request is overly broad and unduly burdensome in scope and seeks information neither relevant nor reasonably calculated to lead to the discovery of admissible evidence.', category: 'General Objections' },
          { title: 'Attorney-Client Privilege', objection_text: 'Objection. This request seeks information protected by the attorney-client privilege and/or the work product doctrine.', category: 'Privilege' },
        ];
      } else {
        const client = new Anthropic({ apiKey });
        const message = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: 'You are reviewing a law firm objections document. Extract every distinct objection from this document. For each objection identify: a short title (5 words max), the full objection text, and a category. Categories: General Objections, Interrogatory Objections, RFA Objections, RPD Objections, Privilege, Other. Return a JSON array only. No preamble. Each item: { title, objection_text, category }',
          messages: [{ role: 'user', content: text }],
        });
        try {
          objections = JSON.parse(message.content[0].text.trim());
        } catch {
          console.error('Failed to parse AI objections response');
          objections = [];
        }
      }

      let imported = 0;
      let skipped = 0;
      const insertedObjections = [];

      for (const obj of objections) {
        // Check if title already exists
        const { rows: existing } = await pool.query('SELECT id FROM objections WHERE title = $1', [obj.title]);
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        const { rows } = await pool.query(`
          INSERT INTO objections (title, objection_text, category, source, created_by)
          VALUES ($1, $2, $3, 'imported', $4)
          RETURNING *
        `, [obj.title, obj.objection_text, obj.category, request.user.id]);
        insertedObjections.push(rows[0]);
        imported++;
      }

      return { imported, skipped, objections: insertedObjections };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/objections/:id
  fastify.delete('/:id', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM objections WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Objection not found' });
      }
      return { message: 'Objection deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
