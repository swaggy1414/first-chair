import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import pool from '../db.js';

const CASE_NUMBER_PATTERN = /FC-\d{4}-\d{3}/gi;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'discovery');
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_POLL_INTERVAL_MS || '60000', 10);

function getConfig() {
  const host = process.env.EMAIL_INTAKE_HOST;
  const user = process.env.EMAIL_INTAKE_USER;
  const password = process.env.EMAIL_INTAKE_PASSWORD;
  if (!host || !user || !password) return null;
  return {
    host,
    port: parseInt(process.env.EMAIL_INTAKE_PORT || '993', 10),
    secure: process.env.EMAIL_INTAKE_SECURE !== 'false',
    auth: { user, pass: password },
    logger: false,
  };
}

// Extract case number from subject or body
function extractCaseNumber(subject, body) {
  const text = `${subject || ''} ${body || ''}`;
  const matches = text.match(CASE_NUMBER_PATTERN);
  return matches ? matches[0].toUpperCase() : null;
}

// Find case by case number
async function findCase(caseNumber) {
  if (!caseNumber) return null;
  const { rows } = await pool.query(
    'SELECT id, case_number, client_name FROM cases WHERE UPPER(case_number) = $1',
    [caseNumber]
  );
  return rows[0] || null;
}

// Process a single email message
async function processMessage(message, parsedBody) {
  const subject = message.envelope?.subject || '';
  const from = message.envelope?.from?.[0]?.address || 'unknown';
  const bodyText = typeof parsedBody === 'string' ? parsedBody : parsedBody?.text || '';

  const caseNumber = extractCaseNumber(subject, bodyText);
  const caseRecord = await findCase(caseNumber);

  // Find PDF attachments
  const attachments = [];
  if (parsedBody?.attachments) {
    for (const att of parsedBody.attachments) {
      if (att.contentType === 'application/pdf' ||
          (att.filename && att.filename.toLowerCase().endsWith('.pdf'))) {
        attachments.push(att);
      }
    }
  }

  if (attachments.length === 0) {
    console.log(`[email-intake] Skipping email from ${from} — no PDF attachments`);
    return { skipped: true, reason: 'no_pdf' };
  }

  if (!caseRecord) {
    // Flag as unmatched — insert a work queue note
    console.log(`[email-intake] Unmatched email from ${from}, subject: "${subject}"`);

    // Create a record in attorney_requests as an unmatched email flag
    await pool.query(`
      INSERT INTO attorney_requests (case_id, requested_by, priority, title, description, status, due_date)
      VALUES (
        (SELECT id FROM cases ORDER BY created_at DESC LIMIT 1),
        (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
        'standard',
        $1,
        $2,
        'open',
        CURRENT_DATE + INTERVAL '3 days'
      )
    `, [
      'Unmatched discovery email — needs case assignment',
      `Email from ${from} with subject "${subject}" contains ${attachments.length} PDF attachment(s) but no case number (FC-YYYY-NNN) was found. Please review and assign to the correct case.`,
    ]);

    return { matched: false, from, subject, attachments: attachments.length };
  }

  // Case matched — upload each PDF attachment as a defendant discovery response
  const results = [];
  await mkdir(UPLOAD_DIR, { recursive: true });

  for (const att of attachments) {
    const ext = '.pdf';
    const storedName = `${randomUUID()}${ext}`;
    const filePath = join(UPLOAD_DIR, storedName);
    await writeFile(filePath, att.content);

    const fileName = att.filename || `email-attachment-${storedName}`;

    // Get a system user for uploaded_by
    const { rows: adminRows } = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );
    const uploadedBy = adminRows[0]?.id;

    const { rows } = await pool.query(`
      INSERT INTO discovery_responses (case_id, uploaded_by, file_name, file_size, file_path, response_party, status)
      VALUES ($1, $2, $3, $4, $5, 'defendant', 'processing')
      RETURNING *
    `, [caseRecord.id, uploadedBy, fileName, att.size || att.content.length, filePath]);

    results.push({
      response_id: rows[0].id,
      file_name: fileName,
      case_number: caseRecord.case_number,
      client_name: caseRecord.client_name,
    });

    console.log(`[email-intake] Uploaded ${fileName} to case ${caseRecord.case_number}`);
  }

  return { matched: true, case_number: caseRecord.case_number, uploads: results };
}

// Main polling loop
let running = false;
let pollTimer = null;

export async function startEmailIntake() {
  const config = getConfig();
  if (!config) {
    console.log('[email-intake] EMAIL_INTAKE_HOST/USER/PASSWORD not set — email intake disabled');
    return;
  }

  // Dynamic import so the service is silent when packages aren't available
  let ImapFlow, simpleParser;
  try {
    const imapMod = await import('imapflow');
    ImapFlow = imapMod.ImapFlow;
    const parserMod = await import('mailparser');
    simpleParser = parserMod.simpleParser;
  } catch {
    console.log('[email-intake] imapflow/mailparser not installed — email intake disabled');
    return;
  }

  running = true;
  console.log(`[email-intake] Starting email intake monitor for ${config.auth.user}@${config.host}`);

  async function poll() {
    if (!running) return;

    const client = new ImapFlow(config);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Fetch unseen messages
        const messages = [];
        for await (const msg of client.fetch({ seen: false }, {
          envelope: true,
          source: true,
        })) {
          messages.push(msg);
        }

        for (const msg of messages) {
          try {
            const parsed = await simpleParser(msg.source);
            await processMessage(msg, parsed);
            // Mark as seen
            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
          } catch (err) {
            console.error(`[email-intake] Error processing message: ${err.message}`);
          }
        }

        if (messages.length > 0) {
          console.log(`[email-intake] Processed ${messages.length} new email(s)`);
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      console.error(`[email-intake] IMAP error: ${err.message}`);
    }

    if (running) {
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }

  poll();
}

export function stopEmailIntake() {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log('[email-intake] Email intake stopped');
}

// Exported for testing — process a simulated email
export { processMessage, extractCaseNumber, findCase };
