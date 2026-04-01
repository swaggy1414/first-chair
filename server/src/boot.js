import pool from './db.js';

async function boot() {
  try {
    // Check if users table has any rows
    const { rows } = await pool.query('SELECT count(*) as count FROM users');
    if (Number(rows[0].count) === 0) {
      console.log('Empty database detected — running seed...');
      await import('./seed.js');
      console.log('Seed complete — starting server...');
    } else {
      console.log(`Database has ${rows[0].count} users — skipping seed.`);
    }
  } catch (err) {
    // Table might not exist yet — run schema first
    console.log('Users table not found — running schema and seed...');
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const schema = readFileSync(join(__dirname, '..', 'sql', 'schema.sql'), 'utf-8');
    // Remove \c commands that only work in psql
    const cleanSchema = schema.split('\n').filter(l => !l.startsWith('\\c') && !l.startsWith('DROP DATABASE') && !l.startsWith('CREATE DATABASE')).join('\n');
    await pool.query(cleanSchema);
    console.log('Schema created.');
    await import('./seed.js');
    console.log('Seed complete.');
  }

  // Start the server
  await import('./index.js');
}

boot().catch((err) => {
  console.error('Boot failed:', err);
  process.exit(1);
});
