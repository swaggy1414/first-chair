import bcrypt from 'bcrypt';
import pool from './db.js';

const DEMO_PASSWORD = 'DemoFirst2025!';
const SALT_ROUNDS = 10;

const demoUsers = {
  admin:     'de100000-0000-0000-0000-000000000001',
  paralegal: 'de100000-0000-0000-0000-000000000002',
  attorney:  'de100000-0000-0000-0000-000000000003',
};

const demoCases = {
  c1: 'de200000-0000-0000-0000-000000000001',
  c2: 'de200000-0000-0000-0000-000000000002',
  c3: 'de200000-0000-0000-0000-000000000003',
};

const demoOC = {
  oc1: 'de300000-0000-0000-0000-000000000001',
  oc2: 'de300000-0000-0000-0000-000000000002',
};

const demoJudges = {
  j1: 'de400000-0000-0000-0000-000000000001',
  j2: 'de400000-0000-0000-0000-000000000002',
};

export async function seedDemo() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ========== DEMO USERS ==========
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, force_password_change) VALUES
        ('${demoUsers.admin}',     'Demo Admin',     'demo.admin@firstchair.law',     $1, 'admin',     false),
        ('${demoUsers.paralegal}', 'Demo Paralegal', 'demo.paralegal@firstchair.law', $1, 'paralegal', false),
        ('${demoUsers.attorney}',  'Demo Attorney',  'demo.attorney@firstchair.law',  $1, 'attorney',  false)
      ON CONFLICT (id) DO UPDATE SET password_hash = $1, force_password_change = false
    `, [hash]);
    console.log('Demo users created');

    // ========== OPPOSING COUNSEL ==========
    await client.query(`
      INSERT INTO opposing_counsel (id, name, firm_name, email, phone, state_bar_number, notes) VALUES
        ('${demoOC.oc1}', 'Victoria Grant',   'Grant & Associates',       'vgrant@grantlaw.com',    '(919) 555-9001', 'NC-44821', 'Aggressive in discovery. Files objections frequently. Tends to delay but settles at mediation when cornered with strong evidence.'),
        ('${demoOC.oc2}', 'Marcus Whitfield', 'Whitfield Insurance Defense', 'mwhitfield@widlaw.com', '(704) 555-9002', 'NC-31456', 'Experienced insurance defense. Reasonable in discovery but lowballs settlements. Responds better to detailed demand packages.')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Demo opposing counsel created');

    // ========== JUDGES ==========
    await client.query(`
      INSERT INTO judges (id, name, court, jurisdiction, county, state, notes) VALUES
        ('${demoJudges.j1}', 'Hon. Sarah Blackmon',  'Wake County Superior Court',        'Superior',   'Wake',        'NC', 'Strict on deadlines. Will grant motions to compel if good faith conferral is documented. Prefers mediation before trial.'),
        ('${demoJudges.j2}', 'Hon. Robert Caldwell', 'Mecklenburg County Superior Court', 'Superior',   'Mecklenburg', 'NC', 'Former defense attorney. Fair but thorough. Requires detailed discovery logs. Expects professionalism from both sides.')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Demo judges created');

    // ========== DEMO CASES ==========
    await client.query(`
      INSERT INTO cases (id, case_number, client_name, client_phone, client_email, incident_date, incident_type, status, phase, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes, opposing_counsel_id, judge_id) VALUES
        ('${demoCases.c1}', 'DEMO-2025-001', 'Maria Gonzalez',   '(919) 555-7001', 'mgonzalez@email.com',  '2025-08-12', 'Motor Vehicle Accident', 'litigation', 'written_discovery',
          '${demoUsers.paralegal}', '${demoUsers.attorney}', 'red', 'Discovery deadline in 10 days',
          'Rear-end collision on I-440. Client was stopped at red light when defendant struck at 45mph. Airbag deployed. Transported to WakeMed ER. Diagnosed with cervical herniation C5-C6 and lumbar strain. Ongoing chiropractic and pain management.',
          '${demoOC.oc1}', '${demoJudges.j1}'),

        ('${demoCases.c2}', 'DEMO-2025-002', 'James Thompson',   '(704) 555-7002', 'jthompson@email.com',  '2025-05-20', 'Slip and Fall',          'litigation', 'deposition',
          '${demoUsers.paralegal}', '${demoUsers.attorney}', 'yellow', 'Expert deposition scheduled',
          'Fell on unmarked wet floor at Northgate Mall food court. Security footage preserved showing no wet floor signs for 30+ minutes. Fractured left wrist (ORIF surgery) and torn meniscus. Surveillance is strong evidence.',
          '${demoOC.oc2}', '${demoJudges.j2}'),

        ('${demoCases.c3}', 'DEMO-2025-003', 'Sandra Williams',  '(336) 555-7003', 'swilliams@email.com',  '2025-03-10', 'Workplace Injury',       'demand',     'mediation',
          '${demoUsers.paralegal}', '${demoUsers.attorney}', 'green', 'Demand package sent — awaiting response',
          'Fell from scaffolding at construction site. Employer failed to provide fall protection harness per OSHA standards. OSHA citation issued. Back surgery (L4-L5 fusion) completed. 6 months PT. Client at MMI. Demand of $285,000 sent to carrier.',
          '${demoOC.oc2}', NULL)
      ON CONFLICT (id) DO UPDATE SET
        assigned_paralegal_id = EXCLUDED.assigned_paralegal_id,
        assigned_attorney_id = EXCLUDED.assigned_attorney_id,
        opposing_counsel_id = EXCLUDED.opposing_counsel_id,
        judge_id = EXCLUDED.judge_id
    `);
    console.log('Demo cases created');

    // ========== CASE-OC LINKS ==========
    await client.query(`
      INSERT INTO case_opposing_counsel (case_id, opposing_counsel_id) VALUES
        ('${demoCases.c1}', '${demoOC.oc1}'),
        ('${demoCases.c2}', '${demoOC.oc2}'),
        ('${demoCases.c3}', '${demoOC.oc2}')
      ON CONFLICT DO NOTHING
    `);

    // ========== CASE-JUDGE LINKS ==========
    await client.query(`
      INSERT INTO case_judges (case_id, judge_id) VALUES
        ('${demoCases.c1}', '${demoJudges.j1}'),
        ('${demoCases.c2}', '${demoJudges.j2}')
      ON CONFLICT DO NOTHING
    `);

    // ========== DEADLINES ==========
    await client.query(`
      INSERT INTO deadlines (case_id, title, due_date, type, status, assigned_to, notes) VALUES
        ('${demoCases.c1}', 'Discovery responses due',    CURRENT_DATE + INTERVAL '10 days',  'discovery',              'pending', '${demoUsers.attorney}', 'Interrogatories and RFPs due'),
        ('${demoCases.c1}', 'Statute of Limitations',     '2028-08-12',                        'statute_of_limitations', 'pending', '${demoUsers.attorney}', '3-year SOL for MVA in NC'),
        ('${demoCases.c2}', 'Expert deposition',          CURRENT_DATE + INTERVAL '14 days',   'deposition',             'pending', '${demoUsers.attorney}', 'Dr. Martinez — orthopedic expert'),
        ('${demoCases.c2}', 'Statute of Limitations',     '2028-05-20',                        'statute_of_limitations', 'pending', '${demoUsers.attorney}', '3-year SOL'),
        ('${demoCases.c3}', 'Mediation scheduled',        CURRENT_DATE + INTERVAL '21 days',   'hearing',                'pending', '${demoUsers.attorney}', 'Mediator: Hon. Patricia Wells (ret.)'),
        ('${demoCases.c3}', 'Demand response deadline',   CURRENT_DATE + INTERVAL '7 days',    'follow_up',              'pending', '${demoUsers.paralegal}', 'Carrier has 30 days to respond — deadline approaching')
      ON CONFLICT DO NOTHING
    `);

    // ========== RECORDS REQUESTS (with overdue ones for follow-up generation) ==========
    await client.query(`
      INSERT INTO records_requests (case_id, provider_name, request_type, requested_date, received_date, status, notes) VALUES
        ('${demoCases.c1}', 'WakeMed Emergency',        'Emergency Records', '2025-09-01', '2025-09-20', 'received',  'Complete ER records'),
        ('${demoCases.c1}', 'Triangle Pain Management', 'Treatment Records', CURRENT_DATE - INTERVAL '50 days', NULL, 'sent', 'No response after 50 days — needs follow-up'),
        ('${demoCases.c1}', 'Carolina Chiropractic',    'Treatment Records', CURRENT_DATE - INTERVAL '35 days', NULL, 'sent', 'Initial request sent — approaching follow-up window'),
        ('${demoCases.c2}', 'Rex Hospital Orthopedics', 'Surgical Records',  '2025-06-15', '2025-07-10', 'received',  'ORIF surgery records complete'),
        ('${demoCases.c2}', 'Northgate Mall Security',  'Incident Report',   '2025-06-01', '2025-06-05', 'received',  'Surveillance footage and incident report obtained'),
        ('${demoCases.c3}', 'Duke Spine Center',        'Surgical Records',  '2025-10-01', '2025-11-15', 'received',  'L4-L5 fusion records'),
        ('${demoCases.c3}', 'OSHA Investigation',       'Government Records', CURRENT_DATE - INTERVAL '40 days', NULL, 'follow_up', 'OSHA citation records requested — 2nd follow-up needed')
      ON CONFLICT DO NOTHING
    `);

    // ========== TREATMENTS ==========
    await client.query(`
      INSERT INTO treatments (case_id, provider_name, treatment_type, start_date, end_date, status, notes) VALUES
        ('${demoCases.c1}', 'WakeMed Emergency',        'Emergency Care',  '2025-08-12', '2025-08-12', 'completed', 'ER visit day of accident'),
        ('${demoCases.c1}', 'Carolina Chiropractic',    'Chiropractic',    '2025-08-20', NULL,         'active',    '3x per week adjustments'),
        ('${demoCases.c1}', 'Triangle Pain Management', 'Pain Management', '2025-09-15', NULL,         'active',    'Epidural injections and medication'),
        ('${demoCases.c2}', 'Rex Hospital',             'Surgery',         '2025-06-10', '2025-06-10', 'completed', 'ORIF left wrist'),
        ('${demoCases.c2}', 'Rex Physical Therapy',     'Physical Therapy','2025-07-01', '2025-10-15', 'completed', '16 weeks PT'),
        ('${demoCases.c3}', 'Duke Spine Center',        'Surgery',         '2025-09-15', '2025-09-15', 'completed', 'L4-L5 fusion'),
        ('${demoCases.c3}', 'Raleigh PT Associates',    'Physical Therapy','2025-10-01', '2026-03-01', 'completed', '6 months PT — patient at MMI')
      ON CONFLICT DO NOTHING
    `);

    // ========== DISCOVERY RESPONSES + GAPS (for case 1 — written discovery) ==========
    const drId = 'de500000-0000-0000-0000-000000000001';
    await client.query(`
      INSERT INTO discovery_responses (id, case_id, uploaded_by, file_name, file_size, response_party, status, created_at)
      VALUES ('${drId}', '${demoCases.c1}', '${demoUsers.paralegal}', 'defendant-discovery-response.pdf', 245000, 'defendant', 'complete', CURRENT_DATE - INTERVAL '5 days')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO discovery_gaps (id, discovery_response_id, case_id, gap_type, request_number, request_type, original_request_text, response_received, gap_description, ai_reasoning, priority, status) VALUES
        ('de600000-0000-0000-0000-000000000001', '${drId}', '${demoCases.c1}', 'incomplete_answer', 3, 'interrogatory',
          'State the speed at which the defendant was traveling at the time of the collision.',
          'Defendant states they were traveling at an appropriate speed.',
          'Response is evasive — no specific speed provided. NCRCP Rule 33 requires specific answers.',
          'The response avoids stating a specific speed. The police report indicates defendant was traveling approximately 45mph in a 35mph zone. This discrepancy between the evasive response and documented evidence suggests the defendant is deliberately withholding this information.',
          'high', 'open'),

        ('de600000-0000-0000-0000-000000000002', '${drId}', '${demoCases.c1}', 'missing_document', 5, 'rpd',
          'Produce all photographs taken at the scene of the accident.',
          'No documents produced.',
          'Defendant claims no photos exist despite police report noting photos were taken.',
          'The police report (Exhibit A) references the responding officer taking scene photographs. The defendant insurance company typically receives these. The claim of no photos existing is inconsistent with the documentary evidence.',
          'high', 'open'),

        ('de600000-0000-0000-0000-000000000003', '${drId}', '${demoCases.c1}', 'evasive_answer', 7, 'interrogatory',
          'Identify all persons who witnessed the accident.',
          'Defendant is unaware of any witnesses.',
          'Police report lists two witnesses. Defendant likely has access to this information.',
          'The police report identifies two witnesses: Michael Torres and Janet Park. The defendant carrier should have the police report. This answer appears deliberately evasive.',
          'medium', 'open'),

        ('de600000-0000-0000-0000-000000000004', '${drId}', '${demoCases.c1}', 'no_answer', 12, 'rfa',
          'Admit that the defendant was operating their vehicle in excess of the posted speed limit at the time of the collision.',
          NULL,
          'No response provided to this RFA. Under NCRCP Rule 36, unanswered RFAs are deemed admitted after 30 days.',
          'This is a critical admission request. If no response is provided within 30 days, it is automatically deemed admitted under NC rules. This could be dispositive on the liability question.',
          'high', 'open')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Demo discovery gaps created');

    // ========== CASE KNOWLEDGE ==========
    await client.query(`
      INSERT INTO case_knowledge (id, case_id, incident_type, injury_types, liability_factors, outcome, settlement_amount, duration_days, lessons_learned, created_by) VALUES
        ('de700000-0000-0000-0000-000000000001', '${demoCases.c1}', 'Motor Vehicle Accident',
          'Cervical herniation, lumbar strain, chronic pain requiring injections',
          'Rear-end collision with clear liability. Police report confirmed defendant at fault. Speed differential was key factor.',
          'settled', 175000, 420,
          'Treatment consistency was critical. Client who attended all appointments and followed doctor orders presented a much stronger damages picture. The defense tried to argue pre-existing condition but MRI comparison (pre vs post accident) shut that down. Always get pre-accident medical records early to prevent this defense.',
          '${demoUsers.attorney}'),

        ('de700000-0000-0000-0000-000000000002', '${demoCases.c3}', 'Workplace Injury',
          'Lumbar fusion L4-L5, 6 months physical therapy, permanent partial disability',
          'OSHA citation for failure to provide fall protection. Employer had prior violations. Third-party contractor also liable.',
          'settled', 285000, 380,
          'OSHA citations cannot be directly admitted in NC civil cases but the underlying facts (no harness provided, prior violations) are powerful. Workers comp lien coordination was critical — started negotiations with WC carrier 3 months before settlement. Ended up negotiating WC lien from $82K down to $51K. Key lesson: engage WC lien early.',
          '${demoUsers.attorney}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Demo case knowledge created');

    // ========== ATTORNEY NOTES ==========
    await client.query(`
      INSERT INTO attorney_notes (case_id, attorney_id, note_text, note_type, is_private) VALUES
        ('${demoCases.c1}', '${demoUsers.attorney}', 'Grant is filing excessive objections. Plan to file motion to compel after conferral letter. Strong case for sanctions if pattern continues.', 'strategy', false),
        ('${demoCases.c2}', '${demoUsers.attorney}', 'Surveillance footage is our strongest asset. Defense will try to argue comparative negligence — client was looking at phone. But footage shows she was standing still in line. Prepare expert to testify on notice period.', 'strategy', false),
        ('${demoCases.c3}', '${demoUsers.attorney}', 'Demand sent at $285K. Expect counter around $120K. Floor is $200K given surgical intervention and OSHA citation. Client is willing to settle at mediation if offer exceeds $210K.', 'settlement', false)
      ON CONFLICT DO NOTHING
    `);

    // ========== CONTACT LOG ==========
    await client.query(`
      INSERT INTO contact_log (case_id, contact_type, contact_date, notes, logged_by) VALUES
        ('${demoCases.c1}', 'phone', CURRENT_DATE - INTERVAL '2 days', 'Called client — pain management helping. Still attending chiro 3x/week.', '${demoUsers.paralegal}'),
        ('${demoCases.c2}', 'email', CURRENT_DATE - INTERVAL '1 day',  'Sent deposition prep materials to client.', '${demoUsers.paralegal}'),
        ('${demoCases.c3}', 'phone', CURRENT_DATE - INTERVAL '3 days', 'Client confirmed availability for mediation date. Reviewed settlement expectations.', '${demoUsers.paralegal}')
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Demo seed complete!');
    return { success: true, message: 'Demo data seeded successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Demo seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
