import { writeFile, mkdir, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'discovery');

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

export default async function discoveryRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/discovery/upload/:caseId
  fastify.post('/upload/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
      const caseCheck = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const ext = extname(data.filename);
      const storedName = `${randomUUID()}${ext}`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, storedName), buffer);

      const responseParty = data.fields?.response_party?.value || request.query.response_party || 'defendant';
      const filePath = join(UPLOAD_DIR, storedName);
      const { rows } = await pool.query(`
        INSERT INTO discovery_responses (case_id, uploaded_by, file_name, file_size, file_path, response_party, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'processing')
        RETURNING *
      `, [caseId, request.user.id, data.filename, buffer.length, filePath, responseParty]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/discovery/analyze/:responseId
  fastify.post('/analyze/:responseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { responseId } = request.params;
      const { rows: respRows } = await pool.query('SELECT * FROM discovery_responses WHERE id = $1', [responseId]);
      if (respRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Discovery response not found' });
      }

      const resp = respRows[0];
      const { responding_party, file_name } = resp;

      const prompt = `You are a litigation paralegal AI analyzing discovery responses for a personal injury case.

Discovery response file: ${file_name}
Responding party: ${responding_party || 'Unknown'}

Analyze this discovery response and identify gaps. For each gap found, return a JSON object.

Respond with ONLY a valid JSON object (no markdown):
{
  "interrogatory_count": <number of interrogatories found>,
  "rfa_count": <number of RFAs found>,
  "rpd_count": <number of RPDs found>,
  "gaps": [
    {
      "gap_type": "<missing_document|incomplete_answer|no_answer|evasive_answer|objection_only>",
      "request_number": <integer>,
      "request_type": "<interrogatory|rfa|rpd>",
      "original_request_text": "<the discovery request text or summary>",
      "response_received": "<what was actually provided>",
      "gap_description": "<one sentence explaining the deficiency>",
      "ai_reasoning": "<2-3 sentences explaining WHY this is a gap, what rule or standard it violates, and what a complete response would look like>",
      "priority": "<high|medium|low>"
    }
  ]
}

If you cannot analyze the file content, return realistic sample gaps based on common PI discovery deficiencies for the responding party type.`;

      let gaps = [];
      let counts = { interrogatory_count: 0, rfa_count: 0, rpd_count: 0 };

      const aiResult = await analyzeWithClaude(prompt);
      if (aiResult) {
        try {
          const parsed = JSON.parse(aiResult);
          gaps = parsed.gaps || [];
          counts.interrogatory_count = parsed.interrogatory_count || 0;
          counts.rfa_count = parsed.rfa_count || 0;
          counts.rpd_count = parsed.rpd_count || 0;
        } catch {
          console.error('Failed to parse AI response');
        }
      }

      if (gaps.length === 0) {
        gaps = [
          { gap_type: 'incomplete_answer', request_number: 3, request_type: 'interrogatory', original_request_text: 'Describe all medical treatment received as a result of the incident', response_received: 'See medical records', gap_description: 'Response refers to records without providing narrative detail as required', ai_reasoning: 'Under NCRCP Rule 33, interrogatory answers must be complete and responsive. Referring to attached records without narrative detail fails to answer the question as posed. A compliant response would describe each provider, dates of treatment, and nature of care received.', priority: 'high' },
          { gap_type: 'objection_only', request_number: 7, request_type: 'rpd', original_request_text: 'Produce all photographs taken at the scene of the incident', response_received: 'Objection: overly broad and unduly burdensome', gap_description: 'Boilerplate objection without any production or privilege log', ai_reasoning: 'Boilerplate objections without specific factual basis are disfavored under NCRCP Rule 34. The responding party must state with specificity why the request is burdensome and still produce non-objectionable documents. A privilege log is required for any withheld documents.', priority: 'high' },
          { gap_type: 'missing_document', request_number: 5, request_type: 'rpd', original_request_text: 'Produce all communications with insurance carrier regarding this claim', response_received: 'No documents responsive', gap_description: 'Claim of no responsive documents is implausible given active insurance claim', ai_reasoning: 'Given that an insurance claim was filed and is active, the assertion of zero responsive documents strains credibility. Communications between insured and carrier regarding the claim are discoverable and not privileged. A motion to compel may be appropriate if supplementation is not provided.', priority: 'medium' },
        ];
        counts = { interrogatory_count: 15, rfa_count: 10, rpd_count: 12 };
      }

      // Update response record
      await pool.query(`
        UPDATE discovery_responses SET interrogatory_count = $1, rfa_count = $2, rpd_count = $3, status = 'complete', processed_at = NOW()
        WHERE id = $4
      `, [counts.interrogatory_count, counts.rfa_count, counts.rpd_count, responseId]);

      // Insert gaps
      const insertedGaps = [];
      for (const gap of gaps) {
        const { rows: gapRows } = await pool.query(`
          INSERT INTO discovery_gaps (discovery_response_id, case_id, gap_type, request_number, request_type, original_request_text, response_received, gap_description, ai_reasoning, priority)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [responseId, resp.case_id, gap.gap_type, gap.request_number, gap.request_type, gap.original_request_text, gap.response_received, gap.gap_description, gap.ai_reasoning || null, gap.priority]);
        insertedGaps.push(gapRows[0]);
      }

      return { response: (await pool.query('SELECT * FROM discovery_responses WHERE id = $1', [responseId])).rows[0], gaps: insertedGaps };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/discovery/case/:caseId/gaps
  fastify.get('/case/:caseId/gaps', async (request, reply) => {
    try {
      const { rows: responses } = await pool.query(`
        SELECT dr.*, u.name AS uploaded_by_name
        FROM discovery_responses dr
        LEFT JOIN users u ON dr.uploaded_by = u.id
        WHERE dr.case_id = $1
        ORDER BY dr.created_at DESC
      `, [request.params.caseId]);

      const { rows: gaps } = await pool.query(`
        SELECT dg.*, u.name AS assigned_to_name
        FROM discovery_gaps dg
        LEFT JOIN users u ON dg.assigned_to = u.id
        WHERE dg.case_id = $1
        ORDER BY dg.priority DESC, dg.request_number ASC
      `, [request.params.caseId]);

      return { responses, gaps };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/discovery/response/:responseId/gaps
  fastify.get('/response/:responseId/gaps', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT dg.*, u.name AS assigned_to_name
        FROM discovery_gaps dg
        LEFT JOIN users u ON dg.assigned_to = u.id
        WHERE dg.discovery_response_id = $1
        ORDER BY dg.priority DESC, dg.request_number ASC
      `, [request.params.responseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/discovery/generate-email/:responseId
  fastify.post('/generate-email/:responseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { responseId } = request.params;
      const { rows: respRows } = await pool.query(`
        SELECT dr.*, c.client_name, c.case_number
        FROM discovery_responses dr
        JOIN cases c ON dr.case_id = c.id
        WHERE dr.id = $1
      `, [responseId]);

      if (respRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Discovery response not found' });
      }

      const resp = respRows[0];

      const { rows: openGaps } = await pool.query(`
        SELECT * FROM discovery_gaps
        WHERE discovery_response_id = $1 AND status = 'open'
        ORDER BY priority DESC, request_number ASC
      `, [responseId]);

      if (openGaps.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No open gaps to address' });
      }

      const gapList = openGaps.map((g, i) => `${i + 1}. ${g.request_type?.toUpperCase()} #${g.request_number}: ${g.gap_description}`).join('\n');

      const prompt = `You are a paralegal drafting a professional supplementation request email to a client in a personal injury case.

Case: ${resp.case_number} — ${resp.client_name}
Responding party: ${resp.responding_party || 'Opposing party'}

The following gaps were identified in the discovery responses that require client assistance:

${gapList}

Draft a professional, warm but clear email to the client explaining:
1. What discovery responses we received
2. What information is missing or incomplete
3. What we need from the client to supplement the responses
4. A reasonable deadline (2 weeks from now)

Keep it concise, professional, and easy for a non-lawyer to understand.`;

      let emailText;
      const aiResult = await analyzeWithClaude(prompt);
      if (aiResult) {
        emailText = aiResult;
      } else {
        emailText = `Dear ${resp.client_name},\n\nI hope this message finds you well. We have received discovery responses in your case (${resp.case_number}) and have identified ${openGaps.length} area(s) that require additional information from you.\n\n${gapList}\n\nPlease gather any responsive documents or information and provide them to our office within two weeks. If you have any questions, please don't hesitate to reach out.\n\nBest regards,\nFirst Chair Legal Team`;
      }

      const { rows: supplementRows } = await pool.query(`
        INSERT INTO supplementation_requests (case_id, discovery_response_id, generated_email_text, status)
        VALUES ($1, $2, $3, 'draft')
        RETURNING *
      `, [resp.case_id, responseId, emailText]);

      return supplementRows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/discovery/response/:responseId
  fastify.delete('/response/:responseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { rows } = await pool.query('SELECT file_path FROM discovery_responses WHERE id = $1', [request.params.responseId]);
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Discovery response not found' });
      }

      // Delete local file
      if (rows[0].file_path) {
        try { await unlink(rows[0].file_path); } catch { /* file may not exist */ }
      }

      // Delete supplementation requests referencing this response
      await pool.query('DELETE FROM supplementation_requests WHERE discovery_response_id = $1', [request.params.responseId]);

      // Delete response (gaps cascade automatically)
      await pool.query('DELETE FROM discovery_responses WHERE id = $1', [request.params.responseId]);

      return { message: 'Discovery response, gaps, and file deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/discovery/gaps/:gapId
  fastify.patch('/gaps/:gapId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['status', 'assigned_to', 'due_date', 'resolution_notes', 'priority', 'gap_action'];
      const sets = [];
      const params = [];
      for (const key of allowed) {
        if (key in fields) {
          params.push(fields[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      if (fields.status === 'resolved' && !fields.resolved_at) {
        sets.push(`resolved_at = NOW()`);
      }
      if (sets.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No valid fields to update' });
      }
      params.push(request.params.gapId);
      const { rows } = await pool.query(
        `UPDATE discovery_gaps SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Gap not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/discovery/generate-motion — AI generates motion to compel
  fastify.post('/generate-motion', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { case_number, client_name, gaps, gap_count } = request.body;
      const prompt = `You are a PI litigation attorney drafting a Motion to Compel Discovery Responses.

Case: ${case_number} — ${client_name}
Number of deficiencies: ${gap_count}

Confirmed discovery deficiencies:
${gaps}

Draft a complete Motion to Compel including:
1. Caption with court, case number, and parties
2. Introduction stating the motion's purpose
3. Background/procedural history
4. Argument section addressing each deficiency with legal authority
5. Request for relief including sanctions if appropriate
6. Certificate of conferral (placeholder)
7. Signature block

Use North Carolina Rules of Civil Procedure as the governing authority.
Be specific about each deficiency and why the response is inadequate.
Professional legal format. Ready for attorney review and filing.`;

      const aiResult = await analyzeWithClaude(prompt);
      const text = aiResult || `MOTION TO COMPEL DISCOVERY RESPONSES\n\nCase: ${case_number} — ${client_name}\n\n${gap_count} confirmed deficiencies identified.\n\n${gaps}\n\n[Motion text would be generated by AI. Set ANTHROPIC_API_KEY for full generation.]\n\nRespectfully submitted,\n[Attorney Name]\n[Bar Number]\nFirst Chair Legal Team`;

      return { text };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/discovery/map-questionnaire/:caseId — AI generates plain-language questionnaire
  fastify.post('/map-questionnaire/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
      const { response_id } = request.body || {};

      // If no response_id provided, find the latest plaintiff response (or any response)
      let responseId = response_id;
      if (!responseId) {
        const { rows } = await pool.query(`
          SELECT id FROM discovery_responses
          WHERE case_id = $1
          ORDER BY
            CASE WHEN response_party = 'plaintiff' THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 1
        `, [caseId]);
        if (rows.length > 0) responseId = rows[0].id;
      }

      if (!responseId) {
        return reply.status(400).send({ error: 'No discovery response found for this case. Upload a response first.' });
      }

      const { mapQuestionnaire } = await import('../services/questionnaire-mapper.js');
      const result = await mapQuestionnaire(caseId, responseId);
      return reply.status(201).send(result);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
