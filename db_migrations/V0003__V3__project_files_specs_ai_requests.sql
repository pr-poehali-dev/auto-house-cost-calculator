
-- Файлы проектов (рендеры, планы, фасады, разрезы)
CREATE TABLE t_p78845984_auto_house_cost_calc.project_files (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
  file_type VARCHAR(32) NOT NULL, -- render, plan, facade, section, other
  file_url TEXT NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ведомости объёмов работ (BOQ) по проекту
CREATE TABLE t_p78845984_auto_house_cost_calc.project_specs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
  title VARCHAR(256) NOT NULL DEFAULT 'Ведомость объёмов работ',
  version INTEGER DEFAULT 1,
  status VARCHAR(32) DEFAULT 'draft', -- draft, approved
  created_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  updated_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Позиции ведомости (детальные материалы и работы)
CREATE TABLE t_p78845984_auto_house_cost_calc.spec_items (
  id SERIAL PRIMARY KEY,
  spec_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.project_specs(id),
  section VARCHAR(128) NOT NULL,
  name VARCHAR(256) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  qty NUMERIC(12,3) NOT NULL DEFAULT 0,
  price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (qty * price_per_unit) STORED,
  note TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  updated_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- История изменений ведомости
CREATE TABLE t_p78845984_auto_house_cost_calc.spec_history (
  id SERIAL PRIMARY KEY,
  spec_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.project_specs(id),
  item_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.spec_items(id),
  changed_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  field_name VARCHAR(64),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-заявки заказчиков на генерацию проекта
CREATE TABLE t_p78845984_auto_house_cost_calc.ai_project_requests (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(128),
  client_phone VARCHAR(32),
  client_email VARCHAR(128),
  preferences JSONB NOT NULL DEFAULT '{}',
  generated_description TEXT DEFAULT '',
  generated_render_url TEXT DEFAULT '',
  status VARCHAR(32) DEFAULT 'new', -- new, processing, done
  created_at TIMESTAMPTZ DEFAULT NOW()
);
