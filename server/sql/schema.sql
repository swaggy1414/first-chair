-- First Chair — PI Law Firm Case Management
-- Database Schema

DROP DATABASE IF EXISTS first_chair;
CREATE DATABASE first_chair;
\c first_chair

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin','supervisor','paralegal','attorney','records_team')),
  force_password_change BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cases
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50),
  client_email VARCHAR(255),
  incident_date DATE,
  incident_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'intake' CHECK (status IN ('intake','active','treatment','demand','litigation','settled','closed')),
  assigned_paralegal_id UUID REFERENCES users(id),
  assigned_attorney_id UUID REFERENCES users(id),
  phase VARCHAR(50) DEFAULT 'active',
  flag_color VARCHAR(20),
  flag_note TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deadlines
CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  type VARCHAR(50) CHECK (type IN ('statute_of_limitations','filing','discovery','hearing','deposition','medical','follow_up','other')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','completed','overdue','cancelled')),
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Records Requests
CREATE TABLE records_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  provider_name VARCHAR(255) NOT NULL,
  request_type VARCHAR(100),
  requested_date DATE,
  received_date DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','sent','received','partial','follow_up')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attorney Requests
CREATE TABLE attorney_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  priority VARCHAR(20) DEFAULT 'standard' CHECK (priority IN ('critical','high','standard','deferred')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Contact Log
CREATE TABLE contact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) CHECK (contact_type IN ('phone','email','text','in_person','mail','fax','other')),
  contact_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  logged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Treatments
CREATE TABLE treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  provider_name VARCHAR(255) NOT NULL,
  treatment_type VARCHAR(100),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','completed','scheduled','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_paralegal ON cases(assigned_paralegal_id);
CREATE INDEX idx_cases_attorney ON cases(assigned_attorney_id);
CREATE INDEX idx_deadlines_due ON deadlines(due_date);
CREATE INDEX idx_deadlines_case ON deadlines(case_id);
CREATE INDEX idx_records_case ON records_requests(case_id);
CREATE INDEX idx_attorney_req_case ON attorney_requests(case_id);
CREATE INDEX idx_attorney_req_priority ON attorney_requests(priority);
CREATE INDEX idx_contact_log_case ON contact_log(case_id);
CREATE INDEX idx_treatments_case ON treatments(case_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Exhibits
CREATE TABLE exhibits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_path VARCHAR(1000),
  file_size BIGINT,
  mime_type VARCHAR(200),
  category VARCHAR(100) CHECK (category IN ('Medical Records','Police Report','Photos','Bills and Invoices','Correspondence','Expert Reports','Deposition','Other')),
  ai_classification VARCHAR(100),
  ai_confidence INTEGER,
  ai_summary TEXT,
  uploaded_by UUID REFERENCES users(id),
  onedrive_file_id VARCHAR(500),
  onedrive_url VARCHAR(1000),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exhibits_case ON exhibits(case_id);

-- Discovery Responses
CREATE TABLE discovery_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_name VARCHAR(500) NOT NULL,
  file_size BIGINT,
  file_path VARCHAR(1000),
  responding_party VARCHAR(255),
  response_date DATE,
  interrogatory_count INTEGER DEFAULT 0,
  rfa_count INTEGER DEFAULT 0,
  rpd_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing','complete','error')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE discovery_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_response_id UUID NOT NULL REFERENCES discovery_responses(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  gap_type VARCHAR(50) NOT NULL CHECK (gap_type IN ('missing_document','incomplete_answer','no_answer','evasive_answer','objection_only')),
  request_number INTEGER,
  request_type VARCHAR(50) CHECK (request_type IN ('interrogatory','rfa','rpd')),
  original_request_text TEXT,
  response_received TEXT,
  gap_description TEXT,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open','client_notified','response_received','resolved','waived')),
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE supplementation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  discovery_response_id UUID REFERENCES discovery_responses(id) ON DELETE CASCADE,
  generated_email_text TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  client_response TEXT,
  client_responded_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','sent','responded','closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discovery_responses_case ON discovery_responses(case_id);
CREATE INDEX idx_discovery_gaps_response ON discovery_gaps(discovery_response_id);
CREATE INDEX idx_discovery_gaps_case ON discovery_gaps(case_id);
CREATE INDEX idx_supplementation_case ON supplementation_requests(case_id);

-- Discovery Questionnaires
CREATE TABLE IF NOT EXISTS discovery_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  client_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent','responded','overdue')),
  follow_up_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discovery_questionnaires_case ON discovery_questionnaires(case_id);

-- Objections
CREATE TABLE IF NOT EXISTS objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  objection_text TEXT NOT NULL,
  category VARCHAR(100) CHECK (category IN ('General Objections','Interrogatory Objections','RFA Objections','RPD Objections','Privilege','Other')),
  use_count INTEGER DEFAULT 0,
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('imported','manual')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Discovery Objection Assignments
CREATE TABLE IF NOT EXISTS discovery_objection_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_gap_id UUID NOT NULL REFERENCES discovery_gaps(id) ON DELETE CASCADE,
  objection_id UUID NOT NULL REFERENCES objections(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Discovery Response Library
CREATE TABLE IF NOT EXISTS discovery_response_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50),
  client_name VARCHAR(255),
  incident_type VARCHAR(100),
  responding_party VARCHAR(255),
  file_name VARCHAR(500),
  interrogatory_count INTEGER DEFAULT 0,
  rfa_count INTEGER DEFAULT 0,
  rpd_count INTEGER DEFAULT 0,
  notes TEXT,
  added_by UUID REFERENCES users(id),
  source_case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  source_response_id UUID REFERENCES discovery_responses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_discovery_response_library_case ON discovery_response_library(source_case_id);

-- Case Knowledge Base
CREATE TABLE IF NOT EXISTS case_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  incident_type VARCHAR(100),
  injury_types TEXT,
  liability_factors TEXT,
  outcome VARCHAR(100),
  settlement_amount NUMERIC,
  duration_days INTEGER,
  lessons_learned TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_knowledge_case ON case_knowledge(case_id);
CREATE INDEX IF NOT EXISTS idx_case_knowledge_type ON case_knowledge(incident_type);

-- Attorney Notes
CREATE TABLE IF NOT EXISTS attorney_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  attorney_id UUID NOT NULL REFERENCES users(id),
  note_text TEXT NOT NULL,
  note_type VARCHAR(50) DEFAULT 'general' CHECK (note_type IN ('strategy','risk','settlement','general')),
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attorney_notes_case ON attorney_notes(case_id);

-- Case Similarity Log
CREATE TABLE IF NOT EXISTS case_similarity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  similar_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  similarity_score NUMERIC,
  matched_factors TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_similarity_source ON case_similarity_log(source_case_id);

-- Filevine integration column on cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS filevine_project_id VARCHAR(255);

-- Medical Records Analysis
CREATE TABLE IF NOT EXISTS medical_records_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_name VARCHAR(500),
  file_size BIGINT,
  file_path VARCHAR(1000),
  source VARCHAR(50) DEFAULT 'manual_upload' CHECK (source IN ('manual_upload','filevine')),
  analysis_status VARCHAR(50) DEFAULT 'pending' CHECK (analysis_status IN ('pending','processing','complete','error')),
  related_treatment_count INTEGER DEFAULT 0,
  unrelated_treatment_count INTEGER DEFAULT 0,
  total_billed_amount NUMERIC DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medical_records_analysis_case ON medical_records_analysis(case_id);

-- Treatment Line Items
CREATE TABLE IF NOT EXISTS treatment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_records_analysis_id UUID NOT NULL REFERENCES medical_records_analysis(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  date_of_service DATE,
  provider_name VARCHAR(255),
  procedure_code VARCHAR(50),
  description TEXT,
  amount NUMERIC DEFAULT 0,
  is_related BOOLEAN DEFAULT true,
  ai_confidence INTEGER,
  flag_reason TEXT,
  paralegal_override BOOLEAN,
  reviewed_by_paralegal UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_treatment_line_items_analysis ON treatment_line_items(medical_records_analysis_id);
CREATE INDEX IF NOT EXISTS idx_treatment_line_items_case ON treatment_line_items(case_id);

-- Liens
CREATE TABLE IF NOT EXISTS liens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  health_plan_name VARCHAR(255),
  plan_type VARCHAR(100),
  lien_status VARCHAR(50) DEFAULT 'pending' CHECK (lien_status IN ('pending','active','negotiating','resolved','paid','disputed')),
  subrogation_company VARCHAR(255),
  subrogation_contact_name VARCHAR(255),
  subrogation_contact_phone VARCHAR(50),
  subrogation_contact_email VARCHAR(255),
  lien_amount NUMERIC DEFAULT 0,
  negotiated_amount NUMERIC,
  hipaa_sent_at TIMESTAMPTZ,
  lor_sent_at TIMESTAMPTZ,
  last_update_received TIMESTAMPTZ,
  next_follow_up_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liens_case ON liens(case_id);

-- Damages Chart
CREATE TABLE IF NOT EXISTS damages_chart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  total_medical_bills NUMERIC DEFAULT 0,
  related_medical_bills NUMERIC DEFAULT 0,
  lien_total NUMERIC DEFAULT 0,
  negotiated_lien_total NUMERIC DEFAULT 0,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_damages_chart_case ON damages_chart(case_id);

-- Damages Line Items
CREATE TABLE IF NOT EXISTS damages_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  damages_chart_id UUID NOT NULL REFERENCES damages_chart(id) ON DELETE CASCADE,
  provider_name VARCHAR(255),
  total_amount NUMERIC DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_damages_line_items_chart ON damages_line_items(damages_chart_id);

-- Subrogation Directory
CREATE TABLE IF NOT EXISTS subrogation_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  health_plan_name VARCHAR(255),
  subrogation_company VARCHAR(255),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  contact_fax VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subrogation_directory_plan ON subrogation_directory(health_plan_name);

-- Subpoenas
CREATE TABLE IF NOT EXISTS subpoenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  subpoena_type VARCHAR(100),
  recipient_name VARCHAR(255),
  recipient_type VARCHAR(100),
  registered_agent_name VARCHAR(255),
  registered_agent_address TEXT,
  service_address TEXT,
  service_method VARCHAR(100),
  state_of_service VARCHAR(10),
  is_foreign_subpoena BOOLEAN DEFAULT false,
  issued_date DATE,
  served_date DATE,
  response_due_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','issued','served','responded','deficient','complied','quashed')),
  discovery_gap_id UUID REFERENCES discovery_gaps(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subpoenas_case ON subpoenas(case_id);
CREATE INDEX IF NOT EXISTS idx_subpoenas_status ON subpoenas(status);
CREATE INDEX IF NOT EXISTS idx_subpoenas_due_date ON subpoenas(response_due_date);

-- Subpoena Compliance
CREATE TABLE IF NOT EXISTS subpoena_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subpoena_id UUID NOT NULL REFERENCES subpoenas(id) ON DELETE CASCADE,
  issuing_state VARCHAR(10),
  service_state VARCHAR(10),
  is_foreign BOOLEAN DEFAULT false,
  service_requirements TEXT,
  court_filing_required BOOLEAN DEFAULT false,
  court_name VARCHAR(255),
  commission_required BOOLEAN DEFAULT false,
  notice_period_days INTEGER,
  special_instructions TEXT,
  common_mistakes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subpoena_compliance_subpoena ON subpoena_compliance(subpoena_id);

-- Registered Agent Cache
CREATE TABLE IF NOT EXISTS registered_agent_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name VARCHAR(255) NOT NULL,
  state VARCHAR(10) NOT NULL,
  registered_agent_name VARCHAR(255),
  registered_agent_address TEXT,
  service_address TEXT,
  service_department VARCHAR(255),
  notes TEXT,
  verify_recommended BOOLEAN DEFAULT true,
  source VARCHAR(50) DEFAULT 'ai_lookup' CHECK (source IN ('nc_sos','ai_lookup','manual')),
  lookup_date TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registered_agent_cache_entity ON registered_agent_cache(entity_name, state);

-- Subpoena Responses
CREATE TABLE IF NOT EXISTS subpoena_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subpoena_id UUID NOT NULL REFERENCES subpoenas(id) ON DELETE CASCADE,
  received_date DATE,
  response_type VARCHAR(100),
  documents_received BOOLEAN DEFAULT false,
  objections_raised BOOLEAN DEFAULT false,
  deficiency_description TEXT,
  supplementation_needed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subpoena_responses_subpoena ON subpoena_responses(subpoena_id);

-- Opposing Counsel
CREATE TABLE IF NOT EXISTS opposing_counsel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  firm_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  state_bar_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Judges
CREATE TABLE IF NOT EXISTS judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  court VARCHAR(255),
  jurisdiction VARCHAR(255),
  county VARCHAR(255),
  state VARCHAR(10),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Case-Opposing Counsel link
CREATE TABLE IF NOT EXISTS case_opposing_counsel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  opposing_counsel_id UUID NOT NULL REFERENCES opposing_counsel(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_opposing_counsel_case ON case_opposing_counsel(case_id);
CREATE INDEX IF NOT EXISTS idx_case_opposing_counsel_oc ON case_opposing_counsel(opposing_counsel_id);

-- Case-Judges link
CREATE TABLE IF NOT EXISTS case_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_judges_case ON case_judges(case_id);
CREATE INDEX IF NOT EXISTS idx_case_judges_judge ON case_judges(judge_id);

-- Firm Documents
CREATE TABLE IF NOT EXISTS firm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  document_type VARCHAR(100),
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id),
  ai_summary TEXT,
  extracted_issues TEXT,
  key_clauses TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_firm_documents_case ON firm_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_firm_documents_type ON firm_documents(document_type);

-- Cases: opposing_counsel_id and judge_id
ALTER TABLE cases ADD COLUMN IF NOT EXISTS opposing_counsel_id UUID REFERENCES opposing_counsel(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judge_id UUID REFERENCES judges(id) ON DELETE SET NULL;

-- Records Follow-Up Log
CREATE TABLE IF NOT EXISTS records_followup_log (
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
);
CREATE INDEX IF NOT EXISTS idx_followup_log_request ON records_followup_log(records_request_id);
CREATE INDEX IF NOT EXISTS idx_followup_log_case ON records_followup_log(case_id);

-- A2: Plaintiff/Defendant toggle
ALTER TABLE discovery_responses ADD COLUMN IF NOT EXISTS response_party VARCHAR(20) DEFAULT 'defendant';

-- A3: AI reasoning notes per gap
ALTER TABLE discovery_gaps ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- A4: Gap actions
ALTER TABLE discovery_gaps ADD COLUMN IF NOT EXISTS gap_action VARCHAR(50) CHECK (gap_action IN ('confirmed','objection_applied','dismissed'));
