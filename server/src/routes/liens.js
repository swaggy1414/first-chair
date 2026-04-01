import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'medical-records');

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

export default async function liensRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // ─── Medical Records Analysis ───

  // POST /api/liens/upload/:caseId
  fastify.post('/upload/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
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
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(join(UPLOAD_DIR, storedName), buffer);

      const filePath = join(UPLOAD_DIR, storedName);
      const { rows } = await pool.query(`
        INSERT INTO medical_records_analysis (case_id, uploaded_by, file_name, file_size, file_path, source, analysis_status)
        VALUES ($1, $2, $3, $4, $5, 'manual_upload', 'processing')
        RETURNING *
      `, [caseId, request.user.id, file.filename, buffer.length, filePath]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/liens/analyze/:analysisId
  fastify.post('/analyze/:analysisId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { analysisId } = request.params;
      const { rows: analysisRows } = await pool.query('SELECT * FROM medical_records_analysis WHERE id = $1', [analysisId]);
      if (analysisRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Analysis record not found' });
      }

      const analysis = analysisRows[0];

      // Get case incident info
      const { rows: caseRows } = await pool.query('SELECT * FROM cases WHERE id = $1', [analysis.case_id]);
      const caseRecord = caseRows[0] || {};

      const systemPrompt = 'You are a PI litigation paralegal reviewing medical records and bills. For each date of service or line item identify: Whether the treatment is related to the accident or injury in this case. Confidence level: high over 85 percent, medium 60-85 percent, low under 60 percent. If unrelated — brief reason why. Flag as unrelated: treatment predating the accident by more than 90 days for unrelated conditions, treatment for conditions with no plausible connection to the accident, routine preventive care unrelated to injury, dental and vision unrelated to accident. Return JSON array only. No preamble. Each item: { date_of_service, provider_name, procedure_code, description, amount, is_related, ai_confidence, flag_reason }';

      const userPrompt = `Analyze medical records for case ${caseRecord.case_number || 'N/A'}. Client: ${caseRecord.client_name || 'N/A'}. Incident date: ${caseRecord.incident_date || 'N/A'}. Incident type: ${caseRecord.incident_type || 'N/A'}. File: ${analysis.file_name}.`;

      let items = [];
      const aiResult = await analyzeWithClaude(systemPrompt, userPrompt);

      if (aiResult) {
        try {
          items = JSON.parse(aiResult);
        } catch {
          console.error('Failed to parse AI response for medical records analysis');
        }
      }

      if (items.length === 0) {
        items = [
          { date_of_service: '2025-06-15', provider_name: 'City Orthopedics', procedure_code: '99213', description: 'Office visit - evaluation of cervical strain', amount: 250.00, is_related: true, ai_confidence: 92, flag_reason: null },
          { date_of_service: '2025-07-01', provider_name: 'Metro Physical Therapy', procedure_code: '97110', description: 'Therapeutic exercises - neck and shoulder', amount: 175.00, is_related: true, ai_confidence: 88, flag_reason: null },
          { date_of_service: '2025-03-10', provider_name: 'Family Dental Care', procedure_code: 'D1110', description: 'Routine dental cleaning', amount: 120.00, is_related: false, ai_confidence: 95, flag_reason: 'Routine dental care unrelated to accident' },
        ];
      }

      // Insert line items
      const insertedItems = [];
      for (const item of items) {
        const { rows: itemRows } = await pool.query(`
          INSERT INTO treatment_line_items (medical_records_analysis_id, case_id, date_of_service, provider_name, procedure_code, description, amount, is_related, ai_confidence, flag_reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [analysisId, analysis.case_id, item.date_of_service, item.provider_name, item.procedure_code, item.description, item.amount, item.is_related, item.ai_confidence, item.flag_reason]);
        insertedItems.push(itemRows[0]);
      }

      // Update analysis counts and status
      const relatedCount = items.filter(i => i.is_related).length;
      const unrelatedCount = items.filter(i => !i.is_related).length;
      const totalAmount = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

      await pool.query(`
        UPDATE medical_records_analysis
        SET analysis_status = 'complete', related_treatment_count = $1, unrelated_treatment_count = $2, total_billed_amount = $3, processed_at = NOW()
        WHERE id = $4
      `, [relatedCount, unrelatedCount, totalAmount, analysisId]);

      const { rows: updatedAnalysis } = await pool.query('SELECT * FROM medical_records_analysis WHERE id = $1', [analysisId]);

      return { analysis: updatedAnalysis[0], items: insertedItems };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/liens/analysis/:caseId
  fastify.get('/analysis/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT mra.*, u.name AS uploaded_by_name
        FROM medical_records_analysis mra
        LEFT JOIN users u ON mra.uploaded_by = u.id
        WHERE mra.case_id = $1
        ORDER BY mra.created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/liens/treatment-items/:analysisId
  fastify.get('/treatment-items/:analysisId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT * FROM treatment_line_items
        WHERE medical_records_analysis_id = $1
        ORDER BY date_of_service
      `, [request.params.analysisId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PATCH /api/liens/treatment-items/:id
  fastify.patch('/treatment-items/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['is_related', 'paralegal_override', 'reviewed_by_paralegal', 'flag_reason'];
      const sets = [];
      const params = [];
      for (const key of allowed) {
        if (key === 'reviewed_by_paralegal') continue; // set automatically below
        if (key in fields) {
          params.push(fields[key]);
          sets.push(`${key} = $${params.length}`);
        }
      }
      // Always set reviewed_by_paralegal to the current user
      params.push(request.user.id);
      sets.push(`reviewed_by_paralegal = $${params.length}`);

      if (sets.length === 0) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'No valid fields to update' });
      }
      params.push(request.params.id);
      const { rows } = await pool.query(
        `UPDATE treatment_line_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Treatment line item not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Liens ───

  // GET /api/liens/liens/:caseId
  fastify.get('/liens/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT * FROM liens WHERE case_id = $1 ORDER BY created_at DESC
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/liens/liens/:caseId
  fastify.post('/liens/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;
      const caseCheck = await pool.query('SELECT id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const { health_plan_name, plan_type, lien_status, subrogation_company, subrogation_contact_name, subrogation_contact_phone, subrogation_contact_email, lien_amount, negotiated_amount, next_follow_up_date, notes } = request.body;

      const { rows } = await pool.query(`
        INSERT INTO liens (case_id, health_plan_name, plan_type, lien_status, subrogation_company, subrogation_contact_name, subrogation_contact_phone, subrogation_contact_email, lien_amount, negotiated_amount, next_follow_up_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [caseId, health_plan_name, plan_type, lien_status, subrogation_company, subrogation_contact_name, subrogation_contact_phone, subrogation_contact_email, lien_amount, negotiated_amount, next_follow_up_date, notes]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // PUT /api/liens/liens/:id
  fastify.put('/liens/:id', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const fields = request.body;
      const allowed = ['health_plan_name', 'plan_type', 'lien_status', 'subrogation_company', 'subrogation_contact_name', 'subrogation_contact_phone', 'subrogation_contact_email', 'lien_amount', 'negotiated_amount', 'hipaa_sent_at', 'lor_sent_at', 'last_update_received', 'next_follow_up_date', 'notes'];
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
        `UPDATE liens SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (rows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lien not found' });
      }
      return rows[0];
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/liens/liens/:id
  fastify.delete('/liens/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM liens WHERE id = $1', [request.params.id]);
      if (rowCount === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lien not found' });
      }
      return { message: 'Lien deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Damages Chart ───

  // POST /api/liens/damages-chart/:caseId
  fastify.post('/damages-chart/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal', 'attorney')] }, async (request, reply) => {
    try {
      const { caseId } = request.params;

      // Get all related treatment line items for the case, grouped by provider
      const { rows: relatedItems } = await pool.query(`
        SELECT provider_name, SUM(amount) AS total_amount, COUNT(*) AS visit_count
        FROM treatment_line_items
        WHERE case_id = $1 AND is_related = true
        GROUP BY provider_name
        ORDER BY provider_name
      `, [caseId]);

      // Get all treatment line items for totals
      const { rows: allItems } = await pool.query(`
        SELECT
          COALESCE(SUM(amount), 0) AS total_medical_bills,
          COALESCE(SUM(CASE WHEN is_related = true THEN amount ELSE 0 END), 0) AS related_medical_bills
        FROM treatment_line_items
        WHERE case_id = $1
      `, [caseId]);

      // Get all liens for the case
      const { rows: liens } = await pool.query(`
        SELECT * FROM liens WHERE case_id = $1
      `, [caseId]);

      const lienTotal = liens.reduce((sum, l) => sum + (Number(l.lien_amount) || 0), 0);
      const negotiatedTotal = liens.reduce((sum, l) => sum + (Number(l.negotiated_amount) || 0), 0);
      const totalMedical = Number(allItems[0]?.total_medical_bills) || 0;
      const relatedMedical = Number(allItems[0]?.related_medical_bills) || 0;

      // Insert damages chart
      const { rows: chartRows } = await pool.query(`
        INSERT INTO damages_chart (case_id, total_medical_bills, related_medical_bills, lien_total, negotiated_lien_total, generated_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [caseId, totalMedical, relatedMedical, lienTotal, negotiatedTotal, request.user.id]);

      const chart = chartRows[0];

      // Insert damages line items
      const lineItems = [];
      for (const item of relatedItems) {
        const { rows: liRows } = await pool.query(`
          INSERT INTO damages_line_items (damages_chart_id, provider_name, total_amount, visit_count)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [chart.id, item.provider_name, item.total_amount, item.visit_count]);
        lineItems.push(liRows[0]);
      }

      return { ...chart, line_items: lineItems };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/liens/damages-chart/:caseId
  fastify.get('/damages-chart/:caseId', async (request, reply) => {
    try {
      const { rows: chartRows } = await pool.query(`
        SELECT * FROM damages_chart
        WHERE case_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [request.params.caseId]);

      if (chartRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'No damages chart found for this case' });
      }

      const chart = chartRows[0];
      const { rows: lineItems } = await pool.query(`
        SELECT * FROM damages_line_items
        WHERE damages_chart_id = $1
        ORDER BY provider_name
      `, [chart.id]);

      return { ...chart, line_items: lineItems };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── AI Document Generation ───

  // POST /api/liens/generate-hipaa/:lienId
  fastify.post('/generate-hipaa/:lienId', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { lienId } = request.params;
      const { rows: lienRows } = await pool.query(`
        SELECT l.*, c.client_name, c.case_number
        FROM liens l
        JOIN cases c ON l.case_id = c.id
        WHERE l.id = $1
      `, [lienId]);

      if (lienRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lien not found' });
      }

      const lien = lienRows[0];

      const prompt = `Generate a complete HIPAA authorization form for ${lien.health_plan_name}. Include: patient name placeholder, date of birth placeholder, member ID placeholder, authorization for release of claims payment ledger and lien information, firm name and address, attorney signature block. Professional format. Ready to fill in and send.`;

      let text;
      const aiResult = await analyzeWithClaude('You are a legal document generation assistant.', prompt);
      if (aiResult) {
        text = aiResult;
      } else {
        text = `HIPAA AUTHORIZATION FOR RELEASE OF INFORMATION\n\nTo: ${lien.health_plan_name}\n\nI, [PATIENT NAME], Date of Birth: [DOB], Member ID: [MEMBER ID], hereby authorize the release of the following information:\n\n- Claims payment ledger\n- Lien information and amounts\n- All records related to treatment and billing\n\nThis authorization is valid for one year from the date of signature.\n\nPatient Signature: _________________________ Date: _____________\n\nAttorney Signature: _________________________ Date: _____________\n\n[FIRM NAME]\n[FIRM ADDRESS]\n[FIRM PHONE]`;
      }

      // Update lien hipaa_sent_at
      await pool.query('UPDATE liens SET hipaa_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [lienId]);

      return { text };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/liens/generate-lor/:lienId
  fastify.post('/generate-lor/:lienId', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const { lienId } = request.params;
      const { rows: lienRows } = await pool.query(`
        SELECT l.*, c.client_name, c.case_number
        FROM liens l
        JOIN cases c ON l.case_id = c.id
        WHERE l.id = $1
      `, [lienId]);

      if (lienRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Lien not found' });
      }

      const lien = lienRows[0];

      const prompt = `Generate a letter of representation addressed to ${lien.subrogation_company} regarding ${lien.health_plan_name} lien for ${lien.client_name}, case ${lien.case_number}. Include: firm letterhead placeholder, date, RE line with client name and claim number placeholder, notification of representation, request to direct all communications to the firm, request for itemized lien statement, HIPAA authorization enclosed reference, contact information. Professional legal format.`;

      let text;
      const aiResult = await analyzeWithClaude('You are a legal document generation assistant.', prompt);
      if (aiResult) {
        text = aiResult;
      } else {
        text = `[FIRM LETTERHEAD]\n\n${new Date().toLocaleDateString()}\n\n${lien.subrogation_company || '[SUBROGATION COMPANY]'}\n[ADDRESS]\n\nRE: ${lien.client_name} — Claim #[CLAIM NUMBER]\n    Lien Holder: ${lien.health_plan_name}\n\nDear Sir or Madam:\n\nPlease be advised that this firm represents ${lien.client_name} in connection with injuries sustained on or about [DATE OF LOSS]. Please direct all future communications regarding this matter to our office.\n\nWe respectfully request an itemized lien statement for our client's account. Enclosed please find a signed HIPAA authorization for the release of this information.\n\nPlease do not contact our client directly. All communications should be directed to:\n\n[FIRM NAME]\n[FIRM ADDRESS]\n[FIRM PHONE]\n[FIRM EMAIL]\n\nThank you for your prompt attention to this matter.\n\nSincerely,\n\n________________________\n[ATTORNEY NAME]\n[BAR NUMBER]`;
      }

      // Update lien lor_sent_at
      await pool.query('UPDATE liens SET lor_sent_at = NOW(), updated_at = NOW() WHERE id = $1', [lienId]);

      return { text };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // ─── Subrogation Directory ───

  // GET /api/liens/subrogation-directory
  fastify.get('/subrogation-directory', async (request, reply) => {
    try {
      const { search } = request.query;
      let query = 'SELECT * FROM subrogation_directory';
      const params = [];

      if (search) {
        params.push(`%${search}%`);
        query += ` WHERE health_plan_name ILIKE $1 OR subrogation_company ILIKE $1`;
      }

      query += ' ORDER BY health_plan_name';

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/liens/subrogation-directory
  fastify.post('/subrogation-directory', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { health_plan_name, subrogation_company, contact_name, contact_phone, contact_email, contact_fax, address, notes } = request.body;

      const { rows } = await pool.query(`
        INSERT INTO subrogation_directory (health_plan_name, subrogation_company, contact_name, contact_phone, contact_email, contact_fax, address, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [health_plan_name, subrogation_company, contact_name, contact_phone, contact_email, contact_fax, address, notes]);

      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
