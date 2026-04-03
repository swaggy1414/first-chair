import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

async function generateLetterText(caseData, gap) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const fallback = `RE: ${caseData.case_number} — ${caseData.client_name}\n\nDear Counsel,\n\nWe write regarding your client's deficient discovery response. Specifically:\n\n${gap.request_type || 'Request'} #${gap.request_number}: ${gap.original_request_text || 'See attached'}\n\nDeficiency: ${gap.gap_description || gap.gap_type?.replace(/_/g, ' ')}\n\nWe request a complete response within 10 business days. Failure to provide a sufficient response may result in a motion to compel pursuant to the North Carolina Rules of Civil Procedure.\n\nSincerely,\nFirst Chair Legal Team`;

  if (!apiKey) return fallback;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Draft a professional deficiency letter to opposing counsel regarding an inadequate discovery response.

Case: ${caseData.case_number} — ${caseData.client_name}
Opposing Counsel: ${caseData.oc_name || 'Counsel'} at ${caseData.oc_firm || 'opposing firm'}

The deficient response:
- ${gap.request_type || 'Request'} #${gap.request_number}: "${gap.original_request_text || 'N/A'}"
- Response received: "${gap.response_received || 'No response'}"
- Deficiency type: ${gap.gap_type?.replace(/_/g, ' ')}
- Description: ${gap.gap_description || 'Insufficient response'}
${gap.ai_reasoning ? '- Analysis: ' + gap.ai_reasoning : ''}

Write a firm but professional letter citing North Carolina Rules of Civil Procedure. Request a supplemental response within 10 business days. Warn that a motion to compel may follow. Format as a complete letter.`,
      }],
    });
    return message.content[0].text.trim();
  } catch {
    return fallback;
  }
}

export default async function deficiencyLetterRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/deficiency-letters/:caseId — all letters for a case
  fastify.get('/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT dl.*,
          dg.gap_type, dg.request_number, dg.request_type, dg.gap_description,
          gen.name AS generated_by_name,
          snd.name AS sent_by_name
        FROM deficiency_letters dl
        LEFT JOIN discovery_gaps dg ON dl.gap_id = dg.id
        LEFT JOIN users gen ON dl.generated_by = gen.id
        LEFT JOIN users snd ON dl.sent_by = snd.id
        WHERE dl.case_id = $1
        ORDER BY dl.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/deficiency-letters/:caseId/generate — generate letter for a gap
  fastify.post('/:caseId/generate', async (request, reply) => {
    try {
      const { gap_id } = request.body || {};
      const { caseId } = request.params;

      // Get case data with opposing counsel
      const { rows: caseRows } = await pool.query(`
        SELECT c.case_number, c.client_name,
          oc.name AS oc_name, oc.firm_name AS oc_firm
        FROM cases c
        LEFT JOIN opposing_counsel oc ON c.opposing_counsel_id = oc.id
        WHERE c.id = $1
      `, [caseId]);
      if (caseRows.length === 0) return reply.status(404).send({ error: 'Case not found' });

      let gaps;
      if (gap_id) {
        const { rows } = await pool.query('SELECT * FROM discovery_gaps WHERE id = $1 AND case_id = $2', [gap_id, caseId]);
        gaps = rows;
      } else {
        // Generate for all open, unlettered gaps
        const { rows } = await pool.query(`
          SELECT dg.* FROM discovery_gaps dg
          WHERE dg.case_id = $1 AND dg.status = 'open'
            AND NOT EXISTS (SELECT 1 FROM deficiency_letters dl WHERE dl.gap_id = dg.id AND dl.status != 'cancelled')
          ORDER BY dg.request_number
        `, [caseId]);
        gaps = rows;
      }

      if (gaps.length === 0) {
        return reply.status(400).send({ error: 'No gaps found to generate letters for' });
      }

      const letters = [];
      for (const gap of gaps) {
        const text = await generateLetterText(caseRows[0], gap);
        const { rows } = await pool.query(`
          INSERT INTO deficiency_letters (case_id, gap_id, letter_text, status, generated_by)
          VALUES ($1, $2, $3, 'draft', $4)
          RETURNING *
        `, [caseId, gap.id, text, request.user.id]);
        letters.push(rows[0]);
      }

      return reply.status(201).send({ letters, count: letters.length });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/deficiency-letters/:id/send — mark as sent
  fastify.patch('/:id/send', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        UPDATE deficiency_letters SET status = 'sent', sent_at = NOW(), sent_by = $1
        WHERE id = $2 AND status = 'draft'
        RETURNING *
      `, [request.user.id, request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found or not in draft status' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/deficiency-letters/:id/cancel — cancel a letter
  fastify.patch('/:id/cancel', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        UPDATE deficiency_letters SET status = 'cancelled' WHERE id = $1 AND status = 'draft' RETURNING *
      `, [request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found or not cancellable' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/deficiency-letters/:id — update letter text
  fastify.put('/:id', async (request, reply) => {
    try {
      const { letter_text } = request.body;
      const { rows } = await pool.query(`
        UPDATE deficiency_letters SET letter_text = $1 WHERE id = $2 AND status = 'draft' RETURNING *
      `, [letter_text, request.params.id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Not found or not editable' });
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
