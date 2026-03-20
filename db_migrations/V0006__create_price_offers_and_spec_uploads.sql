CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.price_offers (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.materials(id),
  supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
  price NUMERIC(12,2) NOT NULL,
  location VARCHAR(256) DEFAULT '',
  note TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(material_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.spec_uploads (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
  spec_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.project_specs(id),
  file_name VARCHAR(256) NOT NULL,
  file_url TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  ai_result JSONB DEFAULT NULL,
  error_msg TEXT DEFAULT '',
  uploaded_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ DEFAULT NULL
);
