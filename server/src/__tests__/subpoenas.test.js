import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Subpoena Intelligence', () => {
  afterAll(async () => { await pool.end(); });

  test('subpoenas table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'subpoenas' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('case_id');
    expect(cols).toContain('subpoena_type');
    expect(cols).toContain('recipient_name');
    expect(cols).toContain('state_of_service');
    expect(cols).toContain('is_foreign_subpoena');
    expect(cols).toContain('status');
    expect(cols).toContain('discovery_gap_id');
  });

  test('subpoena_compliance table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'subpoena_compliance' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('subpoena_id');
    expect(cols).toContain('court_filing_required');
    expect(cols).toContain('commission_required');
    expect(cols).toContain('notice_period_days');
  });

  test('registered_agent_cache table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'registered_agent_cache' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('entity_name');
    expect(cols).toContain('state');
    expect(cols).toContain('source');
    expect(cols).toContain('lookup_date');
  });

  test('subpoena statuses are valid', () => {
    const statuses = ['draft','issued','served','responded','deficient','complied','quashed'];
    expect(statuses).toHaveLength(7);
  });
});
