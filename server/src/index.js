import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';

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

try {
  await fastify.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
