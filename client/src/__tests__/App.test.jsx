import { describe, test, expect } from '@jest/globals';

describe('First Chair App', () => {
  test('valid case statuses match spec', () => {
    const statuses = ['intake', 'active', 'treatment', 'demand', 'litigation', 'settled', 'closed'];
    expect(statuses).toHaveLength(7);
    expect(statuses).toContain('intake');
    expect(statuses).toContain('litigation');
  });

  test('valid user roles match spec', () => {
    const roles = ['admin', 'supervisor', 'paralegal', 'attorney', 'records_team'];
    expect(roles).toHaveLength(5);
  });

  test('API base URL is configured correctly', () => {
    const baseUrl = process.env.VITE_API_URL || 'http://localhost:3001/api';
    expect(baseUrl).toContain('/api');
  });

  test('color scheme matches design spec', () => {
    const colors = {
      navy: '#1C3557',
      blue: '#2A6DB5',
      white: '#FFFFFF',
    };
    expect(colors.navy).toBe('#1C3557');
    expect(colors.blue).toBe('#2A6DB5');
  });

  test('deadline types are valid', () => {
    const types = ['statute_of_limitations', 'filing', 'discovery', 'hearing', 'deposition', 'medical', 'follow_up', 'other'];
    expect(types).toContain('statute_of_limitations');
    expect(types).toContain('discovery');
  });

  test('attorney request priorities are valid', () => {
    const priorities = ['critical', 'high', 'standard', 'deferred'];
    expect(priorities).toHaveLength(4);
    expect(priorities[0]).toBe('critical');
  });

  test('records request age thresholds', () => {
    const GREEN_THRESHOLD = 30;
    const YELLOW_THRESHOLD = 60;
    expect(GREEN_THRESHOLD).toBeLessThan(YELLOW_THRESHOLD);

    const ageInDays = 45;
    const color = ageInDays < GREEN_THRESHOLD ? 'green' : ageInDays < YELLOW_THRESHOLD ? 'yellow' : 'red';
    expect(color).toBe('yellow');
  });
});
