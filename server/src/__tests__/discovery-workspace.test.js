import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Discovery Workspace & Firm Brain', () => {
  afterAll(async () => { await pool.end(); });

  test('can query discovery workspace cases', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM cases WHERE status NOT IN ('closed','settled')`);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  test('opposing_counsel table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'opposing_counsel'`);
    expect(rows.map(r => r.column_name)).toContain('name');
    expect(rows.map(r => r.column_name)).toContain('firm_name');
  });

  test('judges table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'judges'`);
    expect(rows.map(r => r.column_name)).toContain('name');
    expect(rows.map(r => r.column_name)).toContain('court');
  });

  test('firm_documents table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'firm_documents'`);
    expect(rows.map(r => r.column_name)).toContain('title');
    expect(rows.map(r => r.column_name)).toContain('ai_summary');
  });

  test('cases has opposing_counsel_id and judge_id', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cases' AND column_name IN ('opposing_counsel_id','judge_id')`);
    expect(rows.length).toBe(2);
  });
});
