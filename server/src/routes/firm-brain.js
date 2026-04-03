import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'firm-documents');

async function analyzeWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set — returning mock analysis');
    return null;
  }
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

export default async function firmBrainRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/firm-brain/documents
  fastify.post('/documents', async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
      }

      const buffer = await file.toBuffer();
      const ext = extname(file.filename);
      const storedName = `${randomUUID()}${ext}`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, storedName), buffer);

      const filePath = join(UPLOAD_DIR, storedName);
      const title = file.fields?.title?.value || file.filename;
      const documentType = file.fields?.document_type?.value || 'other';
      const caseId = file.fields?.case_id?.value || null;

      const fileContent = buffer.toString('utf-8').substring(0, 8000);

      const prompt = `Analyze this legal document. Return JSON: { "summary": "one paragraph summary", "extracted_issues": "comma-separated legal issues identified", "key_clauses": "comma-separated key clauses or provisions" }\n\nDocument title: ${title}\nDocument content:\n${fileContent}`;

      let aiSummary = null;
      let extractedIssues = null;
      let keyClauses = null;

      const aiResult = await analyzeWithClaude(prompt);
      if (aiResult) {
        try {
          const parsed = JSON.parse(aiResult);
          aiSummary = parsed.summary || null;
          extractedIssues = parsed.extracted_issues || null;
          keyClauses = parsed.key_clauses || null;
        } catch {
          console.error('Failed to parse AI response for document analysis');
        }
      }

      if (!aiSummary) {
        aiSummary = `Document "${title}" uploaded for review.`;
        extractedIssues = 'Pending analysis';
        keyClauses = 'Pending analysis';
      }

      const { rows } = await pool.query(`
        INSERT INTO firm_documents (title, document_type, file_name, file_path, file_size, case_id, uploaded_by, ai_summary, ai_extracted_issues, ai_key_clauses)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [title, documentType, file.filename, filePath, buffer.length, caseId, request.user.id, aiSummary, extractedIssues, keyClauses]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/firm-brain/documents
  fastify.get('/documents', async (request, reply) => {
    try {
      const { document_type, case_id } = request.query;
      let query = `
        SELECT fd.*,
          u.name AS uploaded_by_name,
          c.case_number
        FROM firm_documents fd
        LEFT JOIN users u ON fd.uploaded_by = u.id
        LEFT JOIN cases c ON fd.case_id = c.id
      `;
      const conditions = [];
      const params = [];

      if (document_type) {
        params.push(document_type);
        conditions.push(`fd.document_type = $${params.length}`);
      }
      if (case_id) {
        params.push(case_id);
        conditions.push(`fd.case_id = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY fd.created_at DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/firm-brain/opposing-counsel
  fastify.get('/opposing-counsel', async (request, reply) => {
    try {
      const { search } = request.query;
      let query = 'SELECT * FROM opposing_counsel';
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` WHERE name ILIKE $1 OR firm_name ILIKE $1`;
      }
      query += ' ORDER BY name';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/firm-brain/opposing-counsel
  fastify.post('/opposing-counsel', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { name, firm_name, email, phone, state_bar_number, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO opposing_counsel (name, firm_name, email, phone, state_bar_number, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, firm_name, email, phone, state_bar_number, notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/firm-brain/judges
  fastify.get('/judges', async (request, reply) => {
    try {
      const { search, state } = request.query;
      let query = 'SELECT * FROM judges';
      const conditions = [];
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`name ILIKE $${params.length}`);
      }
      if (state) {
        params.push(state);
        conditions.push(`state = $${params.length}`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY name';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/firm-brain/judges
  fastify.post('/judges', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { name, court, jurisdiction, county, state, notes } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO judges (name, court, jurisdiction, county, state, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, court, jurisdiction, county, state, notes]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
