
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimate_requests (
  id serial PRIMARY KEY,
  number varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'new',
  client_name varchar(256) NOT NULL DEFAULT '',
  client_phone varchar(64) DEFAULT '',
  client_email varchar(128) DEFAULT '',
  client_company varchar(256) DEFAULT '',
  description text DEFAULT '',
  lead_id integer REFERENCES t_p78845984_auto_house_cost_calc.leads(id),
  order_id integer REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  assigned_manager_id integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimate_documents (
  id serial PRIMARY KEY,
  request_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimate_requests(id),
  file_name varchar(512) NOT NULL,
  file_url text NOT NULL,
  file_type varchar(32) DEFAULT 'vor',
  file_size integer DEFAULT 0,
  parse_status varchar(32) DEFAULT 'pending',
  parsed_text text DEFAULT '',
  parsed_items jsonb DEFAULT '[]',
  ai_summary text DEFAULT '',
  uploaded_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimates (
  id serial PRIMARY KEY,
  request_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimate_requests(id),
  version integer NOT NULL DEFAULT 1,
  status varchar(32) DEFAULT 'draft',
  title varchar(256) DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]',
  total_materials numeric(14,2) DEFAULT 0,
  total_works numeric(14,2) DEFAULT 0,
  total_amount numeric(14,2) DEFAULT 0,
  overhead_pct numeric(5,2) DEFAULT 15,
  profit_pct numeric(5,2) DEFAULT 10,
  vat_pct numeric(5,2) DEFAULT 20,
  grand_total numeric(14,2) DEFAULT 0,
  ai_notes text DEFAULT '',
  missing_materials_count integer DEFAULT 0,
  pdf_url text DEFAULT '',
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimate_tasks (
  id serial PRIMARY KEY,
  request_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimate_requests(id),
  estimate_id integer REFERENCES t_p78845984_auto_house_cost_calc.estimates(id),
  task_type varchar(64) NOT NULL,
  title varchar(256) NOT NULL,
  description text DEFAULT '',
  status varchar(32) DEFAULT 'pending',
  assigned_to integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  assigned_name varchar(128) DEFAULT '',
  assigned_role varchar(32) DEFAULT '',
  started_at timestamptz,
  completed_at timestamptz,
  due_at timestamptz,
  duration_seconds integer DEFAULT 0,
  result_comment text DEFAULT '',
  ai_recommendation text DEFAULT '',
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimate_price_requests (
  id serial PRIMARY KEY,
  request_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimate_requests(id),
  estimate_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimates(id),
  task_id integer REFERENCES t_p78845984_auto_house_cost_calc.estimate_tasks(id),
  material_name varchar(256) NOT NULL,
  unit varchar(32) DEFAULT 'шт',
  qty numeric(14,3) DEFAULT 0,
  status varchar(32) DEFAULT 'pending',
  received_price numeric(12,2),
  supplier_id integer REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
  supplier_name varchar(256) DEFAULT '',
  assigned_to integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.estimate_approvals (
  id serial PRIMARY KEY,
  request_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimate_requests(id),
  estimate_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.estimates(id),
  approver_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  approver_name varchar(128) NOT NULL,
  approver_role varchar(64) NOT NULL,
  action varchar(32) NOT NULL,
  comment text DEFAULT '',
  ai_analysis text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_est_req_status ON t_p78845984_auto_house_cost_calc.estimate_requests(status);
CREATE INDEX IF NOT EXISTS idx_est_req_manager ON t_p78845984_auto_house_cost_calc.estimate_requests(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_est_docs_request ON t_p78845984_auto_house_cost_calc.estimate_documents(request_id);
CREATE INDEX IF NOT EXISTS idx_estimates_request ON t_p78845984_auto_house_cost_calc.estimates(request_id);
CREATE INDEX IF NOT EXISTS idx_est_tasks_request ON t_p78845984_auto_house_cost_calc.estimate_tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_est_tasks_assigned ON t_p78845984_auto_house_cost_calc.estimate_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_est_tasks_status ON t_p78845984_auto_house_cost_calc.estimate_tasks(status);
CREATE INDEX IF NOT EXISTS idx_est_price_req ON t_p78845984_auto_house_cost_calc.estimate_price_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_est_price_assigned ON t_p78845984_auto_house_cost_calc.estimate_price_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_est_approvals_request ON t_p78845984_auto_house_cost_calc.estimate_approvals(request_id);
