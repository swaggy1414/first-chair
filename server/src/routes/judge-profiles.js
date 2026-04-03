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

export default async function judgeProfileRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/judges/:id/profile — full profile with case history
  fastify.get('/:id/profile', async (request, reply) => {
    try {
      const { rows: judgeRows } = await pool.query(
        'SELECT * FROM judges WHERE id = $1',
        [request.params.id]
      );
      if (judgeRows.length === 0) {
        return reply.status(404).send({ error: 'Judge not found' });
      }
      const judge = judgeRows[0];

      // Get all cases with this judge (via join table and direct FK)
      const { rows: cases } = await pool.query(`
        SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase,
          c.incident_date, c.created_at,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned
        FROM case_judges cj
        JOIN cases c ON cj.case_id = c.id
        LEFT JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE cj.judge_id = $1
        ORDER BY c.created_at DESC
      `, [request.params.id]);

      const { rows: directCases } = await pool.query(`
        SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase,
          c.incident_date, c.created_at,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned
        FROM cases c
        LEFT JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE c.judge_id = $1
        AND c.id NOT IN (SELECT case_id FROM case_judges WHERE judge_id = $1)
        ORDER BY c.created_at DESC
      `, [request.params.id]);

      const allCases = [...cases, ...directCases];

      const totalCases = allCases.length;
      const settledCases = allCases.filter(c => c.outcome === 'settled' || c.status === 'settled');
      const dismissedCases = allCases.filter(c => c.outcome === 'dismissed');
      const verdictCases = allCases.filter(c => c.outcome === 'verdict');
      const avgSettlement = settledCases.filter(c => c.settlement_amount).length > 0
        ? Math.round(settledCases.reduce((sum, c) => sum + (Number(c.settlement_amount) || 0), 0) / settledCases.filter(c => c.settlement_amount).length)
        : null;
      const avgDuration = allCases.filter(c => c.duration_days).length > 0
        ? Math.round(allCases.reduce((sum, c) => sum + (c.duration_days || 0), 0) / allCases.filter(c => c.duration_days).length)
        : null;

      // Get discovery motion data
      const caseIds = allCases.map(c => c.id);
      let motionStats = { motions_to_compel: 0 };
      if (caseIds.length > 0) {
        const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows: gaps } = await pool.query(`
          SELECT COUNT(*) as count
          FROM discovery_gaps
          WHERE case_id IN (${placeholders}) AND gap_action = 'confirmed'
        `, caseIds);
        motionStats.motions_to_compel = Number(gaps[0]?.count || 0);
      }

      let behaviorSummary = null;
      if (totalCases > 0) {
        const prompt = `You are a legal analyst. Based on the following data about judge "${judge.name}" at "${judge.court}", provide a brief judicial profile (3-4 sentences max) focusing on tendencies relevant to litigation strategy.

Data:
- Total cases before this judge: ${totalCases}
- Settled: ${settledCases.length}, Dismissed: ${dismissedCases.length}, Verdict: ${verdictCases.length}
- Average settlement: ${avgSettlement ? '$' + Math.round(avgSettlement).toLocaleString() : 'N/A'}
- Average case duration: ${avgDuration ? avgDuration + ' days' : 'N/A'}
- Confirmed discovery deficiencies (potential motions to compel): ${motionStats.motions_to_compel}
- Judge notes: ${judge.notes || 'None'}

Return ONLY the judicial profile paragraph, no JSON.`;

        behaviorSummary = await analyzeWithClaude(prompt);
      }

      if (!behaviorSummary && totalCases > 0) {
        behaviorSummary = `${judge.name} has presided over ${totalCases} case(s) from our firm. ${settledCases.length} settled, ${verdictCases.length} went to verdict. ${judge.notes || ''}`;
      }

      return {
        judge,
        cases: allCases,
        stats: {
          total_cases: totalCases,
          settled: settledCases.length,
          dismissed: dismissedCases.length,
          verdict: verdictCases.length,
          avg_settlement: avgSettlement,
          avg_duration_days: avgDuration,
        },
        motion_stats: motionStats,
        behavior_summary: behaviorSummary,
        notes: judge.notes,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/judges/by-case/:caseId — get judges for a case
  fastify.get('/by-case/:caseId', async (request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT j.* FROM judges j
        JOIN case_judges cj ON cj.judge_id = j.id
        WHERE cj.case_id = $1
        UNION
        SELECT j.* FROM judges j
        JOIN cases c ON c.judge_id = j.id
        WHERE c.id = $1
      `, [request.params.caseId]);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/judges/link — link judge to a case
  fastify.post('/link', async (request, reply) => {
    try {
      const { case_id, judge_id } = request.body;

      const { rows: existing } = await pool.query(
        'SELECT id FROM case_judges WHERE case_id = $1 AND judge_id = $2',
        [case_id, judge_id]
      );
      if (existing.length > 0) {
        return reply.status(200).send({ message: 'Already linked' });
      }

      await pool.query(
        'INSERT INTO case_judges (case_id, judge_id) VALUES ($1, $2)',
        [case_id, judge_id]
      );

      await pool.query(
        'UPDATE cases SET judge_id = $1 WHERE id = $2',
        [judge_id, case_id]
      );

      return reply.status(201).send({ message: 'Linked' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/judges/unlink — unlink judge from a case
  fastify.delete('/unlink', async (request, reply) => {
    try {
      const { case_id, judge_id } = request.query;
      await pool.query(
        'DELETE FROM case_judges WHERE case_id = $1 AND judge_id = $2',
        [case_id, judge_id]
      );

      await pool.query(
        'UPDATE cases SET judge_id = NULL WHERE id = $1 AND judge_id = $2',
        [case_id, judge_id]
      );

      return { message: 'Unlinked' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/judges/search — search all judges (for dropdowns)
  fastify.get('/search', async (request, reply) => {
    try {
      const { q } = request.query;
      let query = 'SELECT * FROM judges';
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        query += ' WHERE name ILIKE $1 OR court ILIKE $1';
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
