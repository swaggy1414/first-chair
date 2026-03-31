import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { classifyExhibit } from '../utils/classifier.js';
import { uploadFile as onedriveUpload, deleteFile as onedriveDelete } from '../utils/onedrive.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export default async function exhibitsRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/exhibits/upload/:caseId
  fastify.post('/upload/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;

      // Verify case exists
      const caseCheck = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
      }

      const buffer = await file.toBuffer();
      const ext = extname(file.filename);
      const storedName = `${randomUUID()}${ext}`;
      const filePath = join(UPLOAD_DIR, storedName);

      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(filePath, buffer);

      // AI classification
      const textContent = file.mimetype?.startsWith('text/') ? buffer.toString('utf-8') : '';
      const classification = await classifyExhibit(file.filename, textContent);

      // OneDrive upload
      let onedriveFileId = null;
      let onedriveUrl = null;
      const odResult = await onedriveUpload(file.filename, buffer);
      if (odResult) {
        onedriveFileId = odResult.fileId;
        onedriveUrl = odResult.webUrl;
      }

      const { rows } = await pool.query(`
        INSERT INTO exhibits (case_id, file_name, file_path, file_size, mime_type, category, ai_classification, ai_confidence, ai_summary, uploaded_by, onedrive_file_id, onedrive_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        caseId, file.filename, filePath, buffer.length, file.mimetype,
        classification.category, classification.category, classification.confidence, classification.summary,
        request.user.id, onedriveFileId, onedriveUrl
      ]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/exhibits/case/:caseId
  fastify.get('/case/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT e.*, u.name AS uploaded_by_name
        FROM exhibits e
        LEFT JOIN users u ON e.uploaded_by = u.id
        WHERE e.case_id = $1
        ORDER BY e.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/exhibits/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['file_name', 'category', 'ai_classification', 'ai_confidence', 'ai_summary'];
      const sets = [];
      const params = [];
      for (const key of allowed) {
        if (key in fields) {
          params.push(fields[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      if (sets.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No valid fields to update' });
      }
      params.push(request.params.id);
      const { rows } = await pool.query(
        `UPDATE exhibits SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Exhibit not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/exhibits/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM exhibits WHERE id = $1', [request.params.id]);
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Exhibit not found' });
      }

      const exhibit = rows[0];

      // Delete local file
      if (exhibit.file_path) {
        try { await unlink(exhibit.file_path); } catch { /* file may not exist */ }
      }

      // Delete from OneDrive
      if (exhibit.onedrive_file_id) {
        await onedriveDelete(exhibit.onedrive_file_id);
      }

      await pool.query('DELETE FROM exhibits WHERE id = $1', [request.params.id]);
      return { message: 'Exhibit deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/exhibits/classify/:id
  fastify.post('/classify/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT * FROM exhibits WHERE id = $1', [request.params.id]);
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Exhibit not found' });
      }

      const exhibit = rows[0];
      let textContent = '';
      if (exhibit.mime_type?.startsWith('text/') && exhibit.file_path) {
        const { readFile } = await import('fs/promises');
        try { textContent = await readFile(exhibit.file_path, 'utf-8'); } catch { /* ignore */ }
      }

      const classification = await classifyExhibit(exhibit.file_name, textContent);

      const { rows: updated } = await pool.query(`
        UPDATE exhibits SET category = $1, ai_classification = $1, ai_confidence = $2, ai_summary = $3
        WHERE id = $4 RETURNING *
      `, [classification.category, classification.confidence, classification.summary, request.params.id]);

      return updated[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
