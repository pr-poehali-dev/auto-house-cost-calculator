-- Новые роли
INSERT INTO t_p78845984_auto_house_cost_calc.roles (code, name) VALUES
  ('manager', 'Менеджер по продажам'),
  ('build_manager', 'Руководитель строительства'),
  ('admin', 'Администратор')
ON CONFLICT DO NOTHING;

-- Настройки организации (одна строка)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  name varchar(256) NOT NULL DEFAULT '',
  full_name varchar(512) DEFAULT '',
  inn varchar(32) DEFAULT '',
  kpp varchar(32) DEFAULT '',
  ogrn varchar(32) DEFAULT '',
  legal_address text DEFAULT '',
  actual_address text DEFAULT '',
  phone varchar(64) DEFAULT '',
  email varchar(128) DEFAULT '',
  website varchar(256) DEFAULT '',
  bank_name varchar(256) DEFAULT '',
  bik varchar(32) DEFAULT '',
  account varchar(64) DEFAULT '',
  corr_account varchar(64) DEFAULT '',
  logo_url text DEFAULT '',
  director_name varchar(256) DEFAULT '',
  director_title varchar(128) DEFAULT 'Генеральный директор',
  stamp_url text DEFAULT '',
  signature_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);
INSERT INTO t_p78845984_auto_house_cost_calc.company_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Шаблоны договоров
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.contract_templates (
  id serial PRIMARY KEY,
  name varchar(256) NOT NULL,
  type varchar(64) NOT NULL DEFAULT 'construction',
  file_url text DEFAULT '',
  file_name varchar(256) DEFAULT '',
  content_text text DEFAULT '',
  is_active boolean DEFAULT true,
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Заказы (CRM)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.orders (
  id serial PRIMARY KEY,
  number varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'new',
  source varchar(64) DEFAULT 'site',
  source_ref varchar(256) DEFAULT '',
  client_name varchar(256) NOT NULL DEFAULT '',
  client_phone varchar(64) DEFAULT '',
  client_email varchar(128) DEFAULT '',
  client_comment text DEFAULT '',
  house_project_id integer REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
  area numeric(10,2) DEFAULT 0,
  floors integer DEFAULT 1,
  budget numeric(14,2) DEFAULT 0,
  address text DEFAULT '',
  manager_id integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  stage varchar(64) DEFAULT 'lead',
  priority varchar(16) DEFAULT 'normal',
  next_action text DEFAULT '',
  next_action_at timestamptz,
  notes text DEFAULT '',
  ai_summary text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Файлы заказа (загруженные проекты, спецификации, DWG и т.д.)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.order_files (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  file_name varchar(256) NOT NULL,
  file_url text NOT NULL,
  file_type varchar(64) DEFAULT 'project',
  file_size integer DEFAULT 0,
  parse_status varchar(32) DEFAULT 'pending',
  parse_result jsonb DEFAULT '{}',
  parse_error text DEFAULT '',
  uploaded_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now()
);

-- ВОР по заказу (ведомость объёмов работ)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.order_specs (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  version integer NOT NULL DEFAULT 1,
  status varchar(32) DEFAULT 'draft',
  title varchar(256) DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]',
  total_works numeric(14,2) DEFAULT 0,
  total_materials numeric(14,2) DEFAULT 0,
  total_amount numeric(14,2) DEFAULT 0,
  approved_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  approved_at timestamptz,
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Коммерческие предложения
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.commercial_proposals (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  number varchar(64) NOT NULL,
  status varchar(32) DEFAULT 'draft',
  valid_until date,
  items jsonb NOT NULL DEFAULT '[]',
  total_amount numeric(14,2) DEFAULT 0,
  discount_pct numeric(5,2) DEFAULT 0,
  vat_pct numeric(5,2) DEFAULT 0,
  notes text DEFAULT '',
  pdf_url text DEFAULT '',
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Договоры
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.contracts (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  template_id integer REFERENCES t_p78845984_auto_house_cost_calc.contract_templates(id),
  number varchar(64) NOT NULL,
  status varchar(32) DEFAULT 'draft',
  signed_date date,
  start_date date,
  end_date date,
  total_amount numeric(14,2) DEFAULT 0,
  content_filled text DEFAULT '',
  pdf_url text DEFAULT '',
  lawyer_comment text DEFAULT '',
  lawyer_approved_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  lawyer_approved_at timestamptz,
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Список материалов для закупки (из ВОР → снабжение)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.procurement_lists (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  order_spec_id integer REFERENCES t_p78845984_auto_house_cost_calc.order_specs(id),
  status varchar(32) DEFAULT 'draft',
  items jsonb NOT NULL DEFAULT '[]',
  approved_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  approved_at timestamptz,
  rfq_published_at timestamptz,
  created_by integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- История звонков и сообщений (Авито + ручные)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.lead_events (
  id serial PRIMARY KEY,
  order_id integer REFERENCES t_p78845984_auto_house_cost_calc.orders(id),
  type varchar(32) NOT NULL DEFAULT 'note',
  source varchar(64) DEFAULT 'manual',
  direction varchar(16) DEFAULT 'in',
  content text DEFAULT '',
  avito_account varchar(128) DEFAULT '',
  avito_chat_id varchar(256) DEFAULT '',
  manager_id integer REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at timestamptz DEFAULT now()
);

-- Авито аккаунты
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.avito_accounts (
  id serial PRIMARY KEY,
  name varchar(128) NOT NULL,
  client_id varchar(256) DEFAULT '',
  client_secret varchar(256) DEFAULT '',
  access_token text DEFAULT '',
  refresh_token text DEFAULT '',
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_manager ON t_p78845984_auto_house_cost_calc.orders(manager_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON t_p78845984_auto_house_cost_calc.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON t_p78845984_auto_house_cost_calc.orders(stage);
CREATE INDEX IF NOT EXISTS idx_order_files_order ON t_p78845984_auto_house_cost_calc.order_files(order_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_order ON t_p78845984_auto_house_cost_calc.lead_events(order_id);
