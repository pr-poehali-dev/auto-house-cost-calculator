
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(64) NOT NULL
);

INSERT INTO t_p78845984_auto_house_cost_calc.roles (code, name) VALUES
  ('architect',    'Архитектор'),
  ('constructor',  'Конструктор'),
  ('engineer',     'Инженер'),
  ('lawyer',       'Юрист'),
  ('supply',       'Снабженец');

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.staff (
  id SERIAL PRIMARY KEY,
  login VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role_code VARCHAR(32) NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.roles(code),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.sessions (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  token VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.house_projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(64) NOT NULL,
  area INTEGER NOT NULL,
  floors INTEGER NOT NULL,
  rooms INTEGER NOT NULL,
  price INTEGER NOT NULL,
  tag VARCHAR(32) DEFAULT '',
  tag_color VARCHAR(16) DEFAULT '#FF6B1A',
  description TEXT DEFAULT '',
  features TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  updated_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.materials (
  id SERIAL PRIMARY KEY,
  category VARCHAR(128) NOT NULL,
  name VARCHAR(256) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  price_per_unit NUMERIC(12,2) NOT NULL,
  qty_formula VARCHAR(256) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  updated_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.change_log (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  entity VARCHAR(64) NOT NULL,
  entity_id INTEGER,
  action VARCHAR(32) NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p78845984_auto_house_cost_calc.staff (login, password_hash, full_name, role_code) VALUES
  ('architect1',  'RESET', 'Архитектор 1',  'architect'),
  ('architect2',  'RESET', 'Архитектор 2',  'architect'),
  ('architect3',  'RESET', 'Архитектор 3',  'architect'),
  ('constructor1','RESET', 'Конструктор 1', 'constructor'),
  ('constructor2','RESET', 'Конструктор 2', 'constructor'),
  ('constructor3','RESET', 'Конструктор 3', 'constructor'),
  ('engineer1',   'RESET', 'Инженер',       'engineer'),
  ('lawyer1',     'RESET', 'Юрист',         'lawyer'),
  ('supply1',     'RESET', 'Снабженец',     'supply');
