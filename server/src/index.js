import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import pool from './db.js';

// Auto-seed on first boot
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const { rows } = await pool.query('SELECT count(*) as count FROM users');
  if (Number(rows[0].count) === 0) {
    console.log('Empty database detected — running seed...');
    await import('./seed.js');
    console.log('Seed complete.');
  } else {
    console.log(`Database has ${rows[0].count} users — skipping seed.`);
  }
} catch {
  console.log('Users table not found — running schema and seed...');
  const schema = readFileSync(join(__dirname, '..', 'sql', 'schema.sql'), 'utf-8');
  const cleanSchema = schema.split('\n').filter(l => !l.startsWith('\\c') && !l.startsWith('DROP DATABASE') && !l.startsWith('CREATE DATABASE')).join('\n');
  await pool.query(cleanSchema);
  console.log('Schema created.');
  await import('./seed.js');
  console.log('Seed complete.');
}

import authRoutes from './routes/auth.js';
import casesRoutes from './routes/cases.js';
import deadlinesRoutes from './routes/deadlines.js';
import recordsRoutes from './routes/records.js';
import attorneyRequestsRoutes from './routes/attorney-requests.js';
import contactsRoutes from './routes/contacts.js';
import treatmentsRoutes from './routes/treatments.js';
import usersRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import exhibitsRoutes from './routes/exhibits.js';
import discoveryRoutes from './routes/discovery.js';
import questionnairesRoutes from './routes/questionnaires.js';
import objectionsRoutes from './routes/objections.js';
import discoveryLibraryRoutes from './routes/discovery-library.js';
import knowledgeRoutes from './routes/knowledge.js';
import attorneyNotesRoutes from './routes/attorney-notes.js';
import filevineRoutes from './routes/filevine.js';
import liensRoutes from './routes/liens.js';
import subpoenaRoutes from './routes/subpoenas.js';
import workQueueRoutes from './routes/work-queue.js';
import discoveryWorkspaceRoutes from './routes/discovery-workspace.js';
import firmBrainRoutes from './routes/firm-brain.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'first-chair-jwt-secret-2025',
  sign: { expiresIn: '8h' },
});

await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(casesRoutes, { prefix: '/api/cases' });
await fastify.register(deadlinesRoutes, { prefix: '/api/deadlines' });
await fastify.register(recordsRoutes, { prefix: '/api/records' });
await fastify.register(attorneyRequestsRoutes, { prefix: '/api/attorney-requests' });
await fastify.register(contactsRoutes, { prefix: '/api/contacts' });
await fastify.register(treatmentsRoutes, { prefix: '/api/treatments' });
await fastify.register(usersRoutes, { prefix: '/api/users' });
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
await fastify.register(exhibitsRoutes, { prefix: '/api/exhibits' });
await fastify.register(discoveryRoutes, { prefix: '/api/discovery' });
await fastify.register(questionnairesRoutes, { prefix: '/api/questionnaires' });
await fastify.register(objectionsRoutes, { prefix: '/api/objections' });
await fastify.register(discoveryLibraryRoutes, { prefix: '/api/discovery-library' });
await fastify.register(knowledgeRoutes, { prefix: '/api/knowledge' });
await fastify.register(attorneyNotesRoutes, { prefix: '/api/attorney-notes' });
await fastify.register(filevineRoutes, { prefix: '/api/filevine' });
await fastify.register(liensRoutes, { prefix: '/api/liens' });
await fastify.register(subpoenaRoutes, { prefix: '/api/subpoenas' });
await fastify.register(workQueueRoutes, { prefix: '/api/work-queue' });
await fastify.register(discoveryWorkspaceRoutes, { prefix: '/api/discovery-workspace' });
await fastify.register(firmBrainRoutes, { prefix: '/api/firm-brain' });

try {
  await fastify.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

