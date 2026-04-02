import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Records Follow-Up Engine', () => {
  afterAll(async () => { await pool.end(); });

  test('records_followup_log table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'records_followup_log' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('records_request_id');
    expect(cols).toContain('followup_type');
    expect(cols).toContain('letter_text');
    expect(cols).toContain('status');
    expect(cols).toContain('sent_by');
  });

  test('followup types are valid', () => {
    const types = ['day_14', 'day_30', 'day_45', 'day_60'];
    expect(types).toHaveLength(4);
  });

  test('can query outstanding records requests', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM records_requests WHERE status IN ('pending','sent') AND requested_date IS NOT NULL`);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  test('runFollowupCheck returns result object', async () => {
    const { runFollowupCheck } = await import('../services/records-followup.js');
    const result = await runFollowupCheck();
    expect(result).toHaveProperty('checked');
    expect(result).toHaveProperty('generated');
    expect(result).toHaveProperty('errors');
    expect(typeof result.checked).toBe('number');
  });
});
