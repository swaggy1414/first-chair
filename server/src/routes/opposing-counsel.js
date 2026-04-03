import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

async function analyzeWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0].text.trim();
}

export default async function opposingCounselRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/opposing-counsel/:id/profile — full profile with case history
  fastify.get('/:id/profile', async (request, reply) => {
    try {
      // Get counsel info
      const { rows: counselRows } = await pool.query(
        'SELECT * FROM opposing_counsel WHERE id = $1',
        [request.params.id]
      );
      if (counselRows.length === 0) {
        return reply.status(404).send({ error: 'Opposing counsel not found' });
      }
      const counsel = counselRows[0];

      // Get all cases involving this counsel (via case_opposing_counsel join or direct FK)
      const { rows: cases } = await pool.query(`
        SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase,
          c.incident_date, c.created_at,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned
        FROM case_opposing_counsel coc
        JOIN cases c ON coc.case_id = c.id
        LEFT JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE coc.opposing_counsel_id = $1
        ORDER BY c.created_at DESC
      `, [request.params.id]);

      // Also get cases linked via direct FK
      const { rows: directCases } = await pool.query(`
        SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase,
          c.incident_date, c.created_at,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned
        FROM cases c
        LEFT JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE c.opposing_counsel_id = $1
        AND c.id NOT IN (SELECT case_id FROM case_opposing_counsel WHERE opposing_counsel_id = $1)
        ORDER BY c.created_at DESC
      `, [request.params.id]);

      const allCases = [...cases, ...directCases];

      // Compute behavior patterns
      const totalCases = allCases.length;
      const settledCases = allCases.filter(c => c.outcome === 'settled' || c.status === 'settled');
      const dismissedCases = allCases.filter(c => c.outcome === 'dismissed');
      const verdictCases = allCases.filter(c => c.outcome === 'verdict');
      const avgSettlement = settledCases.length > 0
        ? settledCases.reduce((sum, c) => sum + (Number(c.settlement_amount) || 0), 0) / settledCases.filter(c => c.settlement_amount).length
        : null;
      const avgDuration = allCases.filter(c => c.duration_days).length > 0
        ? Math.round(allCases.reduce((sum, c) => sum + (c.duration_days || 0), 0) / allCases.filter(c => c.duration_days).length)
        : null;

      // Get discovery gaps for these cases to analyze discovery behavior
      const caseIds = allCases.map(c => c.id);
      let discoveryPatterns = { total_gaps: 0, evasive_answers: 0, objection_only: 0, no_answer: 0 };
      if (caseIds.length > 0) {
        const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows: gaps } = await pool.query(`
          SELECT gap_type, COUNT(*) as count
          FROM discovery_gaps
          WHERE case_id IN (${placeholders})
          GROUP BY gap_type
        `, caseIds);
        for (const g of gaps) {
          discoveryPatterns.total_gaps += Number(g.count);
          if (g.gap_type === 'evasive_answer') discoveryPatterns.evasive_answers = Number(g.count);
          if (g.gap_type === 'objection_only') discoveryPatterns.objection_only = Number(g.count);
          if (g.gap_type === 'no_answer') discoveryPatterns.no_answer = Number(g.count);
        }
      }

      // Build AI-generated behavior summary if we have data
      let behaviorSummary = null;
      if (totalCases > 0) {
        const prompt = `You are a legal analyst. Based on the following data about opposing counsel "${counsel.name}" from "${counsel.firm_name || 'unknown firm'}", provide a brief behavioral profile (3-4 sentences max).

Data:
- Total cases against our firm: ${totalCases}
- Settled: ${settledCases.length}, Dismissed: ${dismissedCases.length}, Verdict: ${verdictCases.length}
- Average settlement: ${avgSettlement ? '$' + Math.round(avgSettlement).toLocaleString() : 'N/A'}
- Average case duration: ${avgDuration ? avgDuration + ' days' : 'N/A'}
- Discovery gaps identified: ${discoveryPatterns.total_gaps} total (${discoveryPatterns.evasive_answers} evasive, ${discoveryPatterns.objection_only} objection-only, ${discoveryPatterns.no_answer} no-answer)

Return ONLY the behavioral summary paragraph, no JSON.`;

        behaviorSummary = await analyzeWithClaude(prompt);
      }

      if (!behaviorSummary && totalCases > 0) {
        behaviorSummary = `Across ${totalCases} case(s), ${counsel.name} has settled ${settledCases.length} and gone to verdict in ${verdictCases.length}. Discovery patterns show ${discoveryPatterns.total_gaps} total gaps identified in their responses.`;
      }

      return {
        counsel,
        cases: allCases,
        stats: {
          total_cases: totalCases,
          settled: settledCases.length,
          dismissed: dismissedCases.length,
          verdict: verdictCases.length,
          avg_settlement: avgSettlement ? Math.round(avgSettlement) : null,
          avg_duration_days: avgDuration,
        },
        discovery_patterns: discoveryPatterns,
        behavior_summary: behaviorSummary,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/opposing-counsel/by-case/:caseId — get opposing counsel for a case
  fastify.get('/by-case/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT oc.* FROM opposing_counsel oc
        JOIN case_opposing_counsel coc ON coc.opposing_counsel_id = oc.id
        WHERE coc.case_id = $1
        UNION
        SELECT oc.* FROM opposing_counsel oc
        JOIN cases c ON c.opposing_counsel_id = oc.id
        WHERE c.id = $1
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/opposing-counsel/link — link opposing counsel to a case
  fastify.post('/link', async (request, reply) => {
    try {
      const { case_id, opposing_counsel_id } = request.body;

      // Check if link already exists
      const { rows: existing } = await pool.query(
        'SELECT id FROM case_opposing_counsel WHERE case_id = $1 AND opposing_counsel_id = $2',
        [case_id, opposing_counsel_id]
      );
      if (existing.length > 0) {
        return reply.status(200).send({ message: 'Already linked' });
      }

      await pool.query(
        'INSERT INTO case_opposing_counsel (case_id, opposing_counsel_id) VALUES ($1, $2)',
        [case_id, opposing_counsel_id]
      );

      // Also set the direct FK on the case
      await pool.query(
        'UPDATE cases SET opposing_counsel_id = $1 WHERE id = $2',
        [opposing_counsel_id, case_id]
      );

      return reply.status(201).send({ message: 'Linked' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/opposing-counsel/unlink — unlink opposing counsel from a case
  fastify.delete('/unlink', async (request, reply) => {
    try {
      const { case_id, opposing_counsel_id } = request.query;
      await pool.query(
        'DELETE FROM case_opposing_counsel WHERE case_id = $1 AND opposing_counsel_id = $2',
        [case_id, opposing_counsel_id]
      );

      // Clear direct FK if it matches
      await pool.query(
        'UPDATE cases SET opposing_counsel_id = NULL WHERE id = $1 AND opposing_counsel_id = $2',
        [case_id, opposing_counsel_id]
      );

      return { message: 'Unlinked' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/opposing-counsel/search — search all opposing counsel (for dropdowns)
  fastify.get('/search', async (request, reply) => {
    try {
      const { q } = request.query;
      let query = 'SELECT * FROM opposing_counsel';
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        query += ' WHERE name ILIKE $1 OR firm_name ILIKE $1';
      }
      query += ' ORDER BY name LIMIT 50';
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
