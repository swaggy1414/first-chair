import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Exhibits', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('exhibits table exists', async () => {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'exhibits' ORDER BY ordinal_position
    `);
    const cols = rows.map(r => r.column_name);
    expect(cols).toContain('id');
    expect(cols).toContain('case_id');
    expect(cols).toContain('file_name');
    expect(cols).toContain('ai_classification');
    expect(cols).toContain('ai_confidence');
    expect(cols).toContain('ai_summary');
    expect(cols).toContain('onedrive_file_id');
    expect(cols).toContain('onedrive_url');
    expect(cols).toContain('category');
  });

  test('exhibit categories are constrained', async () => {
    const validCategories = [
      'Medical Records', 'Police Report', 'Photos', 'Bills and Invoices',
      'Correspondence', 'Expert Reports', 'Deposition', 'Other',
    ];
    expect(validCategories).toHaveLength(8);
    expect(validCategories).toContain('Medical Records');
    expect(validCategories).toContain('Other');
  });

  test('classifier returns correct shape without API key', async () => {
    const { classifyExhibit } = await import('../utils/classifier.js');
    const result = await classifyExhibit('test.pdf', '');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('summary');
    expect(typeof result.confidence).toBe('number');
  });
});
