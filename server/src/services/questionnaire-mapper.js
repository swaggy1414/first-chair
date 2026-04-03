import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';

async function getCaseContext(caseId) {
  const { rows: caseRows } = await pool.query(`
    SELECT c.*, p.name as paralegal_name, a.name as attorney_name
    FROM cases c
    LEFT JOIN users p ON c.assigned_paralegal_id = p.id
    LEFT JOIN users a ON c.assigned_attorney_id = a.id
    WHERE c.id = $1
  `, [caseId]);
  if (caseRows.length === 0) return null;

  const caseData = caseRows[0];

  // Get treatments
  const { rows: treatments } = await pool.query(
    'SELECT provider_name, treatment_type, start_date, end_date, status, notes FROM treatments WHERE case_id = $1 ORDER BY start_date',
    [caseId]
  );

  // Get records
  const { rows: records } = await pool.query(
    'SELECT provider_name, request_type, status FROM records_requests WHERE case_id = $1',
    [caseId]
  );

  // Get contact log (recent)
  const { rows: contacts } = await pool.query(
    'SELECT contact_type, contact_date, notes FROM contact_log WHERE case_id = $1 ORDER BY contact_date DESC LIMIT 5',
    [caseId]
  );

  return { case: caseData, treatments, records, contacts };
}

function buildCaseContextString(ctx) {
  const c = ctx.case;
  const parts = [];
  parts.push(`Client: ${c.client_name}`);
  parts.push(`Incident Date: ${c.incident_date ? new Date(c.incident_date).toLocaleDateString() : 'Unknown'}`);
  parts.push(`Incident Type: ${c.incident_type || 'Unknown'}`);
  parts.push(`Case Notes: ${c.notes || 'None'}`);

  if (ctx.treatments.length > 0) {
    parts.push('Treatment Providers: ' + ctx.treatments.map(t =>
      `${t.provider_name} (${t.treatment_type}, ${t.status})`
    ).join('; '));
  }

  if (ctx.records.length > 0) {
    parts.push('Records: ' + ctx.records.map(r =>
      `${r.provider_name} (${r.request_type}, ${r.status})`
    ).join('; '));
  }

  return parts.join('\n');
}

