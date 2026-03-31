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
