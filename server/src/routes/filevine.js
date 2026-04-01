import pool from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

function getFilevineConfig() {
  const apiKey = process.env.FILEVINE_API_KEY;
  const orgId = process.env.FILEVINE_ORG_ID;
  const baseUrl = process.env.FILEVINE_BASE_URL;
  if (!apiKey || !orgId || !baseUrl) return null;
  return { apiKey, orgId, baseUrl };
}

async function filevineRequest(config, path) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      'x-fv-sessionid': config.apiKey,
      'x-fv-orgid': config.orgId,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Filevine API error ${res.status}: ${text}`);
  }
  return res.json();
}

export default async function filevineRoutes(fastify, _opts) {
  fastify.addHook('preHandler', authenticate);

  const notConfiguredError = {
    error: 'Filevine not configured',
    message: 'Set FILEVINE_API_KEY, FILEVINE_ORG_ID, and FILEVINE_BASE_URL environment variables',
  };

  // GET /api/filevine/status
  fastify.get('/status', async (request, reply) => {
    try {
      const config = getFilevineConfig();
      return {
        configured: !!config,
        orgId: config ? config.orgId : null,
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/filevine/projects
  fastify.get('/projects', async (request, reply) => {
    try {
      const config = getFilevineConfig();
      if (!config) {
        return reply.status(400).send(notConfiguredError);
      }
      const data = await filevineRequest(config, '/core/projects');
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/filevine/projects/:projectId/documents
  fastify.get('/projects/:projectId/documents', async (request, reply) => {
    try {
      const config = getFilevineConfig();
      if (!config) {
        return reply.status(400).send(notConfiguredError);
      }
      const { projectId } = request.params;
      const data = await filevineRequest(config, `/core/projects/${projectId}/documents`);
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // GET /api/filevine/projects/:projectId/documents/:docId
  fastify.get('/projects/:projectId/documents/:docId', async (request, reply) => {
    try {
      const config = getFilevineConfig();
      if (!config) {
        return reply.status(400).send(notConfiguredError);
      }
      const { projectId, docId } = request.params;
      const data = await filevineRequest(config, `/core/projects/${projectId}/documents/${docId}`);
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });

  // POST /api/filevine/sync/:caseId
  fastify.post('/sync/:caseId', { preHandler: [authorize('admin', 'supervisor', 'paralegal')] }, async (request, reply) => {
    try {
      const config = getFilevineConfig();
      if (!config) {
        return reply.status(400).send(notConfiguredError);
      }

      const { caseId } = request.params;
      const { rows: caseRows } = await pool.query('SELECT id, filevine_project_id FROM cases WHERE id = $1', [caseId]);
      if (caseRows.length === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Case not found' });
      }

      const caseRecord = caseRows[0];
      if (!caseRecord.filevine_project_id) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Case does not have a filevine_project_id' });
      }

      const docs = await filevineRequest(config, `/core/projects/${caseRecord.filevine_project_id}/documents`);
      const docList = docs.items || docs || [];

      let syncCount = 0;
      for (const doc of docList) {
        await pool.query(`
          INSERT INTO medical_records_analysis (case_id, uploaded_by, file_name, file_size, source, analysis_status)
          VALUES ($1, $2, $3, $4, 'filevine', 'pending')
        `, [caseId, request.user.id, doc.name || doc.fileName || 'filevine-doc', doc.size || 0]);
        syncCount++;
      }

      return { synced: syncCount };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: err.message });
    }
  });
}
