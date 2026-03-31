import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Intelligence Layer', () => {
  afterAll(async () => { await pool.end(); });

  test('case_knowledge table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'case_knowledge' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('case_id');
    expect(cols).toContain('incident_type');
    expect(cols).toContain('settlement_amount');
    expect(cols).toContain('lessons_learned');
  });

  test('attorney_notes table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'attorney_notes' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('case_id');
    expect(cols).toContain('attorney_id');
    expect(cols).toContain('note_text');
    expect(cols).toContain('note_type');
    expect(cols).toContain('is_private');
  });

  test('case_similarity_log table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'case_similarity_log' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('source_case_id');
    expect(cols).toContain('similar_case_id');
    expect(cols).toContain('similarity_score');
  });

  test('note types are valid', () => {
    expect(['strategy','risk','settlement','general']).toHaveLength(4);
  });
});
