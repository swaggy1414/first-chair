import Anthropic from '@anthropic-ai/sdk';
import pool from '../db.js';
import { authenticate } from '../middleware/auth.js';

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','shall','should','may','might','can','could',
  'about','what','which','who','whom','how','when','where','why',
  'all','any','both','each','our','my','your','their','its','this','that',
  'cases','case','tell','me','show','find','give','get','list','know',
]);

function extractKeywords(question) {
  const words = question
    .replace(/[%_]/g, '')
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  return words.length > 0 ? words : [question.replace(/[%_]/g, '').trim().toLowerCase()];
}

function buildKeywordWhere(keywords, columns, paramOffset) {
  const parts = [];
  const params = [];
  for (const kw of keywords) {
    const idx = paramOffset + params.length + 1;
    params.push(`%${kw}%`);
    const colOr = columns.map(c => `${c} ILIKE $${idx}`).join(' OR ');
    parts.push(`(${colOr})`);
  }
  return { clause: parts.join(' OR '), params };
}

export default async function firmIntelligenceRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/search', async (request, reply) => {
    try {
      const { question } = request.body;
      if (!question || question.trim().length < 3) {
        return reply.status(400).send({ error: 'Question must be at least 3 characters' });
      }

      const keywords = extractKeywords(question);

      // 1. Cases — broad match across all text fields
      const cWhere = buildKeywordWhere(keywords,
        ['c.client_name', 'c.case_number', 'c.incident_type', 'c.notes'], 0);
      const { rows: cases } = await pool.query(`
        SELECT c.id, c.case_number, c.client_name, c.incident_type, c.status, c.phase,
          c.incident_date, c.created_at, c.notes,
          p.name as paralegal_name, a.name as attorney_name,
          oc.name as opposing_counsel_name, oc.firm_name as oc_firm,
          j.name as judge_name, j.court as judge_court
        FROM cases c
        LEFT JOIN users p ON c.assigned_paralegal_id = p.id
        LEFT JOIN users a ON c.assigned_attorney_id = a.id
        LEFT JOIN opposing_counsel oc ON c.opposing_counsel_id = oc.id
        LEFT JOIN judges j ON c.judge_id = j.id
        WHERE ${cWhere.clause}
        ORDER BY c.created_at DESC LIMIT 25
      `, cWhere.params);

      // 2. Case knowledge — outcomes, settlements, lessons
      const ckWhere = buildKeywordWhere(keywords,
        ['ck.incident_type', 'ck.injury_types', 'ck.liability_factors',
         'ck.lessons_learned', 'ck.outcome', 'c.client_name', 'c.case_number'], 0);
      const { rows: knowledge } = await pool.query(`
        SELECT ck.case_id, ck.incident_type, ck.injury_types, ck.liability_factors,
          ck.outcome, ck.settlement_amount, ck.duration_days, ck.lessons_learned,
          c.case_number, c.client_name
        FROM case_knowledge ck
        LEFT JOIN cases c ON ck.case_id = c.id
        WHERE ${ckWhere.clause}
        ORDER BY ck.created_at DESC LIMIT 20
      `, ckWhere.params);

      // 3. Discovery gaps — patterns across matched cases
      const caseIds = cases.map(c => c.id);
      let discoveryGaps = [];
      if (caseIds.length > 0) {
        const placeholders = caseIds.map((_, i) => `$${i + 1}`).join(',');
        const { rows } = await pool.query(`
          SELECT dg.case_id, dg.gap_type, dg.request_type, dg.gap_description,
            dg.status, dg.gap_action, dg.priority,
            c.case_number, c.client_name
          FROM discovery_gaps dg
          JOIN cases c ON dg.case_id = c.id
          WHERE dg.case_id IN (${placeholders})
          ORDER BY dg.created_at DESC LIMIT 50
        `, caseIds);
        discoveryGaps = rows;
      }

      // 4. Opposing counsel
      const ocWhere = buildKeywordWhere(keywords,
        ['oc.name', 'oc.firm_name', 'oc.notes'], 0);
      const { rows: counsel } = await pool.query(`
        SELECT oc.id, oc.name, oc.firm_name, oc.email, oc.phone,
          oc.state_bar_number, oc.notes,
          (SELECT COUNT(*) FROM case_opposing_counsel coc WHERE coc.opposing_counsel_id = oc.id) as case_count,
          (SELECT string_agg(c2.case_number || ' (' || c2.client_name || ')', ', ' ORDER BY c2.created_at DESC)
           FROM case_opposing_counsel coc2 JOIN cases c2 ON coc2.case_id = c2.id
           WHERE coc2.opposing_counsel_id = oc.id) as linked_cases
        FROM opposing_counsel oc
        WHERE ${ocWhere.clause}
        ORDER BY oc.name LIMIT 10
      `, ocWhere.params);

      // 5. Judges
      const jWhere = buildKeywordWhere(keywords,
        ['j.name', 'j.court', 'j.notes', 'j.county'], 0);
      const { rows: judges } = await pool.query(`
        SELECT j.id, j.name, j.court, j.jurisdiction, j.county, j.state, j.notes,
          (SELECT COUNT(*) FROM case_judges cj WHERE cj.judge_id = j.id) as case_count,
          (SELECT string_agg(c2.case_number || ' (' || c2.client_name || ')', ', ' ORDER BY c2.created_at DESC)
           FROM case_judges cj2 JOIN cases c2 ON cj2.case_id = c2.id
           WHERE cj2.judge_id = j.id) as linked_cases
        FROM judges j
        WHERE ${jWhere.clause}
        ORDER BY j.name LIMIT 10
      `, jWhere.params);

      // 6. Attorney notes (non-private)
      const nWhere = buildKeywordWhere(keywords, ['an.note_text'], 0);
      const { rows: notes } = await pool.query(`
        SELECT an.case_id, an.note_text, an.note_type, an.created_at,
          c.case_number, c.client_name, u.name as attorney_name
        FROM attorney_notes an
        LEFT JOIN cases c ON an.case_id = c.id
        LEFT JOIN users u ON an.attorney_id = u.id
        WHERE ${nWhere.clause} AND an.is_private = false
        ORDER BY an.created_at DESC LIMIT 15
      `, nWhere.params);

      // 7. Firm documents
      const docWhere = buildKeywordWhere(keywords,
        ['title', 'ai_summary', 'ai_extracted_issues', 'ai_key_clauses', 'document_type'], 0);
      const { rows: documents } = await pool.query(`
        SELECT id, title, document_type, ai_summary, ai_extracted_issues, ai_key_clauses,
          file_name, created_at
        FROM firm_documents
        WHERE ${docWhere.clause}
        ORDER BY created_at DESC LIMIT 10
      `, docWhere.params);

      // ---- Build sources (deduplicated, with links) ----
      const allSources = [];
      for (const c of cases) allSources.push({
        type: 'Case', title: c.case_number,
        detail: `${c.client_name} — ${c.incident_type} — ${c.status}`,
        id: c.id, link: `/cases/${c.id}`,
      });
      for (const k of knowledge) allSources.push({
        type: 'Case Knowledge', title: k.case_number || 'Case',
        detail: `${k.incident_type} — ${k.outcome || 'pending'}${k.settlement_amount ? ' — $' + Number(k.settlement_amount).toLocaleString() : ''}`,
        id: k.case_id, link: k.case_id ? `/cases/${k.case_id}` : null,
      });
      for (const c of counsel) allSources.push({
        type: 'Opposing Counsel', title: c.name,
        detail: `${c.firm_name} — ${c.case_count} cases`,
        id: c.id, link: null,
      });
      for (const j of judges) allSources.push({
        type: 'Judge', title: j.name,
        detail: `${j.court} — ${j.case_count} cases`,
        id: j.id, link: null,
      });
      for (const n of notes) allSources.push({
        type: 'Attorney Note', title: n.case_number,
        detail: `${n.note_type} — ${n.attorney_name}`,
        id: n.case_id, link: n.case_id ? `/cases/${n.case_id}` : null,
      });
      for (const d of documents) allSources.push({
        type: 'Document', title: d.title,
        detail: d.document_type,
        id: d.id, link: '/firm-brain',
      });

      const seen = new Set();
      const sources = allSources.filter(s => {
        const key = `${s.type}:${s.id || s.title}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // ---- Build AI context ----
      const contextSections = [];

      if (cases.length > 0) {
        contextSections.push('CASES (' + cases.length + '):\n' + cases.map(c =>
          `- ${c.case_number}: ${c.client_name} | Type: ${c.incident_type} | Status: ${c.status}/${c.phase} | Incident: ${c.incident_date ? new Date(c.incident_date).toLocaleDateString() : 'N/A'} | Attorney: ${c.attorney_name || 'Unassigned'} | Paralegal: ${c.paralegal_name || 'Unassigned'} | OC: ${c.opposing_counsel_name ? c.opposing_counsel_name + ' (' + c.oc_firm + ')' : 'None'} | Judge: ${c.judge_name ? c.judge_name + ' (' + c.judge_court + ')' : 'None'} | Notes: ${c.notes || 'None'}`
        ).join('\n'));
      }

      if (knowledge.length > 0) {
        contextSections.push('CASE OUTCOMES & KNOWLEDGE (' + knowledge.length + '):\n' + knowledge.map(k =>
          `- ${k.case_number} (${k.incident_type}): Outcome: ${k.outcome || 'pending'} | Settlement: ${k.settlement_amount ? '$' + Number(k.settlement_amount).toLocaleString() : 'N/A'} | Duration: ${k.duration_days || 'N/A'} days | Injuries: ${k.injury_types || 'N/A'} | Liability: ${k.liability_factors || 'N/A'} | Lessons: ${k.lessons_learned || 'N/A'}`
        ).join('\n'));
      }

      if (discoveryGaps.length > 0) {
        const gapSummary = {};
        for (const g of discoveryGaps) {
          const key = g.gap_type;
          gapSummary[key] = (gapSummary[key] || 0) + 1;
        }
        contextSections.push('DISCOVERY GAP PATTERNS (' + discoveryGaps.length + ' gaps across matched cases):\n' +
          'Gap type breakdown: ' + Object.entries(gapSummary).map(([t, n]) => `${t}: ${n}`).join(', ') + '\n' +
          discoveryGaps.slice(0, 20).map(g =>
            `- ${g.case_number}: ${g.gap_type} (${g.request_type}) — ${g.gap_description || 'No description'} [${g.status}, action: ${g.gap_action || 'none'}]`
          ).join('\n'));
      }

      if (counsel.length > 0) {
        contextSections.push('OPPOSING COUNSEL (' + counsel.length + '):\n' + counsel.map(c =>
          `- ${c.name} | Firm: ${c.firm_name} | Bar: ${c.state_bar_number || 'N/A'} | Cases: ${c.case_count} (${c.linked_cases || 'none'}) | Notes: ${c.notes || 'None'}`
        ).join('\n'));
      }

      if (judges.length > 0) {
        contextSections.push('JUDGES (' + judges.length + '):\n' + judges.map(j =>
          `- ${j.name} | Court: ${j.court} | County: ${j.county}, ${j.state} | Cases: ${j.case_count} (${j.linked_cases || 'none'}) | Notes: ${j.notes || 'None'}`
        ).join('\n'));
      }

      if (notes.length > 0) {
        contextSections.push('ATTORNEY NOTES (' + notes.length + '):\n' + notes.map(n =>
          `- ${n.case_number} [${n.note_type}] by ${n.attorney_name}: ${n.note_text}`
        ).join('\n'));
      }

      if (documents.length > 0) {
        contextSections.push('FIRM DOCUMENTS (' + documents.length + '):\n' + documents.map(d =>
          `- "${d.title}" (${d.document_type}): ${d.ai_summary || 'No summary'} | Issues: ${d.ai_extracted_issues || 'None'} | Key Clauses: ${d.ai_key_clauses || 'None'}`
        ).join('\n'));
      }

      const context = contextSections.join('\n\n');
      const totalResults = cases.length + knowledge.length + counsel.length +
        judges.length + notes.length + documents.length;

      // ---- AI synthesis ----
      let answer = null;
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (apiKey && totalResults > 0) {
        try {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: `You are the institutional intelligence system for a personal injury law firm. The user asked: "${question}".

Analyze all firm data provided and give a comprehensive answer including:
- How many relevant cases exist and their status
- Settlement patterns — average, range, high, low, what drove differences
- Common injuries, venues, opposing counsel, judges in these cases
- Discovery patterns — gaps that appeared most, what opposing counsel did
- What worked and what did not based on outcomes
- Key lessons the firm has learned
- Specific recommendations for new cases of this type

Be specific. Use actual numbers. Cite specific cases where relevant. Surface everything useful. Write like a senior partner who has worked every case.

If the data is thin on some dimensions (e.g., no settlement data), say so rather than speculating. Only use the data provided — do not invent facts.`,
            messages: [{
              role: 'user',
              content: context,
            }],
          });
          answer = message.content[0].text.trim();
        } catch (err) {
          request.log.error('AI synthesis failed:', err.message);
        }
      }

      // Fallback when no API key
      if (!answer) {
        if (totalResults === 0) {
          answer = `No results found for "${question}". Try different keywords.`;
        } else {
          const parts = [];
          parts.push(`Found ${totalResults} result(s) matching "${question}". Set ANTHROPIC_API_KEY for full AI synthesis.\n`);

          if (cases.length > 0) {
            parts.push(`**Cases (${cases.length}):** ${cases.map(c => `${c.case_number} — ${c.client_name} (${c.incident_type}, ${c.status})`).join('; ')}`);
          }
          if (knowledge.length > 0) {
            const settlements = knowledge.filter(k => k.settlement_amount).map(k => Number(k.settlement_amount));
            if (settlements.length > 0) {
              const avg = Math.round(settlements.reduce((a, b) => a + b, 0) / settlements.length);
              parts.push(`**Settlement data:** ${settlements.length} resolved — avg $${avg.toLocaleString()}, range $${Math.min(...settlements).toLocaleString()}–$${Math.max(...settlements).toLocaleString()}`);
            }
            const lessons = knowledge.filter(k => k.lessons_learned).map(k => `${k.case_number}: ${k.lessons_learned}`);
            if (lessons.length > 0) {
              parts.push(`**Lessons learned:**\n${lessons.map(l => `• ${l}`).join('\n')}`);
            }
          }
          if (discoveryGaps.length > 0) {
            const gapSummary = {};
            for (const g of discoveryGaps) gapSummary[g.gap_type] = (gapSummary[g.gap_type] || 0) + 1;
            parts.push(`**Discovery patterns:** ${discoveryGaps.length} gaps — ${Object.entries(gapSummary).map(([t, n]) => `${t}: ${n}`).join(', ')}`);
          }
          if (counsel.length > 0) {
            parts.push(`**Opposing counsel:** ${counsel.map(c => `${c.name} (${c.firm_name}, ${c.case_count} cases)`).join('; ')}`);
          }
          if (judges.length > 0) {
            parts.push(`**Judges:** ${judges.map(j => `${j.name} (${j.court}, ${j.case_count} cases)`).join('; ')}`);
          }
          if (documents.length > 0) {
            parts.push(`**Documents:** ${documents.map(d => `"${d.title}" (${d.document_type})`).join('; ')}`);
          }
          answer = parts.join('\n\n');
        }
      }

      return {
        answer,
        sources,
        result_count: totalResults,
        breakdown: {
          cases: cases.length,
          case_knowledge: knowledge.length,
          discovery_gaps: discoveryGaps.length,
          opposing_counsel: counsel.length,
          judges: judges.length,
          attorney_notes: notes.length,
          documents: documents.length,
        },
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
}
