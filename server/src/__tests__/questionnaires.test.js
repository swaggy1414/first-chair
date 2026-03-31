import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Discovery Questionnaires', () => {
  afterAll(async () => { await pool.end(); });

  test('discovery_questionnaires table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'discovery_questionnaires' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('case_id');
    expect(cols).toContain('client_email');
    expect(cols).toContain('status');
    expect(cols).toContain('follow_up_sent_at');
  });

  test('objections table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'objections' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('title');
    expect(cols).toContain('objection_text');
    expect(cols).toContain('category');
    expect(cols).toContain('use_count');
    expect(cols).toContain('source');
  });

  test('cases table has phase column', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'phase'`);
    expect(rows.length).toBe(1);
  });

  test('phase values are valid', () => {
    const phases = ['active', 'written_discovery', 'deposition', 'mediation', 'trial', 'closed'];
    expect(phases).toHaveLength(6);
    expect(phases).toContain('written_discovery');
  });

  test('objection categories are valid', () => {
    const cats = ['General Objections', 'Interrogatory Objections', 'RFA Objections', 'RPD Objections', 'Privilege', 'Other'];
    expect(cats).toHaveLength(6);
  });
});
