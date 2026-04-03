import pool from './db.js';

const migrations = [
  // Phase A
  `CREATE TABLE IF NOT EXISTS records_followup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    records_request_id UUID NOT NULL REFERENCES records_requests(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    followup_type VARCHAR(20) NOT NULL CHECK (followup_type IN ('day_14','day_30','day_45','day_60')),
    letter_text TEXT,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued','sent','cancelled')),
    queued_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    sent_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE discovery_responses ADD COLUMN IF NOT EXISTS response_party VARCHAR(20) DEFAULT 'defendant'`,
  `ALTER TABLE discovery_gaps ADD COLUMN IF NOT EXISTS ai_reasoning TEXT`,
  `ALTER TABLE discovery_gaps ADD COLUMN IF NOT EXISTS gap_action VARCHAR(50)`,

  // Phase B
  `CREATE TABLE IF NOT EXISTS opposing_counsel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    firm_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    state_bar_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    court VARCHAR(255),
    jurisdiction VARCHAR(255),
    county VARCHAR(255),
    state VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS case_opposing_counsel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    opposing_counsel_id UUID NOT NULL REFERENCES opposing_counsel(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS case_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS firm_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    document_type VARCHAR(100),
    file_name VARCHAR(500),
    file_path VARCHAR(1000),
    file_size BIGINT,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id),
    ai_summary TEXT,
    ai_extracted_issues TEXT,
    ai_key_clauses TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE cases ADD COLUMN IF NOT EXISTS opposing_counsel_id UUID`,
  `ALTER TABLE cases ADD COLUMN IF NOT EXISTS judge_id UUID`,

  // Phase C
  `ALTER TABLE discovery_questionnaires ADD COLUMN IF NOT EXISTS questions_json JSONB`,
  `ALTER TABLE discovery_questionnaires ADD COLUMN IF NOT EXISTS mapped_from_response_id UUID`,

  // Casey's Dashboard: Deficiency Letters
  `CREATE TABLE IF NOT EXISTS deficiency_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    gap_id UUID REFERENCES discovery_gaps(id) ON DELETE SET NULL,
    letter_text TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','cancelled')),
    generated_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    sent_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deficiency_letters_case ON deficiency_letters(case_id)`,

  // Indexes (safe to re-run)
  `CREATE INDEX IF NOT EXISTS idx_followup_log_request ON records_followup_log(records_request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_followup_log_case ON records_followup_log(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_case_opposing_counsel_case ON case_opposing_counsel(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_case_opposing_counsel_oc ON case_opposing_counsel(opposing_counsel_id)`,
  `CREATE INDEX IF NOT EXISTS idx_case_judges_case ON case_judges(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_case_judges_judge ON case_judges(judge_id)`,
  `CREATE INDEX IF NOT EXISTS idx_firm_documents_case ON firm_documents(case_id)`,
  `CREATE INDEX IF NOT EXISTS idx_firm_documents_type ON firm_documents(document_type)`,
];

export async function runMigrations() {
  let applied = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      applied++;
    } catch (err) {
      // Ignore "already exists" errors, log others
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.warn(`Migration warning: ${err.message.slice(0, 100)}`);
      }
    }
  }
  console.log(`Migrations: ${applied}/${migrations.length} applied`);
}