export async function mapQuestionnaire(caseId, responseId) {
  // Get the discovery response content
  const { rows: responseRows } = await pool.query(
    'SELECT * FROM discovery_responses WHERE id = $1 AND case_id = $2',
    [responseId, caseId]
  );
  if (responseRows.length === 0) {
    throw new Error('Discovery response not found');
  }

  const response = responseRows[0];

  // Get gaps (which contain the original request text — the interrogatories)
  const { rows: gaps } = await pool.query(`
    SELECT request_number, request_type, original_request_text, gap_description
    FROM discovery_gaps
    WHERE discovery_response_id = $1
    ORDER BY request_number
  `, [responseId]);

  // Get case context for pre-population
  const ctx = await getCaseContext(caseId);
  if (!ctx) throw new Error('Case not found');

  const caseContextStr = buildCaseContextString(ctx);

  // Build the interrogatory list from gaps (which have original_request_text)
  const interrogatories = gaps
    .filter(g => g.original_request_text)
    .map(g => `${g.request_type || 'Request'} #${g.request_number}: ${g.original_request_text}`);

  if (interrogatories.length === 0) {
    // If no gaps with original text, create a generic set based on case type
    interrogatories.push(
      'Interrogatory #1: State the date, time, and location of the incident.',
      'Interrogatory #2: Describe in detail how the incident occurred.',
      'Interrogatory #3: List all injuries sustained as a result of the incident.',
      'Interrogatory #4: List all medical providers who have treated you for injuries from this incident.',
      'Interrogatory #5: Describe your current physical condition and any ongoing symptoms.',
      'Interrogatory #6: List all medications you are currently taking as a result of this incident.',
      'Interrogatory #7: Describe any lost wages or inability to work as a result of this incident.',
      'Interrogatory #8: Identify all witnesses to the incident.',
    );
  }

  const prompt = `You are a paralegal assistant. A client needs to answer discovery interrogatories. Convert each interrogatory into a simple, plain-English question the client can understand. Then, using the case data provided, pre-fill any answers you can determine from the existing information.

Return a JSON array of objects, each with:
- "number": the interrogatory number
- "original": the original legal interrogatory text
- "plain_question": the simple plain-English version for the client
- "pre_filled_answer": answer pre-filled from case data (or null if unknown)
- "needs_client_input": boolean — true if the client still needs to provide or verify the answer

INTERROGATORIES:
${interrogatories.join('\n')}

CASE DATA:
${caseContextStr}

Return ONLY the JSON array, no other text.`;

  let questions = [];
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content[0].text.trim();
      // Extract JSON from response (may be wrapped in markdown code block)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('AI questionnaire mapping failed:', err.message);
    }
  }

  // Fallback: generate basic mappings without AI
  if (questions.length === 0) {
    const c = ctx.case;
    const treatmentList = ctx.treatments.map(t => t.provider_name).join(', ');
    const incidentDate = c.incident_date ? new Date(c.incident_date).toLocaleDateString() : null;

    for (let i = 0; i < interrogatories.length; i++) {
      const orig = interrogatories[i];
      const num = i + 1;

      let plainQ = orig.replace(/^(Interrogatory|interrogatory|RFA|RPD|Request)\s*#?\d*:?\s*/i, '');
      let preFilled = null;
      let needsInput = true;

      // Simple keyword matching for pre-population
      const lower = orig.toLowerCase();
      if (lower.includes('date') && lower.includes('incident')) {
        plainQ = 'When did the incident happen?';
        preFilled = incidentDate;
        needsInput = !incidentDate;
      } else if (lower.includes('how') && (lower.includes('occur') || lower.includes('happen'))) {
        plainQ = 'In your own words, describe what happened.';
        preFilled = c.notes || null;
        needsInput = true;
      } else if (lower.includes('medical provider') || lower.includes('treated') || lower.includes('doctor') || lower.includes('hospital')) {
        plainQ = 'List all doctors, hospitals, or clinics that have treated you for these injuries.';
        preFilled = treatmentList || null;
        needsInput = !treatmentList;
      } else if (lower.includes('injur')) {
        plainQ = 'What injuries did you receive from this incident?';
        preFilled = null;
        needsInput = true;
      } else if (lower.includes('current') && (lower.includes('condition') || lower.includes('symptom'))) {
        plainQ = 'How are you feeling now? Describe any ongoing pain or symptoms.';
        needsInput = true;
      } else if (lower.includes('medication')) {
        plainQ = 'What medications are you currently taking because of this incident?';
        needsInput = true;
      } else if (lower.includes('wage') || lower.includes('work') || lower.includes('employ')) {
        plainQ = 'Have you missed any work or lost any income because of this incident? If yes, describe.';
        needsInput = true;
      } else if (lower.includes('witness')) {
        plainQ = 'Were there any witnesses to the incident? If yes, provide their names and contact information.';
        needsInput = true;
      }

      questions.push({
        number: num,
        original: orig,
        plain_question: plainQ,
        pre_filled_answer: preFilled,
        needs_client_input: needsInput,
      });
    }
  }

  // Store in discovery_questionnaires
  const { rows: inserted } = await pool.query(`
    INSERT INTO discovery_questionnaires (case_id, sent_by, client_email, status, questions_json, mapped_from_response_id)
    VALUES ($1, NULL, $2, 'draft', $3, $4)
    RETURNING *
  `, [caseId, ctx.case.client_email, JSON.stringify(questions), responseId]);

  return {
    questionnaire: inserted[0],
    questions,
    total_questions: questions.length,
    needs_client_input: questions.filter(q => q.needs_client_input).length,
    pre_filled: questions.filter(q => q.pre_filled_answer).length,
  };
}
