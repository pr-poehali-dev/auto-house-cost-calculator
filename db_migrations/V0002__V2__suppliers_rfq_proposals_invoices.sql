
-- Поставщики (самостоятельная регистрация)
CREATE TABLE t_p78845984_auto_house_cost_calc.suppliers (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(256) NOT NULL,
  contact_name VARCHAR(128) NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  phone VARCHAR(32),
  categories TEXT NOT NULL,  -- через запятую: materials,equipment,furniture,labor
  region VARCHAR(128),
  description TEXT DEFAULT '',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  password_hash VARCHAR(128) NOT NULL,
  token VARCHAR(128),
  token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Запросы КП (создаёт снабженец)
CREATE TABLE t_p78845984_auto_house_cost_calc.rfq (
  id SERIAL PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  construction_address TEXT NOT NULL,
  house_project_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
  area INTEGER,
  floors INTEGER,
  house_type VARCHAR(64),
  items JSONB NOT NULL DEFAULT '[]',  -- список позиций из сметы
  deadline DATE,
  status VARCHAR(32) DEFAULT 'open',  -- open, closed, awarded
  created_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Предложения поставщиков
CREATE TABLE t_p78845984_auto_house_cost_calc.proposals (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.rfq(id),
  supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
  items JSONB NOT NULL DEFAULT '[]',  -- позиции с ценами поставщика
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  delivery_days INTEGER,
  comment TEXT DEFAULT '',
  status VARCHAR(32) DEFAULT 'submitted',  -- submitted, winner, rejected
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rfq_id, supplier_id)
);

-- Счета
CREATE TABLE t_p78845984_auto_house_cost_calc.invoices (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.rfq(id),
  proposal_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.proposals(id),
  supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
  invoice_number VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) DEFAULT 'draft',  -- draft, sent, paid
  created_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Лог уведомлений
CREATE TABLE t_p78845984_auto_house_cost_calc.notification_log (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
  rfq_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.rfq(id),
  channel VARCHAR(16) NOT NULL,  -- email, sms
  status VARCHAR(16) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
