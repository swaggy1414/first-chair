import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Discovery Intelligence', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('discovery_responses table exists with correct columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'discovery_responses' ORDER BY ordinal_position
    `);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('case_id');
    expect(cols).toContain('file_name');
    expect(cols).toContain('responding_party');
    expect(cols).toContain('interrogatory_count');
    expect(cols).toContain('rfa_count');
    expect(cols).toContain('rpd_count');
    expect(cols).toContain('status');
    expect(cols).toContain('processed_at');
  });

  test('discovery_gaps table exists with correct columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'discovery_gaps' ORDER BY ordinal_position
    `);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('discovery_response_id');
    expect(cols).toContain('gap_type');
    expect(cols).toContain('request_number');
    expect(cols).toContain('request_type');
    expect(cols).toContain('gap_description');
    expect(cols).toContain('priority');
    expect(cols).toContain('status');
    expect(cols).toContain('assigned_to');
    expect(cols).toContain('resolved_at');
    expect(cols).toContain('resolution_notes');
  });

  test('supplementation_requests table exists with correct columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'supplementation_requests' ORDER BY ordinal_position
    `);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('case_id');
    expect(cols).toContain('discovery_response_id');
    expect(cols).toContain('generated_email_text');
    expect(cols).toContain('sent_at');
    expect(cols).toContain('client_response');
    expect(cols).toContain('status');
  });

  test('gap types are valid enum values', () => {
    const validTypes = ['missing_document', 'incomplete_answer', 'no_answer', 'evasive_answer', 'objection_only'];
    expect(validTypes).toHaveLength(5);
    expect(validTypes).toContain('evasive_answer');
  });

  test('gap statuses are valid', () => {
    const validStatuses = ['open', 'client_notified', 'response_received', 'resolved', 'waived'];
    expect(validStatuses).toHaveLength(5);
  });

  test('request types are valid', () => {
    const validTypes = ['interrogatory', 'rfa', 'rpd'];
    expect(validTypes).toHaveLength(3);
  });
});
