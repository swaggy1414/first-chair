import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function workQueueActionRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // POST /api/work-queue-actions/send-letter — queue a follow-up letter for a case's overdue records
  fastify.post('/send-letter', async (request, reply) => {
    try {
      const { case_id } = request.body;
      if (!case_id) return reply.status(400).send({ error: 'case_id required' });

      // Find the oldest outstanding records request for this case
      const { rows: requests } = await pool.query(`
        SELECT rr.id, rr.provider_name, rr.request_type,
          (CURRENT_DATE - rr.requested_date) AS days_outstanding
        FROM records_requests rr
        WHERE rr.case_id = $1 AND rr.status IN ('sent', 'follow_up') AND rr.received_date IS NULL
        ORDER BY rr.requested_date ASC
        LIMIT 1
      `, [case_id]);

      if (requests.length === 0) {
        return reply.status(404).send({ error: 'No outstanding records requests found for this case' });
      }

      const rr = requests[0];

      // Determine follow-up type based on days outstanding
      let followupType = 'day_14';
      if (rr.days_outstanding >= 60) followupType = 'day_60';
      else if (rr.days_outstanding >= 45) followupType = 'day_45';
      else if (rr.days_outstanding >= 30) followupType = 'day_30';

      // Check if a follow-up of this type already exists and is queued
      const { rows: existing } = await pool.query(`
        SELECT id FROM records_followup_log
        WHERE records_request_id = $1 AND followup_type = $2 AND status = 'queued'
      `, [rr.id, followupType]);

      if (existing.length > 0) {
        return { message: 'Follow-up letter already queued', followup_id: existing[0].id, provider: rr.provider_name };
      }

      // Generate letter text
      const { rows: caseRows } = await pool.query(
        'SELECT case_number, client_name FROM cases WHERE id = $1', [case_id]
      );
      const caseName = caseRows[0]?.client_name || 'Client';
      const caseNumber = caseRows[0]?.case_number || '';

      const letterText = `RE: ${caseNumber} — ${caseName}\n\nDear ${rr.provider_name},\n\nThis letter is a follow-up to our records request dated ${rr.days_outstanding} days ago. We have not yet received the requested ${rr.request_type} records. Please provide these records at your earliest convenience.\n\nIf you have any questions, please contact our office.\n\nSincerely,\nFirst Chair Legal Team`;

      // Insert follow-up log entry
      const { rows: inserted } = await pool.query(`
        INSERT INTO records_followup_log (records_request_id, case_id, followup_type, letter_text, status)
        VALUES ($1, $2, $3, $4, 'queued')
        RETURNING *
      `, [rr.id, case_id, followupType, letterText]);

      // Update the records request status to follow_up
      await pool.query(
        "UPDATE records_requests SET status = 'follow_up' WHERE id = $1",
        [rr.id]
      );

      return reply.status(201).send({
        message: `Follow-up letter queued for ${rr.provider_name}`,
        followup: inserted[0],
        provider: rr.provider_name,
        days_outstanding: rr.days_outstanding,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/work-queue-actions/call-client — log a follow-up call
  fastify.post('/call-client', async (request, reply) => {
    try {
      const { case_id } = request.body;
      if (!case_id) return reply.status(400).send({ error: 'case_id required' });

      const { rows } = await pool.query(`
        INSERT INTO contact_log (case_id, contact_type, contact_date, notes, logged_by)
        VALUES ($1, 'phone', CURRENT_DATE, 'Follow-up call initiated from Work Queue', $2)
        RETURNING *
      `, [case_id, request.user.id]);

      const { rows: caseRows } = await pool.query(
        'SELECT case_number, client_name, client_phone FROM cases WHERE id = $1', [case_id]
      );

      return reply.status(201).send({
        message: `Call logged for ${caseRows[0]?.client_name || 'client'}`,
        contact: rows[0],
        client_phone: caseRows[0]?.client_phone || null,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/work-queue-actions/escalate — create a critical attorney request
  fastify.post('/escalate', async (request, reply) => {
    try {
      const { case_id, description } = request.body;
      if (!case_id) return reply.status(400).send({ error: 'case_id required' });

      const title = 'Escalated from Work Queue';
      const escalationDesc = description || 'Issue escalated from work queue — requires immediate attorney attention.';

      const { rows } = await pool.query(`
        INSERT INTO attorney_requests (case_id, requested_by, priority, title, description, status, due_date)
        VALUES ($1, $2, 'critical', $3, $4, 'open', CURRENT_DATE + INTERVAL '2 days')
        RETURNING *
      `, [case_id, request.user.id, title, escalationDesc]);

      return reply.status(201).send({
        message: 'Escalated to attorney — critical priority',
        attorney_request: rows[0],
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/work-queue-actions/seed-demo — admin only, seeds demo data
  fastify.post('/seed-demo', { preHandler: [authorize('admin')] }, async (request, reply) => {
    try {
      const { seedDemo } = await import('../seed-demo.js');
      const result = await seedDemo();
      return result;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
