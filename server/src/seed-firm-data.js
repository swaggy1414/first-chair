import bcrypt from 'bcrypt';
import pool from './db.js';

const PASSWORD = 'FirstChair2025!';
const SALT_ROUNDS = 10;

// --- Fixed UUIDs ---
const users = {
  sarah:    'b1000000-0000-0000-0000-000000000001',
  david:    'b2000000-0000-0000-0000-000000000002',
  maria:    'b3000000-0000-0000-0000-000000000003',
  james:    'b4000000-0000-0000-0000-000000000004',
  ashley:   'b5000000-0000-0000-0000-000000000005',
  robert:   'b6000000-0000-0000-0000-000000000006',
  jennifer: 'b7000000-0000-0000-0000-000000000007',
};
const existingAttorney = 'a4000000-0000-0000-0000-000000000004';

function caseId(n) {
  return `d1000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function deadlineId(n) {
  return `e1000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function recordId(n) {
  return `f1000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function attReqId(n) {
  return `f2000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function treatmentId(n) {
  return `f3000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function contactId(n) {
  return `f4000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}
function knowledgeId(n) {
  return `f5000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ===================== USERS =====================
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, force_password_change) VALUES
        ('${users.sarah}',    'Sarah Mitchell', 'sarah.mitchell@firstchair.law', $1, 'paralegal', false),
        ('${users.david}',    'David Chen Jr',  'david.chen@firstchair.law',     $1, 'paralegal', false),
        ('${users.maria}',    'Maria Garcia',   'maria.garcia@firstchair.law',   $1, 'paralegal', false),
        ('${users.james}',    'James Wilson',   'james.wilson@firstchair.law',   $1, 'paralegal', false),
        ('${users.ashley}',   'Ashley Brown',   'ashley.brown@firstchair.law',   $1, 'paralegal', false),
        ('${users.robert}',   'Robert Hayes',   'robert.hayes@firstchair.law',   $1, 'attorney',  false),
        ('${users.jennifer}', 'Jennifer Lee',   'jennifer.lee@firstchair.law',   $1, 'attorney',  false)
      ON CONFLICT DO NOTHING
    `, [hash]);
    console.log('Users seeded');

    // ===================== CASES (25 active + 3 closed = 28) =====================
    await client.query(`
      INSERT INTO cases (id, case_number, client_name, client_phone, client_email, incident_date, incident_type, status, phase, assigned_paralegal_id, assigned_attorney_id, flag_color, flag_note, notes, created_at) VALUES
        -- Sarah Mitchell (7 cases) / Robert Hayes
        ('${caseId(1)}',  'FC-2025-006', 'Tyrone Jackson',     '(919) 555-1001', 'tjackson@email.com',    '2025-06-15', 'Motor Vehicle Accident', 'active',     'active',             '${users.sarah}', '${users.robert}',   'red',    'Severe injuries — priority',         'Head-on collision on US-70. Client airlifted to WakeMed. Multiple fractures and TBI.',                          CURRENT_DATE - INTERVAL '45 days'),
        ('${caseId(2)}',  'FC-2025-007', 'Patricia Coleman',   '(919) 555-1002', 'pcoleman@email.com',    '2025-05-20', 'Slip and Fall',          'treatment',  'active',             '${users.sarah}', '${users.robert}',   'yellow', 'Awaiting ortho follow-up',           'Fell on wet floor at shopping mall. Hip contusion and lower back strain.',                                       CURRENT_DATE - INTERVAL '90 days'),
        ('${caseId(3)}',  'FC-2025-008', 'DeShawn Williams',   '(336) 555-1003', 'dwilliams@email.com',   '2025-03-10', 'Motor Vehicle Accident', 'demand',     'written_discovery',  '${users.sarah}', '${users.robert}',   'green',  'Demand package nearly ready',        'Rear-end collision on I-85. Whiplash and herniated disc at C5-C6.',                                             CURRENT_DATE - INTERVAL '180 days'),
        ('${caseId(4)}',  'FC-2025-009', 'Nancy Stewart',      '(704) 555-1004', 'nstewart@email.com',    '2025-07-01', 'Dog Bite',               'active',     'active',             '${users.sarah}', '${users.robert}',   NULL,     NULL,                                 'Neighbor''s pit bull attacked client while jogging. Deep lacerations to left arm and hand.',                     CURRENT_DATE - INTERVAL '30 days'),
        ('${caseId(5)}',  'FC-2025-010', 'Raymond Torres',     '(252) 555-1005', 'rtorres@email.com',     '2025-01-22', 'Workplace Injury',       'litigation', 'deposition',         '${users.sarah}', '${users.robert}',   'red',    'Deposition scheduled next week',     'Fell through unsecured floor opening at warehouse. Spinal cord injury. OSHA cited employer.',                   CURRENT_DATE - INTERVAL '300 days'),
        ('${caseId(6)}',  'FC-2025-011', 'Christina Hall',     '(919) 555-1006', 'chall@email.com',       '2025-04-15', 'Medical Malpractice',    'litigation', 'written_discovery',  '${users.sarah}', '${users.jennifer}', 'red',    'Expert report deadline approaching', 'Misdiagnosis of appendicitis led to rupture and sepsis. 2-week ICU stay.',                                      CURRENT_DATE - INTERVAL '200 days'),
        ('${caseId(7)}',  'FC-2025-012', 'William Foster',     '(336) 555-1007', 'wfoster@email.com',     '2025-08-05', 'Motor Vehicle Accident', 'intake',     'active',             '${users.sarah}', '${users.robert}',   'green',  'New case — gathering records',       'Multi-vehicle pileup on I-40 during rainstorm. Airbag deployment. Shoulder and chest injuries.',                CURRENT_DATE - INTERVAL '35 days'),

        -- David Chen Jr (6 cases) / Jennifer Lee
        ('${caseId(8)}',  'FC-2025-013', 'Latasha Robinson',   '(919) 555-1008', 'lrobinson@email.com',   '2025-02-14', 'Motor Vehicle Accident', 'active',     'active',             '${users.david}', '${users.jennifer}', 'yellow', 'Client missed last appointment',     'Side-swipe on Glenwood Ave. Left shoulder rotator cuff tear. Surgery recommended.',                             CURRENT_DATE - INTERVAL '250 days'),
        ('${caseId(9)}',  'FC-2025-014', 'Brian Murphy',       '(704) 555-1009', 'bmurphy@email.com',     '2025-06-01', 'Slip and Fall',          'demand',     'mediation',          '${users.david}', '${users.jennifer}', 'green',  'Mediation scheduled',                'Slipped on icy sidewalk outside office building. Broken ankle and torn ligaments.',                             CURRENT_DATE - INTERVAL '150 days'),
        ('${caseId(10)}', 'FC-2025-015', 'Kendra Washington',  '(252) 555-1010', 'kwashington@email.com', '2025-04-20', 'Dog Bite',               'treatment',  'active',             '${users.david}', '${users.jennifer}', 'yellow', 'Plastic surgery consult pending',    'Child bitten by unleashed dog at park. Facial scarring requiring reconstructive surgery.',                      CURRENT_DATE - INTERVAL '120 days'),
        ('${caseId(11)}', 'FC-2025-016', 'Steven Patel',       '(919) 555-1011', 'spatel@email.com',      '2025-03-05', 'Workplace Injury',       'active',     'written_discovery',  '${users.david}', '${users.jennifer}', NULL,     NULL,                                 'Chemical burn at manufacturing plant. Employer failed to provide proper PPE. OSHA investigation ongoing.',      CURRENT_DATE - INTERVAL '270 days'),
        ('${caseId(12)}', 'FC-2025-017', 'Amanda Price',       '(336) 555-1012', 'aprice@email.com',      '2025-07-10', 'Motor Vehicle Accident', 'intake',     'active',             '${users.david}', '${users.jennifer}', 'green',  'Intake complete — needs assignment',  'T-bone at intersection. Other driver ran stop sign. Knee and hip injuries.',                                    CURRENT_DATE - INTERVAL '40 days'),
        ('${caseId(13)}', 'FC-2025-018', 'Marcus Thompson',    '(704) 555-1013', 'mthompson@email.com',   '2025-05-15', 'Medical Malpractice',    'litigation', 'deposition',         '${users.david}', '${users.jennifer}', 'red',    'Depo prep needed ASAP',              'Surgical sponge left inside abdomen after gallbladder surgery. Required second surgery to remove.',             CURRENT_DATE - INTERVAL '210 days'),

        -- Maria Garcia (5 cases) / Robert Hayes & existing attorney
        ('${caseId(14)}', 'FC-2025-019', 'Jasmine Carter',     '(919) 555-1014', 'jcarter@email.com',     '2025-06-20', 'Motor Vehicle Accident', 'active',     'active',             '${users.maria}', '${users.robert}',   'yellow', 'Waiting on police report',           'Uber passenger injured when driver ran red light. Neck and back injuries. Multiple insurance carriers.',        CURRENT_DATE - INTERVAL '60 days'),
        ('${caseId(15)}', 'FC-2025-020', 'Daniel Kim',         '(336) 555-1015', 'dkim@email.com',        '2025-01-30', 'Slip and Fall',          'demand',     'mediation',          '${users.maria}', '${existingAttorney}', 'green', 'Mediation next month',               'Fell on broken staircase at apartment complex. Landlord had prior complaints. Wrist fracture.',                 CURRENT_DATE - INTERVAL '330 days'),
        ('${caseId(16)}', 'FC-2025-021', 'Brittany Adams',     '(704) 555-1016', 'badams@email.com',      '2025-05-10', 'Dog Bite',               'treatment',  'active',             '${users.maria}', '${existingAttorney}', 'yellow', 'Follow-up with plastic surgeon',     'Attacked by neighbor''s German Shepherd. Multiple bite wounds to legs. Nerve damage suspected.',                 CURRENT_DATE - INTERVAL '140 days'),
        ('${caseId(17)}', 'FC-2025-022', 'Carlos Ramirez',     '(252) 555-1017', 'cramirez@email.com',    '2025-07-15', 'Motor Vehicle Accident', 'active',     'active',             '${users.maria}', '${users.robert}',   NULL,     NULL,                                 'Motorcycle vs. truck on Highway 64. Road rash, fractured pelvis, and dislocated shoulder.',                     CURRENT_DATE - INTERVAL '50 days'),
        ('${caseId(18)}', 'FC-2025-023', 'Heather Sullivan',   '(919) 555-1018', 'hsullivan@email.com',   '2025-02-25', 'Workplace Injury',       'litigation', 'deposition',         '${users.maria}', '${existingAttorney}', 'red',   'Expert deposition this week',        'Repetitive stress injury from assembly line work. Carpal tunnel and shoulder impingement. Employer denied claim.', CURRENT_DATE - INTERVAL '290 days'),

        -- James Wilson (4 cases) / existing attorney & Jennifer Lee
        ('${caseId(19)}', 'FC-2025-024', 'Terrence Brooks',    '(336) 555-1019', 'tbrooks@email.com',     '2025-04-01', 'Motor Vehicle Accident', 'treatment',  'written_discovery',  '${users.james}', '${existingAttorney}', 'yellow', 'Treatment ongoing — 3x/week PT',     'Head-on collision on rural road. Concussion, broken ribs, and knee surgery. Lengthy recovery.',                 CURRENT_DATE - INTERVAL '230 days'),
        ('${caseId(20)}', 'FC-2025-025', 'Samantha Reed',      '(704) 555-1020', 'sreed@email.com',       '2025-06-05', 'Slip and Fall',          'active',     'active',             '${users.james}', '${existingAttorney}', NULL,     NULL,                                 'Slipped on hydraulic fluid leak in parking garage. Back strain and concussion.',                                CURRENT_DATE - INTERVAL '80 days'),
        ('${caseId(21)}', 'FC-2025-026', 'Jerome Washington',  '(919) 555-1021', 'jwashington@email.com', '2025-03-20', 'Medical Malpractice',    'litigation', 'deposition',         '${users.james}', '${users.jennifer}', NULL,     NULL,                                 'Delayed cancer diagnosis. Tumor grew from Stage I to Stage III over 14 months of missed follow-ups.',          CURRENT_DATE - INTERVAL '310 days'),
        ('${caseId(22)}', 'FC-2025-027', 'Michelle Cooper',    '(252) 555-1022', 'mcooper@email.com',     '2025-08-01', 'Motor Vehicle Accident', 'intake',     'active',             '${users.james}', '${users.jennifer}', 'green',  'Just signed — needs full workup',    'Rear-ended at stoplight. Neck pain and headaches. Prior history of neck issues.',                               CURRENT_DATE - INTERVAL '32 days'),

        -- Ashley Brown (3 cases) / Robert Hayes & existing attorney
        ('${caseId(23)}', 'FC-2025-028', 'Andre Harris',       '(919) 555-1023', 'aharris@email.com',     '2025-05-25', 'Workplace Injury',       'treatment',  'written_discovery',  '${users.ashley}', '${users.robert}',   'yellow', 'Awaiting IME report',                'Fell from ladder at construction site. Herniated discs L4-L5 and L5-S1. Surgery recommended.',                 CURRENT_DATE - INTERVAL '160 days'),
        ('${caseId(24)}', 'FC-2025-029', 'Lisa Nguyen',        '(704) 555-1024', 'lnguyen@email.com',     '2025-07-20', 'Motor Vehicle Accident', 'active',     'written_discovery',  '${users.ashley}', '${users.robert}',   'green',  'Records coming in',                  'Sideswipe on I-77. Shoulder impingement and cervical strain. At-fault driver uninsured.',                       CURRENT_DATE - INTERVAL '55 days'),
        ('${caseId(25)}', 'FC-2025-030', 'Derek Palmer',       '(336) 555-1025', 'dpalmer@email.com',     '2025-04-10', 'Slip and Fall',          'demand',     'mediation',          '${users.ashley}', '${existingAttorney}', 'green', 'Strong liability — good case',       'Tripped on broken sidewalk outside restaurant. Fractured elbow and torn rotator cuff.',                        CURRENT_DATE - INTERVAL '240 days'),

        -- 3 Closed Cases
        ('${caseId(26)}', 'FC-2025-031', 'James Thompson',     '(919) 555-1026', 'jthompson@email.com',   '2024-12-01', 'Motor Vehicle Accident', 'settled',    'closed',             '${users.sarah}', '${users.robert}',   NULL,     NULL,                                 'Rear-end collision on Capital Blvd. Back and neck injuries. Settled after mediation.',                          CURRENT_DATE - INTERVAL '400 days'),
        ('${caseId(27)}', 'FC-2025-032', 'Linda Martinez',     '(704) 555-1027', 'lmartinez@email.com',   '2024-12-15', 'Slip and Fall',          'settled',    'closed',             '${users.david}', '${users.jennifer}', NULL,     NULL,                                 'Fell in grocery store produce section. Knee fracture requiring surgery. Surveillance showed wet floor.',        CURRENT_DATE - INTERVAL '350 days'),
        ('${caseId(28)}', 'FC-2025-033', 'Kevin Wright',       '(336) 555-1028', 'kwright@email.com',     '2025-01-10', 'Workplace Injury',       'settled',    'closed',             '${users.maria}', '${existingAttorney}', NULL,    NULL,                                 'Shoulder injury at construction site. Required rotator cuff surgery. Workers comp crossover issues resolved.',  CURRENT_DATE - INTERVAL '300 days')
      ON CONFLICT DO NOTHING
    `);
    console.log('Cases seeded (28)');

    // ===================== DEADLINES (~80) =====================
    await client.query(`
      INSERT INTO deadlines (id, case_id, title, due_date, type, status, assigned_to, notes) VALUES
        -- Case 1 (Tyrone Jackson - MVA, active) - Sarah/Robert
        ('${deadlineId(1)}',  '${caseId(1)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '690 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL for MVA'),
        ('${deadlineId(2)}',  '${caseId(1)}',  'Follow up with neurosurgeon',   CURRENT_DATE + INTERVAL '3 days',    'follow_up',              'pending', '${users.sarah}',    'Get MRI results and treatment plan'),
        ('${deadlineId(3)}',  '${caseId(1)}',  'Request updated med records',   CURRENT_DATE - INTERVAL '5 days',    'medical',                'pending', '${users.sarah}',    'WakeMed records overdue'),

        -- Case 2 (Patricia Coleman - Slip/Fall, treatment) - Sarah/Robert
        ('${deadlineId(4)}',  '${caseId(2)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '600 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(5)}',  '${caseId(2)}',  'Ortho follow-up appointment',   CURRENT_DATE + INTERVAL '5 days',    'medical',                'pending', '${users.sarah}',    'Hip evaluation at Duke'),
        ('${deadlineId(6)}',  '${caseId(2)}',  'Request billing records',       CURRENT_DATE - INTERVAL '12 days',   'follow_up',              'pending', '${users.sarah}',    'BCBS billing still not received'),

        -- Case 3 (DeShawn Williams - MVA, demand) - Sarah/Robert
        ('${deadlineId(7)}',  '${caseId(3)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '450 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(8)}',  '${caseId(3)}',  'Discovery responses due',       CURRENT_DATE + INTERVAL '14 days',   'discovery',              'pending', '${users.sarah}',    'Interrogatory answers due'),
        ('${deadlineId(9)}',  '${caseId(3)}',  'Send demand letter',            CURRENT_DATE - INTERVAL '3 days',    'filing',                 'pending', '${users.robert}',   'Demand package complete — needs to go out'),

        -- Case 4 (Nancy Stewart - Dog Bite, active) - Sarah/Robert
        ('${deadlineId(10)}', '${caseId(4)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '1060 days', 'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL for dog bite'),
        ('${deadlineId(11)}', '${caseId(4)}',  'Follow up with client',         CURRENT_DATE + INTERVAL '2 days',    'follow_up',              'pending', '${users.sarah}',    'Check on wound healing progress'),

        -- Case 5 (Raymond Torres - Workplace, litigation) - Sarah/Robert
        ('${deadlineId(12)}', '${caseId(5)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '370 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL — already filed'),
        ('${deadlineId(13)}', '${caseId(5)}',  'Plaintiff deposition',          CURRENT_DATE + INTERVAL '7 days',    'deposition',             'pending', '${users.robert}',   'Client depo at defense counsel office'),
        ('${deadlineId(14)}', '${caseId(5)}',  'OSHA records follow-up',        CURRENT_DATE - INTERVAL '8 days',    'follow_up',              'pending', '${users.sarah}',    'Still waiting on OSHA investigation report'),

        -- Case 6 (Christina Hall - MedMal, litigation) - Sarah/Jennifer
        ('${deadlineId(15)}', '${caseId(6)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '430 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL for med mal'),
        ('${deadlineId(16)}', '${caseId(6)}',  'Expert report deadline',        CURRENT_DATE + INTERVAL '10 days',   'discovery',              'pending', '${users.jennifer}', 'Expert must submit report per court order'),
        ('${deadlineId(17)}', '${caseId(6)}',  'Request hospital records',      CURRENT_DATE - INTERVAL '15 days',   'medical',                'pending', '${users.sarah}',    'ICU records still outstanding'),

        -- Case 7 (William Foster - MVA, intake) - Sarah/Robert
        ('${deadlineId(18)}', '${caseId(7)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '1050 days', 'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(19)}', '${caseId(7)}',  'Initial client meeting',        CURRENT_DATE + INTERVAL '1 day',     'follow_up',              'pending', '${users.sarah}',    'Gather accident details and medical info'),

        -- Case 8 (Latasha Robinson - MVA, active) - David/Jennifer
        ('${deadlineId(20)}', '${caseId(8)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '480 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(21)}', '${caseId(8)}',  'Follow up on missed appt',      CURRENT_DATE + INTERVAL '1 day',     'follow_up',              'pending', '${users.david}',    'Client no-showed ortho appointment'),
        ('${deadlineId(22)}', '${caseId(8)}',  'Surgery consult records',       CURRENT_DATE - INTERVAL '20 days',   'medical',                'pending', '${users.david}',    'Rotator cuff eval records overdue'),

        -- Case 9 (Brian Murphy - Slip/Fall, demand) - David/Jennifer
        ('${deadlineId(23)}', '${caseId(9)}',  'Statute of Limitations',        CURRENT_DATE + INTERVAL '540 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(24)}', '${caseId(9)}',  'Mediation session',             CURRENT_DATE + INTERVAL '6 days',    'other',                  'pending', '${users.jennifer}', 'Mediation at NC Dispute Resolution Center'),
        ('${deadlineId(25)}', '${caseId(9)}',  'Prepare mediation brief',       CURRENT_DATE + INTERVAL '4 days',    'filing',                 'pending', '${users.david}',    'Draft mediation statement for attorney review'),

        -- Case 10 (Kendra Washington - Dog Bite, treatment) - David/Jennifer
        ('${deadlineId(26)}', '${caseId(10)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '850 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(27)}', '${caseId(10)}', 'Plastic surgery consult',       CURRENT_DATE + INTERVAL '4 days',    'medical',                'pending', '${users.david}',    'Schedule with Dr. Park at UNC'),
        ('${deadlineId(28)}', '${caseId(10)}', 'Photo documentation update',    CURRENT_DATE - INTERVAL '7 days',    'follow_up',              'pending', '${users.david}',    'Need updated scar photos — overdue'),

        -- Case 11 (Steven Patel - Workplace, active) - David/Jennifer
        ('${deadlineId(29)}', '${caseId(11)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '420 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(30)}', '${caseId(11)}', 'Discovery responses due',       CURRENT_DATE + INTERVAL '12 days',   'discovery',              'pending', '${users.jennifer}', 'RFPs and interrogatories'),
        ('${deadlineId(31)}', '${caseId(11)}', 'OSHA citation records',         CURRENT_DATE - INTERVAL '25 days',   'follow_up',              'pending', '${users.david}',    'Requested 2 months ago — no response'),

        -- Case 12 (Amanda Price - MVA, intake) - David/Jennifer
        ('${deadlineId(32)}', '${caseId(12)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '1050 days', 'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(33)}', '${caseId(12)}', 'Request police report',         CURRENT_DATE + INTERVAL '2 days',    'follow_up',              'pending', '${users.david}',    'Need accident report from Greensboro PD'),

        -- Case 13 (Marcus Thompson - MedMal, litigation) - David/Jennifer
        ('${deadlineId(34)}', '${caseId(13)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '460 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL for med mal'),
        ('${deadlineId(35)}', '${caseId(13)}', 'Defendant deposition',          CURRENT_DATE + INTERVAL '5 days',    'deposition',             'pending', '${users.jennifer}', 'Depo of operating surgeon'),
        ('${deadlineId(36)}', '${caseId(13)}', 'Expert witness report',         CURRENT_DATE - INTERVAL '2 days',    'filing',                 'pending', '${users.david}',    'Dr. Singh report was due — follow up'),

        -- Case 14 (Jasmine Carter - MVA, active) - Maria/Robert
        ('${deadlineId(37)}', '${caseId(14)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '810 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(38)}', '${caseId(14)}', 'Police report request',         CURRENT_DATE + INTERVAL '3 days',    'follow_up',              'pending', '${users.maria}',    'Request from Raleigh PD — Uber accident'),
        ('${deadlineId(39)}', '${caseId(14)}', 'Insurance coverage check',      CURRENT_DATE - INTERVAL '10 days',   'follow_up',              'pending', '${users.maria}',    'Need to verify Uber insurance policy limits'),

        -- Case 15 (Daniel Kim - Slip/Fall, demand) - Maria/existing attorney
        ('${deadlineId(40)}', '${caseId(15)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '380 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(41)}', '${caseId(15)}', 'Mediation date',                CURRENT_DATE + INTERVAL '21 days',   'other',                  'pending', '${existingAttorney}', 'Mediation with defense at Raleigh mediation center'),
        ('${deadlineId(42)}', '${caseId(15)}', 'Settlement demand follow-up',   CURRENT_DATE - INTERVAL '14 days',   'filing',                 'pending', '${users.maria}',    'No response from defense on demand letter'),

        -- Case 16 (Brittany Adams - Dog Bite, treatment) - Maria/existing attorney
        ('${deadlineId(43)}', '${caseId(16)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '870 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(44)}', '${caseId(16)}', 'Plastic surgeon follow-up',     CURRENT_DATE + INTERVAL '6 days',    'medical',                'pending', '${users.maria}',    'Check on scar revision timeline'),

        -- Case 17 (Carlos Ramirez - MVA, active) - Maria/Robert
        ('${deadlineId(45)}', '${caseId(17)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '1020 days', 'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(46)}', '${caseId(17)}', 'Follow up with ortho',          CURRENT_DATE + INTERVAL '5 days',    'medical',                'pending', '${users.maria}',    'Pelvis fracture follow-up at Duke'),

        -- Case 18 (Heather Sullivan - Workplace, litigation) - Maria/existing attorney
        ('${deadlineId(47)}', '${caseId(18)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '350 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(48)}', '${caseId(18)}', 'Expert deposition',             CURRENT_DATE + INTERVAL '3 days',    'deposition',             'pending', '${existingAttorney}', 'Dr. Chen — occupational medicine expert'),
        ('${deadlineId(49)}', '${caseId(18)}', 'Supplemental discovery',        CURRENT_DATE - INTERVAL '4 days',    'discovery',              'pending', '${users.maria}',    'Employer supplemental production overdue'),

        -- Case 19 (Terrence Brooks - MVA, treatment) - James/existing attorney
        ('${deadlineId(50)}', '${caseId(19)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '490 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(51)}', '${caseId(19)}', 'PT progress report',            CURRENT_DATE + INTERVAL '7 days',    'medical',                'pending', '${users.james}',    'Request 90-day PT progress report'),
        ('${deadlineId(52)}', '${caseId(19)}', 'Discovery responses due',       CURRENT_DATE + INTERVAL '18 days',   'discovery',              'pending', '${existingAttorney}', 'Defendant interrogatories'),

        -- Case 20 (Samantha Reed - Slip/Fall, active) - James/existing attorney
        ('${deadlineId(53)}', '${caseId(20)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '780 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(54)}', '${caseId(20)}', 'Follow up with client',         CURRENT_DATE + INTERVAL '1 day',     'follow_up',              'pending', '${users.james}',    'Check treatment status and pain levels'),

        -- Case 21 (Jerome Washington - MedMal, litigation) - James/Jennifer
        ('${deadlineId(55)}', '${caseId(21)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '370 days',  'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL for med mal'),
        ('${deadlineId(56)}', '${caseId(21)}', 'Oncologist deposition',         CURRENT_DATE + INTERVAL '8 days',    'deposition',             'pending', '${users.jennifer}', 'Depo of treating oncologist'),
        ('${deadlineId(57)}', '${caseId(21)}', 'Medical chronology update',     CURRENT_DATE - INTERVAL '6 days',    'follow_up',              'pending', '${users.james}',    'Chronology needs updating with latest records'),

        -- Case 22 (Michelle Cooper - MVA, intake) - James/Jennifer
        ('${deadlineId(58)}', '${caseId(22)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '1060 days', 'statute_of_limitations', 'pending', '${users.jennifer}', '3-year SOL'),
        ('${deadlineId(59)}', '${caseId(22)}', 'Initial records requests',      CURRENT_DATE + INTERVAL '3 days',    'follow_up',              'pending', '${users.james}',    'Send out ER, imaging, and PCP records requests'),

        -- Case 23 (Andre Harris - Workplace, treatment) - Ashley/Robert
        ('${deadlineId(60)}', '${caseId(23)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '570 days',  'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(61)}', '${caseId(23)}', 'IME report due',                CURRENT_DATE + INTERVAL '4 days',    'medical',                'pending', '${users.ashley}',   'Independent medical exam results expected'),
        ('${deadlineId(62)}', '${caseId(23)}', 'Discovery responses due',       CURRENT_DATE + INTERVAL '15 days',   'discovery',              'pending', '${users.robert}',   'Written discovery responses'),

        -- Case 24 (Lisa Nguyen - MVA, active) - Ashley/Robert
        ('${deadlineId(63)}', '${caseId(24)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '1010 days', 'statute_of_limitations', 'pending', '${users.robert}',   '3-year SOL'),
        ('${deadlineId(64)}', '${caseId(24)}', 'UM/UIM claim filing',           CURRENT_DATE + INTERVAL '7 days',    'filing',                 'pending', '${users.ashley}',   'File uninsured motorist claim with client carrier'),
        ('${deadlineId(65)}', '${caseId(24)}', 'Records request follow-up',     CURRENT_DATE - INTERVAL '9 days',    'follow_up',              'pending', '${users.ashley}',   'CMC records request outstanding'),

        -- Case 25 (Derek Palmer - Slip/Fall, demand) - Ashley/existing attorney
        ('${deadlineId(66)}', '${caseId(25)}', 'Statute of Limitations',        CURRENT_DATE + INTERVAL '500 days',  'statute_of_limitations', 'pending', '${existingAttorney}', '3-year SOL'),
        ('${deadlineId(67)}', '${caseId(25)}', 'Mediation prep',                CURRENT_DATE + INTERVAL '10 days',   'other',                  'pending', '${users.ashley}',   'Prepare mediation statement and exhibits'),
        ('${deadlineId(68)}', '${caseId(25)}', 'Demand response deadline',      CURRENT_DATE - INTERVAL '18 days',   'filing',                 'pending', '${existingAttorney}', 'Defense 30-day response window expired'),

        -- Case 26 (James Thompson - closed MVA)
        ('${deadlineId(69)}', '${caseId(26)}', 'Statute of Limitations',        CURRENT_DATE - INTERVAL '35 days',   'statute_of_limitations', 'completed', '${users.robert}',   'Case settled before SOL'),
        ('${deadlineId(70)}', '${caseId(26)}', 'Final disbursement',            CURRENT_DATE - INTERVAL '30 days',   'follow_up',              'completed', '${users.sarah}',    'Settlement funds distributed'),

        -- Case 27 (Linda Martinez - closed Slip/Fall)
        ('${deadlineId(71)}', '${caseId(27)}', 'Statute of Limitations',        CURRENT_DATE - INTERVAL '15 days',   'statute_of_limitations', 'completed', '${users.jennifer}', 'Case settled before SOL'),
        ('${deadlineId(72)}', '${caseId(27)}', 'Final disbursement',            CURRENT_DATE - INTERVAL '10 days',   'follow_up',              'completed', '${users.david}',    'Settlement funds distributed'),

        -- Case 28 (Kevin Wright - closed Workplace)
        ('${deadlineId(73)}', '${caseId(28)}', 'Statute of Limitations',        CURRENT_DATE - INTERVAL '5 days',    'statute_of_limitations', 'completed', '${existingAttorney}', 'Case settled before SOL'),
        ('${deadlineId(74)}', '${caseId(28)}', 'WC lien resolution',            CURRENT_DATE - INTERVAL '20 days',   'follow_up',              'completed', '${users.maria}',    'Workers comp lien resolved'),

        -- Extra deadlines to reach ~80
        ('${deadlineId(75)}', '${caseId(1)}',  'Client treatment update call',  CURRENT_DATE + INTERVAL '6 days',    'follow_up',              'pending', '${users.sarah}',    'Weekly check-in with client'),
        ('${deadlineId(76)}', '${caseId(5)}',  'Defense expert deposition',     CURRENT_DATE + INTERVAL '14 days',   'deposition',             'pending', '${users.robert}',   'Depo of defense safety expert'),
        ('${deadlineId(77)}', '${caseId(8)}',  'Surgery scheduling follow-up',  CURRENT_DATE - INTERVAL '11 days',   'medical',                'pending', '${users.david}',    'Client was supposed to schedule surgery'),
        ('${deadlineId(78)}', '${caseId(13)}', 'Motion for sanctions',          CURRENT_DATE + INTERVAL '9 days',    'filing',                 'pending', '${users.jennifer}', 'Defense withholding surgical records'),
        ('${deadlineId(79)}', '${caseId(17)}', 'Motorcycle damage appraisal',   CURRENT_DATE + INTERVAL '4 days',    'follow_up',              'pending', '${users.maria}',    'Property damage documentation needed'),
        ('${deadlineId(80)}', '${caseId(21)}', 'File motion to compel',         CURRENT_DATE + INTERVAL '2 days',    'filing',                 'pending', '${users.jennifer}', 'Defendant refusing to produce cancer screening records')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Deadlines seeded (80)');

    // ===================== RECORDS REQUESTS (~50) =====================
    await client.query(`
      INSERT INTO records_requests (id, case_id, provider_name, request_type, requested_date, received_date, status, notes) VALUES
        ('${recordId(1)}',  '${caseId(1)}',  'WakeMed Trauma Center',           'Emergency Records',  CURRENT_DATE - INTERVAL '40 days',  CURRENT_DATE - INTERVAL '20 days', 'received',  'Complete trauma and ER records received'),
        ('${recordId(2)}',  '${caseId(1)}',  'Raleigh Neurosurgery Associates',  'Medical Records',    CURRENT_DATE - INTERVAL '30 days',  NULL,                               'sent',      'Requested surgical consult notes'),
        ('${recordId(3)}',  '${caseId(1)}',  'State Farm Insurance',             'Insurance Records',  CURRENT_DATE - INTERVAL '90 days',  NULL,                               'follow_up', 'Third request — no response from adjuster'),

        ('${recordId(4)}',  '${caseId(2)}',  'Triangle Orthopedics',             'Medical Records',    CURRENT_DATE - INTERVAL '80 days',  CURRENT_DATE - INTERVAL '50 days', 'received',  'Hip evaluation and imaging records'),
        ('${recordId(5)}',  '${caseId(2)}',  'Blue Cross Blue Shield NC',        'Billing Records',    CURRENT_DATE - INTERVAL '75 days',  NULL,                               'follow_up', 'Billing summary still outstanding'),

        ('${recordId(6)}',  '${caseId(3)}',  'Durham Regional Hospital',         'Emergency Records',  CURRENT_DATE - INTERVAL '170 days', CURRENT_DATE - INTERVAL '140 days','received',  'ER visit records for whiplash'),
        ('${recordId(7)}',  '${caseId(3)}',  'Spine Center of the Carolinas',    'Medical Records',    CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE - INTERVAL '90 days', 'received',  'MRI and herniation diagnosis records'),
        ('${recordId(8)}',  '${caseId(3)}',  'NC Highway Patrol',                'Police Report',      CURRENT_DATE - INTERVAL '175 days', CURRENT_DATE - INTERVAL '160 days','received',  'Accident report obtained — defendant at fault'),

        ('${recordId(9)}',  '${caseId(4)}',  'Rex Hospital Emergency',           'Emergency Records',  CURRENT_DATE - INTERVAL '25 days',  NULL,                               'sent',      'ER records for dog bite treatment'),
        ('${recordId(10)}', '${caseId(4)}',  'Wake County Animal Control',       'Police Report',      CURRENT_DATE - INTERVAL '28 days',  CURRENT_DATE - INTERVAL '15 days', 'received',  'Bite report and animal history on file'),

        ('${recordId(11)}', '${caseId(5)}',  'Vidant Medical Center',            'Surgical Records',   CURRENT_DATE - INTERVAL '280 days', CURRENT_DATE - INTERVAL '240 days','received',  'Spinal surgery records complete'),
        ('${recordId(12)}', '${caseId(5)}',  'NC OSHA',                          'Insurance Records',  CURRENT_DATE - INTERVAL '100 days', NULL,                               'follow_up', 'OSHA citation and investigation records requested'),
        ('${recordId(13)}', '${caseId(5)}',  'Eastern NC Rehab Center',          'Medical Records',    CURRENT_DATE - INTERVAL '60 days',  NULL,                               'sent',      'Rehab and PT records'),

        ('${recordId(14)}', '${caseId(6)}',  'UNC Medical Center ICU',           'Medical Records',    CURRENT_DATE - INTERVAL '190 days', NULL,                               'follow_up', 'ICU records for sepsis treatment — 4th request'),
        ('${recordId(15)}', '${caseId(6)}',  'WakeMed Surgical Department',      'Surgical Records',   CURRENT_DATE - INTERVAL '195 days', CURRENT_DATE - INTERVAL '170 days','received',  'Original appendectomy records'),

        ('${recordId(16)}', '${caseId(7)}',  'WakeMed Emergency',                'Emergency Records',  CURRENT_DATE - INTERVAL '30 days',  NULL,                               'sent',      'ER records from accident date'),
        ('${recordId(17)}', '${caseId(7)}',  'Raleigh PD',                       'Police Report',      CURRENT_DATE - INTERVAL '32 days',  NULL,                               'pending',   'Multi-vehicle accident report requested'),

        ('${recordId(18)}', '${caseId(8)}',  'Duke Orthopedic Surgery',          'Medical Records',    CURRENT_DATE - INTERVAL '240 days', CURRENT_DATE - INTERVAL '200 days','received',  'Rotator cuff evaluation records'),
        ('${recordId(19)}', '${caseId(8)}',  'Raleigh Physical Therapy',         'Medical Records',    CURRENT_DATE - INTERVAL '65 days',  NULL,                               'sent',      'PT records for shoulder rehab'),

        ('${recordId(20)}', '${caseId(9)}',  'Novant Health Orthopedics',        'Medical Records',    CURRENT_DATE - INTERVAL '140 days', CURRENT_DATE - INTERVAL '100 days','received',  'Ankle fracture treatment records'),
        ('${recordId(21)}', '${caseId(9)}',  'Charlotte Imaging Center',         'Medical Records',    CURRENT_DATE - INTERVAL '130 days', CURRENT_DATE - INTERVAL '95 days', 'received',  'X-ray and MRI imaging records'),

        ('${recordId(22)}', '${caseId(10)}', 'UNC Pediatric Surgery',            'Medical Records',    CURRENT_DATE - INTERVAL '110 days', NULL,                               'sent',      'Facial reconstruction consult records'),
        ('${recordId(23)}', '${caseId(10)}', 'Wake County Animal Services',      'Police Report',      CURRENT_DATE - INTERVAL '115 days', CURRENT_DATE - INTERVAL '100 days','received',  'Bite report — dog had prior incident'),

        ('${recordId(24)}', '${caseId(11)}', 'WakeMed Burn Center',              'Emergency Records',  CURRENT_DATE - INTERVAL '260 days', CURRENT_DATE - INTERVAL '230 days','received',  'Chemical burn treatment records'),
        ('${recordId(25)}', '${caseId(11)}', 'NC Dept of Labor',                 'Insurance Records',  CURRENT_DATE - INTERVAL '80 days',  NULL,                               'pending',   'OSHA citation records for chemical safety violations'),

        ('${recordId(26)}', '${caseId(12)}', 'Moses Cone Hospital',              'Emergency Records',  CURRENT_DATE - INTERVAL '35 days',  NULL,                               'pending',   'ER records from accident date'),
        ('${recordId(27)}', '${caseId(12)}', 'Greensboro PD',                    'Police Report',      CURRENT_DATE - INTERVAL '38 days',  NULL,                               'sent',      'Intersection accident report'),

        ('${recordId(28)}', '${caseId(13)}', 'Atrium Health Surgery',            'Surgical Records',   CURRENT_DATE - INTERVAL '200 days', CURRENT_DATE - INTERVAL '170 days','received',  'Both gallbladder and corrective surgery records'),
        ('${recordId(29)}', '${caseId(13)}', 'Charlotte Gastroenterology',       'Medical Records',    CURRENT_DATE - INTERVAL '70 days',  NULL,                               'follow_up', 'Post-operative treatment records overdue'),

        ('${recordId(30)}', '${caseId(14)}', 'WakeMed Emergency',                'Emergency Records',  CURRENT_DATE - INTERVAL '55 days',  NULL,                               'sent',      'ER records for neck and back treatment'),
        ('${recordId(31)}', '${caseId(14)}', 'Raleigh PD',                       'Police Report',      CURRENT_DATE - INTERVAL '58 days',  NULL,                               'pending',   'Uber accident report — pending investigation'),

        ('${recordId(32)}', '${caseId(15)}', 'Wake Ortho & Sports Medicine',     'Medical Records',    CURRENT_DATE - INTERVAL '320 days', CURRENT_DATE - INTERVAL '280 days','received',  'Wrist fracture treatment records'),
        ('${recordId(33)}', '${caseId(15)}', 'Property Management Co Records',   'Insurance Records',  CURRENT_DATE - INTERVAL '300 days', CURRENT_DATE - INTERVAL '260 days','received',  'Landlord maintenance complaint history'),

        ('${recordId(34)}', '${caseId(16)}', 'Rex Plastic Surgery',              'Medical Records',    CURRENT_DATE - INTERVAL '130 days', NULL,                               'sent',      'Bite wound treatment and scar assessment'),

        ('${recordId(35)}', '${caseId(17)}', 'Duke Trauma Center',               'Emergency Records',  CURRENT_DATE - INTERVAL '45 days',  NULL,                               'sent',      'ER records for pelvis and shoulder injuries'),
        ('${recordId(36)}', '${caseId(17)}', 'NC Highway Patrol',                'Police Report',      CURRENT_DATE - INTERVAL '48 days',  NULL,                               'pending',   'Motorcycle accident report pending'),

        ('${recordId(37)}', '${caseId(18)}', 'Duke Hand & Upper Extremity',      'Medical Records',    CURRENT_DATE - INTERVAL '280 days', CURRENT_DATE - INTERVAL '250 days','received',  'Carpal tunnel diagnosis and EMG results'),
        ('${recordId(38)}', '${caseId(18)}', 'Employer Safety Records',          'Insurance Records',  CURRENT_DATE - INTERVAL '100 days', NULL,                               'follow_up', 'Employer refusing to produce ergonomic assessments'),

        ('${recordId(39)}', '${caseId(19)}', 'UNC Physical Therapy',             'Medical Records',    CURRENT_DATE - INTERVAL '220 days', CURRENT_DATE - INTERVAL '180 days','received',  'PT records for knee and rib recovery'),
        ('${recordId(40)}', '${caseId(19)}', 'WakeMed Imaging',                  'Medical Records',    CURRENT_DATE - INTERVAL '70 days',  NULL,                               'sent',      'Updated imaging for knee follow-up'),

        ('${recordId(41)}', '${caseId(20)}', 'Parking Garage Management',        'Insurance Records',  CURRENT_DATE - INTERVAL '75 days',  NULL,                               'pending',   'Incident report and maintenance logs'),

        ('${recordId(42)}', '${caseId(21)}', 'Duke Cancer Center',               'Medical Records',    CURRENT_DATE - INTERVAL '300 days', CURRENT_DATE - INTERVAL '270 days','received',  'Cancer screening and treatment records'),
        ('${recordId(43)}', '${caseId(21)}', 'Primary Care Associates',          'Medical Records',    CURRENT_DATE - INTERVAL '90 days',  NULL,                               'follow_up', 'PCP records showing missed referrals — overdue'),

        ('${recordId(44)}', '${caseId(22)}', 'Rex Hospital ER',                  'Emergency Records',  CURRENT_DATE - INTERVAL '28 days',  NULL,                               'sent',      'ER records for neck pain and headaches'),

        ('${recordId(45)}', '${caseId(23)}', 'Duke Spine Center',                'Medical Records',    CURRENT_DATE - INTERVAL '150 days', NULL,                               'follow_up', 'Herniated disc evaluation — over 60 days outstanding'),
        ('${recordId(46)}', '${caseId(23)}', 'Construction Site Safety Report',  'Insurance Records',  CURRENT_DATE - INTERVAL '155 days', CURRENT_DATE - INTERVAL '120 days','received',  'OSHA inspection and employer safety records'),

        ('${recordId(47)}', '${caseId(24)}', 'Carolinas Medical Center',         'Emergency Records',  CURRENT_DATE - INTERVAL '50 days',  NULL,                               'sent',      'ER records for shoulder and cervical injuries'),
        ('${recordId(48)}', '${caseId(24)}', 'Client Auto Insurance (GEICO)',    'Insurance Records',  CURRENT_DATE - INTERVAL '45 days',  NULL,                               'pending',   'UM/UIM policy verification'),

        ('${recordId(49)}', '${caseId(25)}', 'Rex Orthopedics',                  'Medical Records',    CURRENT_DATE - INTERVAL '230 days', CURRENT_DATE - INTERVAL '195 days','received',  'Elbow fracture and shoulder surgery records'),
        ('${recordId(50)}', '${caseId(25)}', 'City of Greensboro',               'Insurance Records',  CURRENT_DATE - INTERVAL '235 days', CURRENT_DATE - INTERVAL '200 days','received',  'Sidewalk maintenance complaint records')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Records requests seeded (50)');

    // ===================== ATTORNEY REQUESTS (~35) =====================
    await client.query(`
      INSERT INTO attorney_requests (id, case_id, requested_by, priority, title, description, status, due_date) VALUES
        ('${attReqId(1)}',  '${caseId(1)}',  '${users.robert}',   'critical', 'Review trauma records and assess damages',          'Client has TBI and multiple fractures — need comprehensive damages assessment',                      'in_progress', CURRENT_DATE + INTERVAL '5 days'),
        ('${attReqId(2)}',  '${caseId(1)}',  '${users.robert}',   'high',     'Prepare settlement breakdown',                      'Itemize all medical specials, lost wages, and pain and suffering estimate',                           'open',        CURRENT_DATE + INTERVAL '14 days'),
        ('${attReqId(3)}',  '${caseId(2)}',  '${users.robert}',   'standard', 'Review premises liability claim',                   'Evaluate duty of care and notice requirements for mall slip and fall',                                'open',        CURRENT_DATE + INTERVAL '21 days'),
        ('${attReqId(4)}',  '${caseId(3)}',  '${users.robert}',   'high',     'Draft demand letter',                               'All records compiled — need demand letter with full damages calculation for herniated disc case',     'in_progress', CURRENT_DATE + INTERVAL '7 days'),
        ('${attReqId(5)}',  '${caseId(4)}',  '${users.robert}',   'standard', 'Research NC dog bite strict liability',              'Review NC one-bite rule and local ordinances for pit bull cases',                                     'open',        CURRENT_DATE + INTERVAL '14 days'),
        ('${attReqId(6)}',  '${caseId(5)}',  '${users.robert}',   'critical', 'Deposition preparation — client',                   'Prepare client for upcoming deposition. Review key facts and anticipated questions',                  'in_progress', CURRENT_DATE + INTERVAL '5 days'),
        ('${attReqId(7)}',  '${caseId(5)}',  '${users.robert}',   'high',     'File motion for sanctions',                         'Defense counsel failing to produce OSHA documents despite court order',                               'open',        CURRENT_DATE + INTERVAL '10 days'),
        ('${attReqId(8)}',  '${caseId(6)}',  '${users.jennifer}', 'critical', 'Review expert medical report',                      'Expert report on standard of care for appendicitis diagnosis needs attorney review',                 'in_progress', CURRENT_DATE + INTERVAL '8 days'),
        ('${attReqId(9)}',  '${caseId(7)}',  '${users.robert}',   'standard', 'Initial case evaluation',                           'Review intake documents and determine case viability for multi-vehicle pileup',                       'open',        CURRENT_DATE + INTERVAL '10 days'),
        ('${attReqId(10)}', '${caseId(8)}',  '${users.jennifer}', 'high',     'Review surgical recommendation',                    'Ortho recommending rotator cuff surgery — need to evaluate impact on case value',                     'in_progress', CURRENT_DATE + INTERVAL '7 days'),
        ('${attReqId(11)}', '${caseId(9)}',  '${users.jennifer}', 'critical', 'Prepare mediation brief',                           'Mediation in 6 days — need comprehensive mediation statement with damages summary',                  'in_progress', CURRENT_DATE + INTERVAL '4 days'),
        ('${attReqId(12)}', '${caseId(10)}', '${users.jennifer}', 'high',     'Evaluate future medical damages',                   'Child will need multiple reconstructive surgeries — need life care plan assessment',                 'open',        CURRENT_DATE + INTERVAL '21 days'),
        ('${attReqId(13)}', '${caseId(11)}', '${users.jennifer}', 'standard', 'Review discovery responses',                        'Defendant employer discovery responses need review for completeness',                                 'open',        CURRENT_DATE + INTERVAL '14 days'),
        ('${attReqId(14)}', '${caseId(12)}', '${users.jennifer}', 'deferred', 'Case strategy meeting',                             'Schedule initial strategy meeting once police report and ER records received',                        'open',        CURRENT_DATE + INTERVAL '30 days'),
        ('${attReqId(15)}', '${caseId(13)}', '${users.jennifer}', 'critical', 'Deposition prep — defendant surgeon',               'Prepare cross-examination outline for operating surgeon deposition',                                 'in_progress', CURRENT_DATE + INTERVAL '3 days'),
        ('${attReqId(16)}', '${caseId(14)}', '${users.robert}',   'high',     'Uber insurance coverage analysis',                  'Multiple insurance carriers involved — need coverage analysis and priority determination',           'in_progress', CURRENT_DATE + INTERVAL '10 days'),
        ('${attReqId(17)}', '${caseId(15)}', '${existingAttorney}', 'standard', 'Prepare mediation statement',                     'Draft mediation statement for premises liability case — strong liability facts',                     'in_progress', CURRENT_DATE + INTERVAL '18 days'),
        ('${attReqId(18)}', '${caseId(16)}', '${existingAttorney}', 'deferred', 'Research dog bite damages precedent',              'Find NC appellate cases on facial scarring damages for dog bite victims',                            'open',        CURRENT_DATE + INTERVAL '30 days'),
        ('${attReqId(19)}', '${caseId(17)}', '${users.robert}',   'standard', 'Review police report when received',                'Need to assess liability once HP report comes in — motorcycle vs truck',                              'open',        CURRENT_DATE + INTERVAL '14 days'),
        ('${attReqId(20)}', '${caseId(18)}', '${existingAttorney}', 'high',   'Expert deposition prep',                            'Prepare questions for occupational medicine expert deposition',                                       'in_progress', CURRENT_DATE + INTERVAL '2 days'),
        ('${attReqId(21)}', '${caseId(19)}', '${existingAttorney}', 'standard', 'Review PT progress report',                       'Evaluate whether client has reached MMI based on latest PT progress notes',                          'open',        CURRENT_DATE + INTERVAL '14 days'),
        ('${attReqId(22)}', '${caseId(20)}', '${existingAttorney}', 'deferred', 'Investigate parking garage liability',             'Research NC premises liability for commercial parking garages — duty to maintain',                   'open',        CURRENT_DATE + INTERVAL '28 days'),
        ('${attReqId(23)}', '${caseId(21)}', '${users.jennifer}', 'high',     'File motion to compel medical records',             'Defendant hospital refusing to produce cancer screening protocols',                                  'in_progress', CURRENT_DATE + INTERVAL '3 days'),
        ('${attReqId(24)}', '${caseId(22)}', '${users.jennifer}', 'standard', 'Review intake and prior medical history',           'Client has prior neck issues — need to evaluate pre-existing condition defense',                     'open',        CURRENT_DATE + INTERVAL '10 days'),
        ('${attReqId(25)}', '${caseId(23)}', '${users.robert}',   'high',     'Review IME report',                                 'Defense IME report expected — need to compare with treating physician opinions',                     'open',        CURRENT_DATE + INTERVAL '7 days'),
        ('${attReqId(26)}', '${caseId(24)}', '${users.robert}',   'standard', 'Uninsured motorist claim strategy',                 'Client carrier GEICO — need to file UM/UIM claim and evaluate arbitration vs litigation',           'in_progress', CURRENT_DATE + INTERVAL '10 days'),
        ('${attReqId(27)}', '${caseId(25)}', '${existingAttorney}', 'deferred', 'Review mediation demand amount',                  'Finalize settlement demand range before mediation — strong liability case',                          'open',        CURRENT_DATE + INTERVAL '8 days'),
        ('${attReqId(28)}', '${caseId(3)}',  '${users.robert}',   'standard', 'Review defense response to demand',                 'Defense counsel expected to respond — prepare counterarguments',                                      'open',        CURRENT_DATE + INTERVAL '21 days'),
        ('${attReqId(29)}', '${caseId(6)}',  '${users.jennifer}', 'high',     'Prepare for summary judgment motion',               'Research med mal standard of care arguments for opposition brief',                                   'open',        CURRENT_DATE + INTERVAL '30 days'),
        ('${attReqId(30)}', '${caseId(9)}',  '${users.jennifer}', 'standard', 'Settlement authority discussion',                   'Need to discuss settlement range with client before mediation',                                       'completed',   CURRENT_DATE - INTERVAL '3 days'),
        ('${attReqId(31)}', '${caseId(11)}', '${users.jennifer}', 'deferred', 'OSHA regulation research',                          'Research applicable OSHA chemical safety regulations for trial preparation',                         'open',        CURRENT_DATE + INTERVAL '45 days'),
        ('${attReqId(32)}', '${caseId(15)}', '${existingAttorney}', 'standard', 'Landlord notice documentation',                   'Compile evidence of prior complaints to landlord about staircase',                                   'completed',   CURRENT_DATE - INTERVAL '10 days'),
        ('${attReqId(33)}', '${caseId(18)}', '${existingAttorney}', 'high',   'Workers comp lien analysis',                        'Review WC lien amount and negotiate reduction before settlement',                                    'completed',   CURRENT_DATE - INTERVAL '5 days'),
        ('${attReqId(34)}', '${caseId(21)}', '${users.jennifer}', 'standard', 'Prepare trial exhibit list',                        'Organize medical records chronologically for trial exhibit binder',                                  'completed',   CURRENT_DATE - INTERVAL '7 days'),
        ('${attReqId(35)}', '${caseId(25)}', '${existingAttorney}', 'high',   'Draft settlement demand letter',                    'Prepare comprehensive demand with medical specials summary for sidewalk fall case',                  'completed',   CURRENT_DATE - INTERVAL '15 days')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Attorney requests seeded (35)');

    // ===================== TREATMENTS (~40) =====================
    await client.query(`
      INSERT INTO treatments (id, case_id, provider_name, treatment_type, start_date, end_date, status, notes) VALUES
        ('${treatmentId(1)}',  '${caseId(1)}',  'WakeMed Trauma Center',          'Emergency Care',     '2025-06-15', '2025-06-15', 'completed', 'Airlifted to trauma center — stabilized, imaging, admitted for 5 days'),
        ('${treatmentId(2)}',  '${caseId(1)}',  'Raleigh Neurosurgery Associates', 'Surgery',           '2025-07-01', '2025-07-01', 'completed', 'Spinal fusion surgery L4-L5'),
        ('${treatmentId(3)}',  '${caseId(1)}',  'Duke Physical Therapy',          'Physical Therapy',   '2025-07-20', NULL,         'active',    'Post-surgical PT 3x per week'),

        ('${treatmentId(4)}',  '${caseId(2)}',  'Triangle Orthopedics',           'Orthopedic',         '2025-05-25', NULL,         'active',    'Hip contusion evaluation and treatment'),
        ('${treatmentId(5)}',  '${caseId(2)}',  'Rex Physical Therapy',           'Physical Therapy',   '2025-06-10', NULL,         'active',    'Lower back rehab 2x per week'),

        ('${treatmentId(6)}',  '${caseId(3)}',  'Durham Regional Hospital',       'Emergency Care',     '2025-03-10', '2025-03-10', 'completed', 'ER visit — cervical collar applied, pain management'),
        ('${treatmentId(7)}',  '${caseId(3)}',  'Spine Center of the Carolinas',  'MRI/Imaging',        '2025-03-25', '2025-03-25', 'completed', 'MRI confirmed C5-C6 herniation'),
        ('${treatmentId(8)}',  '${caseId(3)}',  'Carolina Pain Management',       'Pain Management',    '2025-04-15', NULL,         'active',    'Epidural steroid injections series — 3 of 3 completed'),

        ('${treatmentId(9)}',  '${caseId(4)}',  'Rex Hospital Emergency',         'Emergency Care',     '2025-07-01', '2025-07-01', 'completed', 'ER treatment for deep lacerations — sutures and antibiotics'),

        ('${treatmentId(10)}', '${caseId(5)}',  'Vidant Medical Center',          'Surgery',            '2025-01-30', '2025-01-30', 'completed', 'Emergency spinal decompression surgery'),
        ('${treatmentId(11)}', '${caseId(5)}',  'Eastern NC Rehab Center',        'Physical Therapy',   '2025-03-01', NULL,         'active',    'Intensive spinal cord rehab — 5x per week'),

        ('${treatmentId(12)}', '${caseId(6)}',  'WakeMed Surgical Department',    'Surgery',            '2025-04-15', '2025-04-15', 'completed', 'Emergency appendectomy that led to sepsis'),
        ('${treatmentId(13)}', '${caseId(6)}',  'UNC Medical Center ICU',         'Emergency Care',     '2025-04-16', '2025-04-30', 'completed', '14-day ICU stay for sepsis treatment'),

        ('${treatmentId(14)}', '${caseId(7)}',  'WakeMed Emergency',              'Emergency Care',     '2025-08-05', '2025-08-05', 'completed', 'ER visit — shoulder and chest X-rays, pain management'),
        ('${treatmentId(15)}', '${caseId(7)}',  'Raleigh Orthopedics',            'Orthopedic',         '2025-08-20', NULL,         'scheduled', 'Initial ortho consult scheduled'),

        ('${treatmentId(16)}', '${caseId(8)}',  'Duke Orthopedic Surgery',        'Orthopedic',         '2025-03-01', NULL,         'active',    'Rotator cuff evaluation — surgery recommended'),
        ('${treatmentId(17)}', '${caseId(8)}',  'Raleigh Physical Therapy',       'Physical Therapy',   '2025-04-01', NULL,         'active',    'Pre-surgical PT to maintain range of motion'),

        ('${treatmentId(18)}', '${caseId(9)}',  'Novant Health Orthopedics',      'Orthopedic',         '2025-06-10', '2025-08-15', 'completed', 'Ankle fracture treatment — cast and follow-up'),
        ('${treatmentId(19)}', '${caseId(9)}',  'Charlotte Physical Therapy',     'Physical Therapy',   '2025-08-20', NULL,         'active',    'Post-fracture ankle rehabilitation'),

        ('${treatmentId(20)}', '${caseId(10)}', 'UNC Pediatric Surgery',          'Surgery',            '2025-05-01', '2025-05-01', 'completed', 'Initial wound closure and debridement'),
        ('${treatmentId(21)}', '${caseId(10)}', 'UNC Plastic Surgery',            'Surgery',            '2025-09-15', NULL,         'scheduled', 'Scar revision surgery planned'),

        ('${treatmentId(22)}', '${caseId(11)}', 'WakeMed Burn Center',            'Emergency Care',     '2025-03-05', '2025-03-12', 'completed', 'Chemical burn treatment — 7-day admission'),
        ('${treatmentId(23)}', '${caseId(11)}', 'Duke Dermatology',               'MRI/Imaging',        '2025-04-01', '2025-04-01', 'completed', 'Skin graft evaluation and imaging'),

        ('${treatmentId(24)}', '${caseId(12)}', 'Moses Cone Hospital ER',         'Emergency Care',     '2025-07-10', '2025-07-10', 'completed', 'ER visit — knee and hip X-rays, discharged same day'),

        ('${treatmentId(25)}', '${caseId(13)}', 'Atrium Health Surgery',          'Surgery',            '2025-05-20', '2025-05-20', 'completed', 'Corrective surgery to remove retained sponge'),
        ('${treatmentId(26)}', '${caseId(13)}', 'Charlotte Gastroenterology',     'Pain Management',    '2025-06-15', NULL,         'active',    'Post-surgical pain management and monitoring'),

        ('${treatmentId(27)}', '${caseId(14)}', 'WakeMed Emergency',              'Emergency Care',     '2025-06-20', '2025-06-20', 'completed', 'ER visit for neck and back pain after Uber accident'),
        ('${treatmentId(28)}', '${caseId(14)}', 'Capital Chiropractic',           'Chiropractic',       '2025-07-01', NULL,         'active',    'Chiropractic adjustments 3x per week'),

        ('${treatmentId(29)}', '${caseId(15)}', 'Wake Ortho & Sports Medicine',   'Orthopedic',         '2025-02-10', '2025-06-15', 'completed', 'Wrist fracture treatment — cast and follow-up'),

        ('${treatmentId(30)}', '${caseId(16)}', 'Rex Plastic Surgery',            'Surgery',            '2025-06-01', '2025-06-01', 'completed', 'Initial wound repair for bite injuries'),
        ('${treatmentId(31)}', '${caseId(16)}', 'Triangle Wound Care',            'Pain Management',    '2025-06-15', NULL,         'active',    'Ongoing wound care and nerve damage monitoring'),

        ('${treatmentId(32)}', '${caseId(17)}', 'Duke Trauma Center',             'Emergency Care',     '2025-07-15', '2025-07-20', 'completed', 'ER and 5-day admission for pelvis fracture'),
        ('${treatmentId(33)}', '${caseId(17)}', 'Duke Orthopedics',               'Orthopedic',         '2025-08-01', NULL,         'active',    'Pelvis fracture follow-up and shoulder rehab'),

        ('${treatmentId(34)}', '${caseId(18)}', 'Duke Hand & Upper Extremity',    'Surgery',            '2025-06-01', '2025-06-01', 'completed', 'Carpal tunnel release surgery — bilateral'),
        ('${treatmentId(35)}', '${caseId(18)}', 'Raleigh PT & Rehab',             'Physical Therapy',   '2025-07-01', NULL,         'active',    'Post-surgical hand therapy 2x per week'),

        ('${treatmentId(36)}', '${caseId(19)}', 'UNC Orthopedics',                'Orthopedic',         '2025-05-01', '2025-08-01', 'completed', 'Knee surgery and rib healing follow-up'),
        ('${treatmentId(37)}', '${caseId(19)}', 'UNC Physical Therapy',           'Physical Therapy',   '2025-06-01', NULL,         'active',    'Knee rehab and core strengthening 3x per week'),

        ('${treatmentId(38)}', '${caseId(20)}', 'WakeMed Urgent Care',            'Emergency Care',     '2025-06-05', '2025-06-05', 'completed', 'Urgent care for back strain and concussion eval'),

        ('${treatmentId(39)}', '${caseId(23)}', 'Duke Spine Center',              'Orthopedic',         '2025-06-01', NULL,         'active',    'Herniated disc evaluation — considering surgical options'),
        ('${treatmentId(40)}', '${caseId(25)}', 'Rex Orthopedics',                'Orthopedic',         '2025-04-20', '2025-09-01', 'completed', 'Elbow fracture and rotator cuff repair')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Treatments seeded (40)');

    // ===================== CONTACT LOG (~45) =====================
    await client.query(`
      INSERT INTO contact_log (id, case_id, contact_type, contact_date, notes, logged_by) VALUES
        ('${contactId(1)}',  '${caseId(1)}',  'phone',     CURRENT_DATE - INTERVAL '1 day',   'Called client — PT going well, pain levels decreasing. Still using walker.',                    '${users.sarah}'),
        ('${contactId(2)}',  '${caseId(1)}',  'email',     CURRENT_DATE - INTERVAL '5 days',  'Sent medical records authorization forms for neurosurgeon.',                                    '${users.sarah}'),
        ('${contactId(3)}',  '${caseId(2)}',  'phone',     CURRENT_DATE - INTERVAL '2 days',  'Client update — hip still painful, ortho wants to try injection before considering surgery.',   '${users.sarah}'),
        ('${contactId(4)}',  '${caseId(2)}',  'text',      CURRENT_DATE - INTERVAL '8 days',  'Texted client reminder about upcoming ortho appointment.',                                      '${users.sarah}'),
        ('${contactId(5)}',  '${caseId(3)}',  'email',     CURRENT_DATE - INTERVAL '3 days',  'Sent demand package draft to attorney for review.',                                             '${users.sarah}'),
        ('${contactId(6)}',  '${caseId(4)}',  'phone',     CURRENT_DATE - INTERVAL '1 day',   'Initial call with client about dog bite — gathering witness information.',                       '${users.sarah}'),
        ('${contactId(7)}',  '${caseId(5)}',  'in_person', CURRENT_DATE - INTERVAL '4 days',  'Met with client to prepare for deposition. Reviewed key timeline and documents.',                '${users.sarah}'),
        ('${contactId(8)}',  '${caseId(5)}',  'phone',     CURRENT_DATE - INTERVAL '10 days', 'Called OSHA investigator — report still being finalized.',                                       '${users.sarah}'),
        ('${contactId(9)}',  '${caseId(6)}',  'email',     CURRENT_DATE - INTERVAL '6 days',  'Emailed expert witness with additional medical records for review.',                             '${users.sarah}'),
        ('${contactId(10)}', '${caseId(7)}',  'phone',     CURRENT_DATE - INTERVAL '2 days',  'Called client to schedule initial office meeting. Set for next Tuesday.',                        '${users.sarah}'),

        ('${contactId(11)}', '${caseId(8)}',  'phone',     CURRENT_DATE - INTERVAL '1 day',   'Called client about missed ortho appointment — rescheduling for next week.',                     '${users.david}'),
        ('${contactId(12)}', '${caseId(8)}',  'email',     CURRENT_DATE - INTERVAL '7 days',  'Sent surgical consult information packet to client.',                                            '${users.david}'),
        ('${contactId(13)}', '${caseId(9)}',  'phone',     CURRENT_DATE - INTERVAL '3 days',  'Discussed mediation process with client. Client understands settlement range.',                  '${users.david}'),
        ('${contactId(14)}', '${caseId(10)}', 'phone',     CURRENT_DATE - INTERVAL '2 days',  'Called mother about plastic surgery consult timeline. Child doing well emotionally.',             '${users.david}'),
        ('${contactId(15)}', '${caseId(10)}', 'text',      CURRENT_DATE - INTERVAL '12 days', 'Texted to confirm scar photo appointment.',                                                      '${users.david}'),
        ('${contactId(16)}', '${caseId(11)}', 'email',     CURRENT_DATE - INTERVAL '5 days',  'Emailed client with discovery documents for review before attorney meeting.',                    '${users.david}'),
        ('${contactId(17)}', '${caseId(12)}', 'phone',     CURRENT_DATE - INTERVAL '1 day',   'Intake follow-up call — confirmed all insurance information and treating providers.',             '${users.david}'),
        ('${contactId(18)}', '${caseId(13)}', 'in_person', CURRENT_DATE - INTERVAL '4 days',  'Met with client for depo prep session. Reviewed surgery timeline and symptoms.',                  '${users.david}'),

        ('${contactId(19)}', '${caseId(14)}', 'phone',     CURRENT_DATE - INTERVAL '2 days',  'Called Uber insurance adjuster — claim acknowledged but no adjuster assigned yet.',               '${users.maria}'),
        ('${contactId(20)}', '${caseId(14)}', 'email',     CURRENT_DATE - INTERVAL '9 days',  'Sent records authorization to WakeMed for ER records.',                                          '${users.maria}'),
        ('${contactId(21)}', '${caseId(15)}', 'phone',     CURRENT_DATE - INTERVAL '3 days',  'Client excited about mediation — reviewed what to expect.',                                      '${users.maria}'),
        ('${contactId(22)}', '${caseId(15)}', 'email',     CURRENT_DATE - INTERVAL '15 days', 'Sent demand letter package to attorney for final review.',                                       '${users.maria}'),
        ('${contactId(23)}', '${caseId(16)}', 'phone',     CURRENT_DATE - INTERVAL '1 day',   'Checked on client wound healing — nerve pain still present in left leg.',                        '${users.maria}'),
        ('${contactId(24)}', '${caseId(17)}', 'phone',     CURRENT_DATE - INTERVAL '4 days',  'Called client — still in significant pain from pelvis fracture. Using wheelchair.',               '${users.maria}'),
        ('${contactId(25)}', '${caseId(17)}', 'text',      CURRENT_DATE - INTERVAL '7 days',  'Sent reminder about ortho follow-up appointment at Duke.',                                       '${users.maria}'),
        ('${contactId(26)}', '${caseId(18)}', 'email',     CURRENT_DATE - INTERVAL '6 days',  'Emailed employer records to attorney for expert depo preparation.',                               '${users.maria}'),
        ('${contactId(27)}', '${caseId(18)}', 'phone',     CURRENT_DATE - INTERVAL '2 days',  'Called client about hand therapy progress. Grip strength improving slowly.',                      '${users.maria}'),

        ('${contactId(28)}', '${caseId(19)}', 'phone',     CURRENT_DATE - INTERVAL '3 days',  'Client update — knee rehab progressing. Starting to bear weight without crutches.',               '${users.james}'),
        ('${contactId(29)}', '${caseId(19)}', 'email',     CURRENT_DATE - INTERVAL '10 days', 'Sent PT progress report to attorney for review.',                                                '${users.james}'),
        ('${contactId(30)}', '${caseId(20)}', 'phone',     CURRENT_DATE - INTERVAL '1 day',   'Called client about back pain status. Improving but still has headaches from concussion.',        '${users.james}'),
        ('${contactId(31)}', '${caseId(21)}', 'in_person', CURRENT_DATE - INTERVAL '5 days',  'Met with client to review latest oncology records and discuss case strategy.',                    '${users.james}'),
        ('${contactId(32)}', '${caseId(21)}', 'phone',     CURRENT_DATE - INTERVAL '14 days', 'Called primary care office about referral records — still being compiled.',                       '${users.james}'),
        ('${contactId(33)}', '${caseId(22)}', 'phone',     CURRENT_DATE - INTERVAL '2 days',  'Initial intake call — gathered all insurance info and prior medical history.',                    '${users.james}'),

        ('${contactId(34)}', '${caseId(23)}', 'phone',     CURRENT_DATE - INTERVAL '3 days',  'Called client about IME appointment. Reviewed what to expect and how to prepare.',                '${users.ashley}'),
        ('${contactId(35)}', '${caseId(23)}', 'email',     CURRENT_DATE - INTERVAL '8 days',  'Emailed Duke Spine Center follow-up for outstanding records.',                                   '${users.ashley}'),
        ('${contactId(36)}', '${caseId(24)}', 'phone',     CURRENT_DATE - INTERVAL '1 day',   'Called GEICO about UM/UIM claim status. Claim being reviewed.',                                  '${users.ashley}'),
        ('${contactId(37)}', '${caseId(24)}', 'text',      CURRENT_DATE - INTERVAL '6 days',  'Texted client UM/UIM claim update and next steps.',                                              '${users.ashley}'),
        ('${contactId(38)}', '${caseId(25)}', 'phone',     CURRENT_DATE - INTERVAL '2 days',  'Discussed mediation preparation with client. Strong case — client optimistic.',                   '${users.ashley}'),
        ('${contactId(39)}', '${caseId(25)}', 'email',     CURRENT_DATE - INTERVAL '11 days', 'Sent sidewalk maintenance complaint records to attorney.',                                        '${users.ashley}'),

        -- Closed case contacts
        ('${contactId(40)}', '${caseId(26)}', 'phone',     CURRENT_DATE - INTERVAL '25 days', 'Called client to confirm settlement funds received. Case complete.',                              '${users.sarah}'),
        ('${contactId(41)}', '${caseId(27)}', 'phone',     CURRENT_DATE - INTERVAL '20 days', 'Final call with client — settlement disbursement completed.',                                     '${users.david}'),
        ('${contactId(42)}', '${caseId(28)}', 'email',     CURRENT_DATE - INTERVAL '18 days', 'Sent closing letter and final settlement breakdown to client.',                                   '${users.maria}'),

        -- Extra contacts
        ('${contactId(43)}', '${caseId(3)}',  'phone',     CURRENT_DATE - INTERVAL '7 days',  'Called defense counsel about demand letter status. Said they need 2 more weeks.',                 '${users.sarah}'),
        ('${contactId(44)}', '${caseId(9)}',  'email',     CURRENT_DATE - INTERVAL '6 days',  'Sent mediation materials to mediator per scheduling order.',                                      '${users.david}'),
        ('${contactId(45)}', '${caseId(16)}', 'phone',     CURRENT_DATE - INTERVAL '15 days', 'Called animal control for follow-up on dangerous dog determination.',                              '${users.maria}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Contact log seeded (45)');

    // ===================== CASE KNOWLEDGE (3 closed cases) =====================
    await client.query(`
      INSERT INTO case_knowledge (id, case_id, incident_type, injury_types, liability_factors, outcome, settlement_amount, duration_days, lessons_learned, created_by) VALUES
        ('${knowledgeId(1)}', '${caseId(26)}', 'Motor Vehicle Accident',
         'Back and neck injuries — cervical strain, lumbar disc bulge, chronic pain',
         'Rear-end collision — defendant following too closely on Capital Blvd. Clear liability. Police report confirmed defendant at fault.',
         'Settled at mediation', 85000, 380,
         'Treatment gap of 3 weeks after initial ER visit nearly derailed case. Always document and explain any gaps in treatment. Client was in pain but delayed chiropractic care. Future cases: ensure clients begin treatment within 1 week of incident.',
         '${users.robert}'),

        ('${knowledgeId(2)}', '${caseId(27)}', 'Slip and Fall',
         'Knee fracture — tibial plateau fracture requiring ORIF surgery, post-surgical PT',
         'Wet produce section floor at grocery store. No wet floor signs posted. Surveillance footage showed spill existed for 20+ minutes before fall. Store manager admitted staff shortage that day.',
         'Settled pre-litigation', 42000, 320,
         'Surveillance footage was critical — store initially denied liability until footage was obtained showing spill had been present for extended period. Key lesson: always request surveillance footage preservation within 24 hours of incident. Many stores auto-delete after 30 days.',
         '${users.jennifer}'),

        ('${knowledgeId(3)}', '${caseId(28)}', 'Workplace Injury',
         'Shoulder injury — complete rotator cuff tear requiring arthroscopic repair, 6 months PT',
         'Fell from scaffolding at construction site. Employer failed to provide fall protection harness. OSHA cited employer for safety violations. Workers comp claim filed simultaneously.',
         'Settled after discovery', 125000, 280,
         'Workers comp crossover was complex — had to coordinate WC lien resolution with third-party settlement. WC carrier initially claimed $45K lien but negotiated down to $28K. Key lesson: engage WC lien negotiation early in the process. Also, OSHA citations are powerful evidence but cannot be directly admitted in NC civil cases — use the underlying facts instead.',
         '${existingAttorney}')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Case knowledge seeded (3)');

    // ===================== OPPOSING COUNSEL =====================
    const ocIds = {
      oc1: '0c100000-0000-0000-0000-000000000001',
      oc2: '0c100000-0000-0000-0000-000000000002',
      oc3: '0c100000-0000-0000-0000-000000000003',
      oc4: '0c100000-0000-0000-0000-000000000004',
      oc5: '0c100000-0000-0000-0000-000000000005',
    };
    await client.query(`
      INSERT INTO opposing_counsel (id, name, firm_name, email, phone, state_bar_number, notes) VALUES
        ('${ocIds.oc1}', 'Richard Harmon',    'Harmon & Blake LLP',         'rharmon@harmonblake.com',     '(919) 555-8001', 'NC-32451', 'Aggressive litigator. Files excessive motions. Tends to lowball initial offers then increase at mediation.'),
        ('${ocIds.oc2}', 'Catherine Reeves',  'Statewide Insurance Defense', 'creeves@sidlaw.com',         '(704) 555-8002', 'NC-28773', 'Experienced insurance defense. Professional but firm. Reasonable in discovery.'),
        ('${ocIds.oc3}', 'Thomas Blackwell',  'Blackwell Crawford PC',       'tblackwell@bcpc-law.com',    '(336) 555-8003', 'NC-19842', 'Senior partner. Handles med-mal defense exclusively. Very detail-oriented in discovery.'),
        ('${ocIds.oc4}', 'Amanda Chen-Watts', 'Parker Daniels & Associates', 'acwatts@parkerdaniels.com',  '(919) 555-8004', 'NC-41205', 'Junior associate. Responsive to discovery requests. Settles quickly when liability is clear.'),
        ('${ocIds.oc5}', 'Gregory Fontaine',  'Fontaine Law Group',          'gfontaine@fontainelaw.com',  '(252) 555-8005', 'NC-15693', 'Solo practitioner. Handles PI defense for small insurers. Known for delay tactics.')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Opposing counsel seeded (5)');

    // Link opposing counsel to cases
    await client.query(`
      INSERT INTO case_opposing_counsel (case_id, opposing_counsel_id) VALUES
        ('${caseId(1)}',  '${ocIds.oc1}'),
        ('${caseId(3)}',  '${ocIds.oc1}'),
        ('${caseId(5)}',  '${ocIds.oc2}'),
        ('${caseId(6)}',  '${ocIds.oc3}'),
        ('${caseId(8)}',  '${ocIds.oc4}'),
        ('${caseId(9)}',  '${ocIds.oc4}'),
        ('${caseId(13)}', '${ocIds.oc3}'),
        ('${caseId(14)}', '${ocIds.oc2}'),
        ('${caseId(17)}', '${ocIds.oc5}'),
        ('${caseId(19)}', '${ocIds.oc1}'),
        ('${caseId(26)}', '${ocIds.oc1}'),
        ('${caseId(27)}', '${ocIds.oc4}'),
        ('${caseId(28)}', '${ocIds.oc2}')
      ON CONFLICT DO NOTHING
    `);
    // Also set direct FK on cases
    await client.query(`UPDATE cases SET opposing_counsel_id = '${ocIds.oc1}' WHERE id IN ('${caseId(1)}','${caseId(3)}','${caseId(19)}','${caseId(26)}')`);
    await client.query(`UPDATE cases SET opposing_counsel_id = '${ocIds.oc2}' WHERE id IN ('${caseId(5)}','${caseId(14)}','${caseId(28)}')`);
    await client.query(`UPDATE cases SET opposing_counsel_id = '${ocIds.oc3}' WHERE id IN ('${caseId(6)}','${caseId(13)}')`);
    await client.query(`UPDATE cases SET opposing_counsel_id = '${ocIds.oc4}' WHERE id IN ('${caseId(8)}','${caseId(9)}','${caseId(27)}')`);
    await client.query(`UPDATE cases SET opposing_counsel_id = '${ocIds.oc5}' WHERE id IN ('${caseId(17)}')`);
    console.log('Opposing counsel linked to cases');

    // ===================== JUDGES =====================
    const judgeIds = {
      j1: '0d100000-0000-0000-0000-000000000001',
      j2: '0d100000-0000-0000-0000-000000000002',
      j3: '0d100000-0000-0000-0000-000000000003',
      j4: '0d100000-0000-0000-0000-000000000004',
    };
    await client.query(`
      INSERT INTO judges (id, name, court, jurisdiction, county, state, notes) VALUES
        ('${judgeIds.j1}', 'Hon. Margaret Chen',      'Wake County Superior Court',        'Superior',   'Wake',         'NC', 'Strict on discovery deadlines. Grants motions to compel readily when good faith effort shown. Prefers concise briefs.'),
        ('${judgeIds.j2}', 'Hon. David Rutherford',   'Mecklenburg County Superior Court', 'Superior',   'Mecklenburg',  'NC', 'Former plaintiff attorney. Sympathetic to injury claims. Allows generous discovery timelines.'),
        ('${judgeIds.j3}', 'Hon. Patricia Okonkwo',   'Guilford County Superior Court',    'Superior',   'Guilford',     'NC', 'Tough on both sides. Demands thorough preparation. Known for detailed jury instructions.'),
        ('${judgeIds.j4}', 'Hon. James Whitfield',    'NC Business Court',                 'Business',   'Wake',         'NC', 'Handles complex litigation. Favors early mediation. Will sanction discovery abuse.')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Judges seeded (4)');

    // Link judges to cases
    await client.query(`
      INSERT INTO case_judges (case_id, judge_id) VALUES
        ('${caseId(1)}',  '${judgeIds.j1}'),
        ('${caseId(5)}',  '${judgeIds.j1}'),
        ('${caseId(6)}',  '${judgeIds.j1}'),
        ('${caseId(13)}', '${judgeIds.j2}'),
        ('${caseId(9)}',  '${judgeIds.j2}'),
        ('${caseId(17)}', '${judgeIds.j3}'),
        ('${caseId(19)}', '${judgeIds.j3}'),
        ('${caseId(26)}', '${judgeIds.j1}'),
        ('${caseId(27)}', '${judgeIds.j2}'),
        ('${caseId(28)}', '${judgeIds.j1}')
      ON CONFLICT DO NOTHING
    `);
    await client.query(`UPDATE cases SET judge_id = '${judgeIds.j1}' WHERE id IN ('${caseId(1)}','${caseId(5)}','${caseId(6)}','${caseId(26)}','${caseId(28)}')`);
    await client.query(`UPDATE cases SET judge_id = '${judgeIds.j2}' WHERE id IN ('${caseId(13)}','${caseId(9)}','${caseId(27)}')`);
    await client.query(`UPDATE cases SET judge_id = '${judgeIds.j3}' WHERE id IN ('${caseId(17)}','${caseId(19)}')`);
    console.log('Judges linked to cases');

    await client.query('COMMIT');
    console.log('\nFirm data seed complete!');
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
