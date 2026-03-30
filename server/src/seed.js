import bcrypt from 'bcrypt';
import pool from './db.js';

const PASSWORD = 'FirstChair2025!';
const SALT_ROUNDS = 10;

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- Users ---
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, force_password_change) VALUES
        ('a1000000-0000-0000-0000-000000000001', 'System Admin',      'admin@firstchair.law',      $1, 'admin',        true),
        ('a2000000-0000-0000-0000-000000000002', 'Maria Santos',      'paralegal@firstchair.law',  $1, 'paralegal',    true),
        ('a3000000-0000-0000-0000-000000000003', 'David Chen',        'supervisor@firstchair.law', $1, 'supervisor',   true),
        ('a4000000-0000-0000-0000-000000000004', 'James Richardson',  'attorney@firstchair.law',   $1, 'attorney',     true),
        ('a5000000-0000-0000-0000-000000000005', 'Lisa Park',         'records@firstchair.law',    $1, 'records_team', true)
      ON CONFLICT DO NOTHING
    `, [hash]);
    console.log('Users seeded');

    // --- Cases ---
    await client.query(`
      INSERT INTO cases (id, case_number, client_name, client_phone, client_email, incident_date, incident_type, status, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'FC-2025-001', 'Angela Morales',    '(919) 555-0147', 'amorales@email.com',     '2025-01-15', 'Motor Vehicle Accident', 'active',     'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', 'red',    'SOL approaching — 6 months',        'Rear-end collision on I-40. Client treated at WakeMed ER. Ongoing chiropractic care.'),
        ('c2000000-0000-0000-0000-000000000002', 'FC-2025-002', 'Robert Washington', '(252) 555-0289', 'rwashington@email.com',  '2025-02-28', 'Slip and Fall',          'treatment',  'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', 'yellow', 'Waiting on MRI results',            'Slip and fall at grocery store. Fractured wrist and knee contusion.'),
        ('c3000000-0000-0000-0000-000000000003', 'FC-2025-003', 'Diane Fletcher',    '(919) 555-0312', 'dfletcher@email.com',    '2024-11-10', 'Motor Vehicle Accident', 'demand',     NULL,                                   'a4000000-0000-0000-0000-000000000004', NULL,     NULL,                                'T-bone collision at intersection. Defendant ran red light. Police report obtained. Demand package being prepared.'),
        ('c4000000-0000-0000-0000-000000000004', 'FC-2025-004', 'Marcus Jenkins',    '(336) 555-0456', 'mjenkins@email.com',     '2025-03-10', 'Workplace Injury',       'intake',     'a2000000-0000-0000-0000-000000000002', NULL,                                   'green',  'New intake — needs assignment',     'Construction site fall from scaffolding. Workers comp may also apply. Back and shoulder injuries.'),
        ('c5000000-0000-0000-0000-000000000005', 'FC-2025-005', 'Theresa Nguyen',    '(704) 555-0523', 'tnguyen@email.com',      '2024-09-05', 'Medical Malpractice',    'litigation', 'a2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', 'red',    'Discovery deadline approaching',    'Surgical error during routine procedure. Expert witness retained. Complaint filed.')
      ON CONFLICT DO NOTHING
    `);
    console.log('Cases seeded');

    // --- Deadlines ---
    await client.query(`
      INSERT INTO deadlines (case_id, title, due_date, type, status, assigned_to, notes) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'Statute of Limitations',     '2028-01-15',                          'statute_of_limitations', 'pending', 'a4000000-0000-0000-0000-000000000004', '3-year SOL for MVA in NC'),
        ('c1000000-0000-0000-0000-000000000001', 'Follow up with chiropractor', CURRENT_DATE + INTERVAL '2 days',     'follow_up',              'pending', 'a2000000-0000-0000-0000-000000000002', 'Get updated treatment notes'),
        ('c2000000-0000-0000-0000-000000000002', 'MRI scheduled',              CURRENT_DATE + INTERVAL '5 days',      'medical',                'pending', 'a2000000-0000-0000-0000-000000000002', 'Duke Radiology at 2pm'),
        ('c2000000-0000-0000-0000-000000000002', 'Statute of Limitations',     '2028-02-28',                          'statute_of_limitations', 'pending', 'a4000000-0000-0000-0000-000000000004', '3-year SOL'),
        ('c3000000-0000-0000-0000-000000000003', 'Send demand letter',         CURRENT_DATE,                          'filing',                 'pending', 'a4000000-0000-0000-0000-000000000004', 'Demand package complete — ready to send'),
        ('c3000000-0000-0000-0000-000000000003', 'Statute of Limitations',     '2027-11-10',                          'statute_of_limitations', 'pending', 'a4000000-0000-0000-0000-000000000004', NULL),
        ('c4000000-0000-0000-0000-000000000004', 'Initial client meeting',     CURRENT_DATE + INTERVAL '1 day',       'follow_up',              'pending', 'a2000000-0000-0000-0000-000000000002', 'Gather all incident details'),
        ('c5000000-0000-0000-0000-000000000005', 'Discovery responses due',    CURRENT_DATE + INTERVAL '10 days',     'discovery',              'pending', 'a4000000-0000-0000-0000-000000000004', 'Interrogatories and RFPs'),
        ('c5000000-0000-0000-0000-000000000005', 'Expert deposition',          CURRENT_DATE + INTERVAL '30 days',     'deposition',             'pending', 'a4000000-0000-0000-0000-000000000004', 'Dr. Williams — surgical expert'),
        ('c5000000-0000-0000-0000-000000000005', 'Statute of Limitations',     '2027-09-05',                          'statute_of_limitations', 'pending', 'a4000000-0000-0000-0000-000000000004', 'Already filed — tracking for reference')
      ON CONFLICT DO NOTHING
    `);
    console.log('Deadlines seeded');

    // --- Records Requests ---
    await client.query(`
      INSERT INTO records_requests (case_id, provider_name, request_type, requested_date, received_date, status, notes) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'WakeMed Emergency Department', 'Emergency Records', '2025-02-01',                          '2025-02-20', 'received',  'Complete ER records received'),
        ('c1000000-0000-0000-0000-000000000001', 'Triangle Chiropractic',        'Treatment Records', '2025-02-15',                          NULL,         'sent',      'Requested ongoing treatment notes'),
        ('c1000000-0000-0000-0000-000000000001', 'Blue Cross Blue Shield',       'Billing Records',   CURRENT_DATE - INTERVAL '45 days',     NULL,         'follow_up', 'No response after 45 days — need follow up'),
        ('c2000000-0000-0000-0000-000000000002', 'Harris Teeter Incident Report','Incident Report',   '2025-03-05',                          '2025-03-10', 'received',  'Store manager provided copy'),
        ('c2000000-0000-0000-0000-000000000002', 'Duke Orthopedics',             'Medical Records',   '2025-03-15',                          NULL,         'sent',      'Awaiting MRI and ortho eval records'),
        ('c3000000-0000-0000-0000-000000000003', 'Raleigh PD',                   'Police Report',     '2024-12-01',                          '2024-12-15', 'received',  'Accident report obtained'),
        ('c3000000-0000-0000-0000-000000000003', 'Rex Hospital',                 'Emergency Records', '2024-12-01',                          '2025-01-05', 'received',  'ER records and imaging'),
        ('c5000000-0000-0000-0000-000000000005', 'UNC Hospital Surgical Dept',   'Surgical Records',  CURRENT_DATE - INTERVAL '75 days',     NULL,         'follow_up', 'Third request sent — still outstanding')
      ON CONFLICT DO NOTHING
    `);
    console.log('Records requests seeded');

    // --- Attorney Requests ---
    await client.query(`
      INSERT INTO attorney_requests (case_id, requested_by, priority, title, description, status, due_date) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004', 'high',     'Prepare settlement breakdown',          'Need itemized damages calculation with medical specials and general damages estimate',            'open',        CURRENT_DATE + INTERVAL '7 days'),
        ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000004', 'critical', 'Finalize demand package',               'All medical records compiled. Need demand letter drafted with full damages summary',              'in_progress', CURRENT_DATE + INTERVAL '2 days'),
        ('c4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000004', 'standard', 'Run conflict check',                    'New client Marcus Jenkins — verify no conflicts with employer or insurance carrier',              'open',        CURRENT_DATE + INTERVAL '3 days'),
        ('c5000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000004', 'critical', 'Prepare discovery responses',           'Interrogatory answers and document production due in 10 days',                                    'in_progress', CURRENT_DATE + INTERVAL '10 days'),
        ('c2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', 'deferred', 'Research premises liability precedent', 'Find NC appellate cases on grocery store slip-and-fall duty of care',                             'open',        CURRENT_DATE + INTERVAL '21 days')
      ON CONFLICT DO NOTHING
    `);
    console.log('Attorney requests seeded');

    // --- Contact Log ---
    await client.query(`
      INSERT INTO contact_log (case_id, contact_type, contact_date, notes, logged_by) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'phone', CURRENT_DATE - INTERVAL '3 days', 'Called client for treatment update. Still attending chiro 2x/week. Feeling improvement.',          'a2000000-0000-0000-0000-000000000002'),
        ('c2000000-0000-0000-0000-000000000002', 'email', CURRENT_DATE - INTERVAL '1 day',  'Sent MRI appointment confirmation to client.',                                                     'a2000000-0000-0000-0000-000000000002'),
        ('c4000000-0000-0000-0000-000000000004', 'phone', CURRENT_DATE,                      'Initial intake call. Client described fall from 12ft scaffolding. Employer did not provide harness.', 'a2000000-0000-0000-0000-000000000002')
      ON CONFLICT DO NOTHING
    `);
    console.log('Contact log seeded');

    // --- Treatments ---
    await client.query(`
      INSERT INTO treatments (case_id, provider_name, treatment_type, start_date, end_date, status, notes) VALUES
        ('c1000000-0000-0000-0000-000000000001', 'Triangle Chiropractic', 'Chiropractic',    '2025-01-20', NULL,         'active',    '2x per week adjustments and therapy'),
        ('c1000000-0000-0000-0000-000000000001', 'WakeMed Emergency',     'Emergency Care',  '2025-01-15', '2025-01-15', 'completed', 'ER visit day of accident — X-rays, pain management'),
        ('c2000000-0000-0000-0000-000000000002', 'Duke Orthopedics',      'Orthopedic',      '2025-03-10', NULL,         'active',    'Knee and wrist evaluation. MRI pending.'),
        ('c3000000-0000-0000-0000-000000000003', 'Rex Physical Therapy',  'Physical Therapy', '2024-12-15', '2025-02-28', 'completed', '12 weeks PT for neck and back'),
        ('c5000000-0000-0000-0000-000000000005', 'UNC Hospital',          'Surgical',        '2024-09-05', '2024-09-05', 'completed', 'Original surgery where error occurred')
      ON CONFLICT DO NOTHING
    `);
    console.log('Treatments seeded');

    await client.query('COMMIT');
    console.log('Seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
