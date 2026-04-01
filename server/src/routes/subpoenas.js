import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

async function analyzeWithClaude(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set — returning mock result');
    return null;
  }
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return message.content[0].text.trim();
}

export default async function subpoenaRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // ─── Registered Agent Lookup ───

  // POST /api/subpoenas/lookup
  fastify.post('/lookup', async (request, reply) => {
    try {
      const { entity_name, state } = request.body;

      if (!entity_name || !state) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'entity_name and state are required' });
      }

      // Check cache (within 90 days)
      const { rows: cached } = await pool.query(`
        SELECT * FROM registered_agent_cache
        WHERE entity_name = $1 AND state = $2 AND lookup_date > NOW() - INTERVAL '90 days'
        ORDER BY lookup_date DESC LIMIT 1
      `, [entity_name, state]);

      if (cached.length > 0) {
        return { ...cached[0], cached: true };
      }

      let result = null;
      let source = 'ai_lookup';

      // NC SOS lookup
      if (state.toUpperCase() === 'NC') {
        try {
          const url = `https://www.sosnc.gov/online_services/search/business_registration_results?Legal_Name=${encodeURIComponent(entity_name)}`;
          const res = await fetch(url);
          if (res.ok) {
            const html = await res.text();
            // Try to parse registered agent info from HTML
            const agentMatch = html.match(/Registered Agent[^<]*<[^>]*>([^<]+)/i);
            const addressMatch = html.match(/Agent Address[^<]*<[^>]*>([^<]+)/i);
            if (agentMatch) {
              result = {
                registered_agent_name: agentMatch[1].trim(),
                registered_agent_address: addressMatch ? addressMatch[1].trim() : 'Address not found — verify independently',
                service_address: addressMatch ? addressMatch[1].trim() : null,
                service_department: null,
                notes: 'Retrieved from NC Secretary of State website',
                verify_recommended: true,
              };
              source = 'nc_sos';
            }
          }
        } catch (err) {
          console.log('NC SOS fetch failed, falling back to AI:', err.message);
        }
      }

      // AI lookup (all states or NC fallback)
      if (!result) {
        const systemPrompt = 'You are a PI litigation paralegal. Given a business name and state, provide the most likely registered agent information: Registered agent name, registered agent address, Legal or subpoena processing department if known, Best service address for subpoenas. If this is a hospital or medical provider — provide the medical records department address. If this is an insurance company — provide the legal department address. Be specific. Note if information should be independently verified. Return JSON only: { registered_agent_name, registered_agent_address, service_address, service_department, notes, verify_recommended }';
        const userPrompt = `Business: ${entity_name}\nState: ${state}`;

        const aiResult = await analyzeWithClaude(systemPrompt, userPrompt);
        if (aiResult) {
          try {
            result = JSON.parse(aiResult);
          } catch {
            console.error('Failed to parse AI response for registered agent lookup');
          }
        }

        if (!result) {
          result = {
            registered_agent_name: `${entity_name} — Registered Agent`,
            registered_agent_address: `Contact ${state} Secretary of State for registered agent address`,
            service_address: null,
            service_department: 'Legal Department',
            notes: 'Mock data — set ANTHROPIC_API_KEY for real lookups',
            verify_recommended: true,
          };
        }
        source = 'ai_lookup';
      }

      // Cache the result
      const { rows: insertedRows } = await pool.query(`
        INSERT INTO registered_agent_cache (entity_name, state, registered_agent_name, registered_agent_address, service_address, service_department, notes, verify_recommended, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [entity_name, state, result.registered_agent_name, result.registered_agent_address, result.service_address, result.service_department, result.notes, result.verify_recommended, source]);

      return { ...insertedRows[0], cached: false, source };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── State Compliance ───

  // POST /api/subpoenas/compliance/:state
  fastify.post('/compliance/:state', async (request, reply) => {
    try {
      const { issuing_state, service_state } = request.body;

      if (!issuing_state || !service_state) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'issuing_state and service_state are required' });
      }

      const systemPrompt = 'You are a PI litigation paralegal expert in subpoena rules across all 50 states.';
      const userPrompt = `For a subpoena issued in ${issuing_state} to be served in ${service_state}: Is this a foreign subpoena? Yes or no and why. What is the correct process? Step by step. Is court filing required? If yes — which court and what form. Is a commission required? If yes — from which court. What is the required notice period? Any special requirements or restrictions? Most common mistakes to avoid? Return JSON only: { is_foreign, service_requirements, court_filing_required, court_name, commission_required, notice_period_days, special_instructions, common_mistakes }`;

      let result = null;
      const aiResult = await analyzeWithClaude(systemPrompt, userPrompt);
      if (aiResult) {
        try {
          result = JSON.parse(aiResult);
        } catch {
          console.error('Failed to parse AI response for compliance check');
        }
      }

      if (!result) {
        const isForeign = issuing_state.toUpperCase() !== service_state.toUpperCase();
        result = {
          is_foreign: isForeign,
          service_requirements: isForeign
            ? `Foreign subpoena from ${issuing_state} must be domesticated in ${service_state} under the Uniform Interstate Depositions and Discovery Act (UIDDA) if adopted.`
            : `Standard in-state service rules apply for ${issuing_state}.`,
          court_filing_required: isForeign,
          court_name: isForeign ? `${service_state} Superior Court or equivalent trial court in the county of service` : null,
          commission_required: isForeign,
          notice_period_days: 30,
          special_instructions: 'Mock data — set ANTHROPIC_API_KEY for real compliance analysis. Always verify with local rules.',
          common_mistakes: isForeign
            ? ['Failing to domesticate the subpoena', 'Not providing adequate notice', 'Using wrong court for filing']
            : ['Insufficient notice period', 'Improper service method'],
        };
      }

      return result;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Subpoena CRUD ───

  // POST /api/subpoenas/create/:caseId
  fastify.post('/create/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
      const caseCheck = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const {
        subpoena_type, recipient_name, recipient_type, registered_agent_name,
        registered_agent_address, service_address, service_method, state_of_service,
        is_foreign_subpoena, issued_date, served_date, response_due_date,
        status, discovery_gap_id, notes,
      } = request.body;

      // Auto-set response_due_date to 30 days from today if not provided
      const dueDateValue = response_due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { rows } = await pool.query(`
        INSERT INTO subpoenas (case_id, subpoena_type, recipient_name, recipient_type, registered_agent_name, registered_agent_address, service_address, service_method, state_of_service, is_foreign_subpoena, issued_date, served_date, response_due_date, status, discovery_gap_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [caseId, subpoena_type, recipient_name, recipient_type, registered_agent_name, registered_agent_address, service_address, service_method, state_of_service, is_foreign_subpoena || false, issued_date, served_date, dueDateValue, status || 'draft', discovery_gap_id, notes]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/subpoenas/case/:caseId
  fastify.get('/case/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT s.*, c.case_number
        FROM subpoenas s
        JOIN cases c ON s.case_id = c.id
        WHERE s.case_id = $1
        ORDER BY s.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/subpoenas/:id
  fastify.put('/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['subpoena_type', 'recipient_name', 'recipient_type', 'registered_agent_name', 'registered_agent_address', 'service_address', 'service_method', 'state_of_service', 'is_foreign_subpoena', 'issued_date', 'served_date', 'response_due_date', 'status', 'discovery_gap_id', 'notes'];
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
      sets.push('updated_at = NOW()');
      params.push(request.params.id);
      const { rows } = await pool.query(
        `UPDATE subpoenas SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Subpoena not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/subpoenas/:id/status
  fastify.patch('/:id/status', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'status is required' });
      }

      const { rows } = await pool.query(
        `UPDATE subpoenas SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, request.params.id]
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Subpoena not found' });
      }

      // If complied and linked to a discovery gap, resolve the gap
      if (status === 'complied' && rows[0].discovery_gap_id) {
        await pool.query(
          `UPDATE discovery_gaps SET status = 'resolved', resolved_at = NOW() WHERE id = $1`,
          [rows[0].discovery_gap_id]
        );
      }

      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Document Generation ───

  // POST /api/subpoenas/generate/:id
  fastify.post('/generate/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { rows: subRows } = await pool.query(`
        SELECT s.*, c.case_number, c.client_name, c.incident_type
        FROM subpoenas s
        JOIN cases c ON s.case_id = c.id
        WHERE s.id = $1
      `, [request.params.id]);

      if (subRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Subpoena not found' });
      }

      const sub = subRows[0];

      const systemPrompt = 'You are a legal document generation assistant.';
      const userPrompt = `Generate a complete subpoena document for ${sub.subpoena_type} addressed to ${sub.recipient_name} at ${sub.service_address || 'ADDRESS TO BE DETERMINED'}. Case: ${sub.case_number} - ${sub.client_name}. Include: court header placeholder, case caption, command to produce documents/appear, specific items requested based on case type ${sub.incident_type || 'personal injury'}, return date ${sub.response_due_date || 'TO BE SET'}, attorney signature block. Professional legal format.`;

      let text;
      const aiResult = await analyzeWithClaude(systemPrompt, userPrompt);
      if (aiResult) {
        text = aiResult;
      } else {
        text = `[COURT HEADER]\n\nIN THE GENERAL COURT OF JUSTICE\n[COUNTY] COUNTY, [STATE]\n\nCase No: ${sub.case_number}\n\n${sub.client_name}, Plaintiff\nvs.\n[DEFENDANT], Defendant\n\nSUBPOENA ${(sub.subpoena_type || 'DUCES TECUM').toUpperCase()}\n\nTO: ${sub.recipient_name}\n     ${sub.service_address || '[ADDRESS]'}\n\nYOU ARE HEREBY COMMANDED to produce the following documents and records:\n\n1. All records pertaining to ${sub.client_name}\n2. All billing records and statements\n3. All correspondence related to this matter\n4. All photographs, videos, or other media\n\nRETURN DATE: ${sub.response_due_date || '[DATE]'}\n\nFAILURE TO COMPLY with this subpoena may result in sanctions by the Court.\n\nDated: _______________\n\n_________________________\n[ATTORNEY NAME]\n[BAR NUMBER]\n[FIRM NAME]\n[FIRM ADDRESS]\n[FIRM PHONE]`;
      }

      return { text };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Responses ───

  // POST /api/subpoenas/response/:id
  fastify.post('/response/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verify subpoena exists
      const { rows: subCheck } = await pool.query('SELECT id FROM subpoenas WHERE id = $1', [id]);
      if (subCheck.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Subpoena not found' });
      }

      const {
        received_date, response_type, documents_received, objections_raised,
        deficiency_description, supplementation_needed, notes,
      } = request.body;

      const { rows } = await pool.query(`
        INSERT INTO subpoena_responses (subpoena_id, received_date, response_type, documents_received, objections_raised, deficiency_description, supplementation_needed, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [id, received_date, response_type, documents_received || false, objections_raised || false, deficiency_description, supplementation_needed || false, notes]);

      // If documents received, update subpoena status
      if (documents_received) {
        await pool.query(`UPDATE subpoenas SET status = 'responded', updated_at = NOW() WHERE id = $1`, [id]);
      }

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Overdue ───

  // GET /api/subpoenas/overdue
  fastify.get('/overdue', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT s.*, c.case_number
        FROM subpoenas s
        JOIN cases c ON s.case_id = c.id
        WHERE s.response_due_date < CURRENT_DATE
          AND s.status IN ('served', 'issued')
        ORDER BY s.response_due_date ASC
      `);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── All Subpoenas ───

  // GET /api/subpoenas/
  fastify.get('/', async (request, reply) => {
    try {
      const { status, state, search, overdue } = request.query;
      let query = `
        SELECT s.*, c.case_number, c.client_name
        FROM subpoenas s
        JOIN cases c ON s.case_id = c.id
      `;
      const conditions = [];
      const params = [];

      if (status) {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }

      if (state) {
        params.push(state);
        conditions.push(`s.state_of_service = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`s.recipient_name ILIKE $${params.length}`);
      }

      if (overdue === 'true') {
        conditions.push(`s.response_due_date < CURRENT_DATE AND s.status IN ('served', 'issued')`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY s.created_at DESC';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
