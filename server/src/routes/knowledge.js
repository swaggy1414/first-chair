import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

export default async function knowledgeRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  // GET /api/knowledge — list all, support ?incident_type= ?outcome= ?search=
  fastify.get('/', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { incident_type, outcome, search } = request.query;
      let query = `
        SELECT ck.*, c.case_number, c.client_name, u.name AS created_by_name
        FROM case_knowledge ck
        JOIN cases c ON ck.case_id = c.id
        LEFT JOIN users u ON ck.created_by = u.id
      `;
      const conditions = [];
      const params = [];
      if (incident_type) { params.push(incident_type); conditions.push(`ck.incident_type = $${params.length}`); }
      if (outcome) { params.push(outcome); conditions.push(`ck.outcome = $${params.length}`); }
      if (search) { params.push(`%${search}%`); conditions.push(`(ck.lessons_learned ILIKE $${params.length} OR ck.injury_types ILIKE $${params.length} OR ck.liability_factors ILIKE $${params.length})`); }
      if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY ck.created_at DESC';
      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/knowledge/stats — aggregate stats
  fastify.get('/stats', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const [byType, byOutcome, avgDuration, topLessons] = await Promise.all([
        pool.query(`SELECT incident_type, COUNT(*) as count, ROUND(AVG(settlement_amount),2) as avg_settlement, ROUND(AVG(duration_days)) as avg_days FROM case_knowledge WHERE incident_type IS NOT NULL GROUP BY incident_type ORDER BY count DESC`),
        pool.query(`SELECT outcome, COUNT(*) as count FROM case_knowledge WHERE outcome IS NOT NULL GROUP BY outcome ORDER BY count DESC`),
        pool.query(`SELECT ROUND(AVG(duration_days)) as avg_duration, MIN(duration_days) as min_duration, MAX(duration_days) as max_duration FROM case_knowledge WHERE duration_days IS NOT NULL`),
        pool.query(`SELECT lessons_learned, COUNT(*) as count FROM case_knowledge WHERE lessons_learned IS NOT NULL AND lessons_learned != '' GROUP BY lessons_learned ORDER BY count DESC LIMIT 10`),
      ]);
      return {
        by_type: byType.rows,
        by_outcome: byOutcome.rows,
        duration_stats: avgDuration.rows[0] || {},
        top_lessons: topLessons.rows,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/knowledge — add knowledge entry
  fastify.post('/', { preHandler: [authorize('admin', 'supervisor', 'attorney')] }, async (request, reply) => {
    try {
      const { case_id, incident_type, injury_types, liability_factors, outcome, settlement_amount, duration_days, lessons_learned } = request.body;
      const { rows } = await pool.query(`
        INSERT INTO case_knowledge (case_id, incident_type, injury_types, liability_factors, outcome, settlement_amount, duration_days, lessons_learned, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
      `, [case_id, incident_type, injury_types, liability_factors, outcome, settlement_amount || null, duration_days || null, lessons_learned, request.user.id]);
      return reply.status(201).send(rows[0]);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/knowledge/similar/:caseId — find similar cases
  fastify.get('/similar/:caseId', async (request, reply) => {
    try {
      const { rows: caseRows } = await pool.query('SELECT * FROM cases WHERE id = $1', [request.params.caseId]);
      if (caseRows.length === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      const sourceCase = caseRows[0];

      // Check cache first
      const { rows: cached } = await pool.query(`
        SELECT csl.*, c.case_number, c.client_name, c.status, c.incident_type,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned, ck.injury_types
        FROM case_similarity_log csl
        JOIN cases c ON csl.similar_case_id = c.id
        LEFT JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE csl.source_case_id = $1
        ORDER BY csl.similarity_score DESC LIMIT 3
      `, [request.params.caseId]);
      if (cached.length > 0) return cached;

      // Find similar closed cases with knowledge entries
      const { rows: candidates } = await pool.query(`
        SELECT c.*, ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned,
          ck.injury_types AS kb_injuries, ck.liability_factors AS kb_factors, ck.incident_type AS kb_type
        FROM cases c
        JOIN case_knowledge ck ON ck.case_id = c.id
        WHERE c.id != $1 AND c.phase = 'closed'
        ORDER BY c.created_at DESC
      `, [request.params.caseId]);

      // Score similarity
      const scored = candidates.map(c => {
        let score = 0;
        const factors = [];
        if (sourceCase.incident_type && c.incident_type && sourceCase.incident_type.toLowerCase() === c.incident_type.toLowerCase()) {
          score += 40; factors.push('Same incident type');
        }
        if (sourceCase.incident_type && c.kb_type && sourceCase.incident_type.toLowerCase() === c.kb_type.toLowerCase()) {
          score += 10; factors.push('Matching knowledge type');
        }
        if (c.kb_injuries && sourceCase.notes) {
          const injuries = c.kb_injuries.toLowerCase().split(',').map(s => s.trim());
          const caseText = (sourceCase.notes || '').toLowerCase();
          for (const inj of injuries) {
            if (inj && caseText.includes(inj)) { score += 15; factors.push(`Injury match: ${inj}`); break; }
          }
        }
        if (c.kb_factors && sourceCase.notes) {
          const facs = c.kb_factors.toLowerCase().split(',').map(s => s.trim());
          const caseText = (sourceCase.notes || '').toLowerCase();
          for (const f of facs) {
            if (f && caseText.includes(f)) { score += 10; factors.push(`Factor match: ${f}`); break; }
          }
        }
        return { ...c, similarity_score: score, matched_factors: factors.join('; ') };
      }).filter(c => c.similarity_score > 0).sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 3);

      // Cache results
      for (const s of scored) {
        await pool.query(
          'INSERT INTO case_similarity_log (source_case_id, similar_case_id, similarity_score, matched_factors) VALUES ($1,$2,$3,$4)',
          [request.params.caseId, s.id, s.similarity_score, s.matched_factors]
        );
      }

      return scored.map(s => ({
        case_number: s.case_number, client_name: s.client_name, incident_type: s.incident_type,
        outcome: s.outcome, settlement_amount: s.settlement_amount, duration_days: s.duration_days,
        lessons_learned: s.lessons_learned, similarity_score: s.similarity_score, matched_factors: s.matched_factors,
      }));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // DELETE /api/knowledge/:id
  fastify.delete('/:id', { preHandler: [authorize('admin', 'supervisor')] }, async (request, reply) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM case_knowledge WHERE id = $1', [request.params.id]);
      if (rowCount === 0) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Knowledge entry not found' });
      return { message: 'Knowledge entry deleted' };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
