import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';

const FOLLOWUP_TIERS = [
  { type: 'day_14', days: 14, tone: 'polite first follow-up', urgency: 'medium' },
  { type: 'day_30', days: 30, tone: 'firm second follow-up requesting immediate attention', urgency: 'high' },
  { type: 'day_45', days: 45, tone: 'demand letter warning of potential legal action', urgency: 'critical' },
  { type: 'day_60', days: 60, tone: 'final notice before subpoena or court intervention', urgency: 'critical' },
];

async function generateLetter(providerName, caseNumber, clientName, requestType, daysOutstanding, tone) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return `[${tone.toUpperCase()}]\n\nRe: ${clientName} — Case ${caseNumber}\n\nDear Records Department at ${providerName},\n\nThis office requested ${requestType || 'medical records'} ${daysOutstanding} days ago and has not received a response. Please provide the requested records immediately.\n\nThis is a ${tone}.\n\nFirst Chair Legal Team`;
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `Generate a professional ${tone} letter to ${providerName} regarding outstanding medical records request.

Patient/Client: ${clientName}
Case: ${caseNumber}
Records type: ${requestType || 'medical records'}
Days outstanding: ${daysOutstanding}

The letter should be from a PI law firm. Be professional but match the tone: ${tone}.
Include: date, RE line, specific request reference, deadline for response, consequences if applicable.
Return the letter text only. No JSON. No markdown.` }],
    });
    return message.content[0].text.trim();
  } catch (err) {
    console.error('AI letter generation failed:', err.message);
    return `Re: ${clientName} — Case ${caseNumber}\n\nDear ${providerName},\n\nWe are following up on our records request sent ${daysOutstanding} days ago. Please provide the requested ${requestType || 'records'} at your earliest convenience.\n\nFirst Chair Legal Team`;
  }
}

export async function runFollowupCheck() {
  const results = { checked: 0, generated: 0, errors: 0 };

  try {
    // Get all outstanding records requests
    const { rows: requests } = await pool.query(`
      SELECT rr.id, rr.case_id, rr.provider_name, rr.request_type, rr.requested_date, rr.status,
        c.case_number, c.client_name,
        EXTRACT(DAY FROM CURRENT_DATE - rr.requested_date)::int AS days_outstanding
      FROM records_requests rr
      JOIN cases c ON rr.case_id = c.id
      WHERE rr.status IN ('pending', 'sent')
        AND rr.requested_date IS NOT NULL
      ORDER BY rr.requested_date ASC
    `);

    results.checked = requests.length;

    for (const req of requests) {
      for (const tier of FOLLOWUP_TIERS) {
        if (req.days_outstanding >= tier.days) {
          // Check if this tier already exists for this request
          const { rows: existing } = await pool.query(
            'SELECT id FROM records_followup_log WHERE records_request_id = $1 AND followup_type = $2',
            [req.id, tier.type]
          );

          if (existing.length === 0) {
            try {
              const letterText = await generateLetter(
                req.provider_name, req.case_number, req.client_name,
                req.request_type, req.days_outstanding, tier.tone
              );

              await pool.query(`
                INSERT INTO records_followup_log (records_request_id, case_id, followup_type, letter_text, status)
                VALUES ($1, $2, $3, $4, 'queued')
              `, [req.id, req.case_id, tier.type, letterText]);

              results.generated++;
            } catch (err) {
              console.error(`Failed to generate ${tier.type} for ${req.provider_name}:`, err.message);
              results.errors++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Follow-up check failed:', err.message);
    results.errors++;
  }

  return results;
}
