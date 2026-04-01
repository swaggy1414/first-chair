import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Lien and Damages Intelligence', () => {
  afterAll(async () => { await pool.end(); });

  test('medical_records_analysis table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'medical_records_analysis' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('case_id');
    expect(cols).toContain('analysis_status');
    expect(cols).toContain('source');
    expect(cols).toContain('related_treatment_count');
  });

  test('treatment_line_items table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'treatment_line_items' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('is_related');
    expect(cols).toContain('ai_confidence');
    expect(cols).toContain('paralegal_override');
  });

  test('liens table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'liens' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('health_plan_name');
    expect(cols).toContain('plan_type');
    expect(cols).toContain('lien_status');
    expect(cols).toContain('lien_amount');
    expect(cols).toContain('negotiated_amount');
  });

  test('damages_chart table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'damages_chart' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('total_medical_bills');
    expect(cols).toContain('related_medical_bills');
    expect(cols).toContain('lien_total');
  });

  test('subrogation_directory table exists', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'subrogation_directory' ORDER BY ordinal_position`);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('health_plan_name');
    expect(cols).toContain('subrogation_company');
    expect(cols).toContain('contact_email');
  });

  test('cases table has filevine_project_id', async () => {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'filevine_project_id'`);
    expect(rows.length).toBe(1);
  });
});
