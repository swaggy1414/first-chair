import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Database Connection', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('connects to first_chair database', async () => {
    const { rows } = await pool.query('SELECT current_database() as db');
    expect(rows[0].db).toBe('first_chair');
  });

  test('users table exists and has seed data', async () => {
    const { rows } = await pool.query('SELECT count(*) as count FROM users');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(5);
  });

  test('cases table has seed data', async () => {
    const { rows } = await pool.query('SELECT count(*) as count FROM cases');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(5);
  });

  test('deadlines table has seed data', async () => {
    const { rows } = await pool.query('SELECT count(*) as count FROM deadlines');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(10);
  });

  test('records_requests table has seed data', async () => {
    const { rows } = await pool.query('SELECT count(*) as count FROM records_requests');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(8);
  });

  test('attorney_requests table has seed data', async () => {
    const { rows } = await pool.query('SELECT count(*) as count FROM attorney_requests');
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(5);
  });

  test('all user roles are valid', async () => {
    const { rows } = await pool.query('SELECT DISTINCT role FROM users');
    const validRoles = ['admin', 'supervisor', 'paralegal', 'attorney', 'records_team'];
    rows.forEach(row => {
      expect(validRoles).toContain(row.role);
    });
  });

  test('case statuses are valid', async () => {
    const { rows } = await pool.query('SELECT DISTINCT status FROM cases');
    const validStatuses = ['intake', 'active', 'treatment', 'demand', 'litigation', 'settled', 'closed'];
    rows.forEach(row => {
      expect(validStatuses).toContain(row.status);
    });
  });

  test('seed users have force_password_change column', async () => {
    const { rows } = await pool.query('SELECT force_password_change FROM users WHERE email LIKE $1', ['%@firstchair.law']);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    rows.forEach(row => {
      expect(typeof row.force_password_change).toBe('boolean');
    });
  });
});
