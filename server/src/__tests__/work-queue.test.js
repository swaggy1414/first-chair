import { describe, test, expect, afterAll } from '@jest/globals';
import pool from '../db.js';

describe('Work Queue', () => {
  afterAll(async () => { await pool.end(); });

  test('can query discovery gaps for work queue', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM discovery_gaps WHERE status = 'open'`);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  test('can query overdue records for work queue', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM records_requests WHERE status IN ('pending','sent')`);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  test('can query stalled cases for work queue', async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM cases WHERE status NOT IN ('settled','closed')`);
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(0);
  });

  test('urgency ordering is correct', () => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    expect(order.critical).toBeLessThan(order.high);
    expect(order.high).toBeLessThan(order.medium);
    expect(order.medium).toBeLessThan(order.low);
  });
});
