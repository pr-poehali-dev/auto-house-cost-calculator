CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.companies (
  id            SERIAL PRIMARY KEY,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  company_name  VARCHAR(256) NOT NULL DEFAULT '',
  full_name     VARCHAR(512) DEFAULT '',
  inn           VARCHAR(32) DEFAULT '',
  kpp           VARCHAR(32) DEFAULT '',
  ogrn          VARCHAR(32) DEFAULT '',
  legal_address TEXT DEFAULT '',
  actual_address TEXT DEFAULT '',
  phone         VARCHAR(64) DEFAULT '',
  email         VARCHAR(128) DEFAULT '',
  website       VARCHAR(256) DEFAULT '',
  director_name VARCHAR(256) DEFAULT '',
  director_title VARCHAR(128) DEFAULT 'Генеральный директор',
  bank_name     VARCHAR(256) DEFAULT '',
  bik           VARCHAR(32) DEFAULT '',
  account_number VARCHAR(64) DEFAULT '',
  corr_account  VARCHAR(64) DEFAULT '',
  logo_url      TEXT DEFAULT '',
  stamp_url     TEXT DEFAULT '',
  signature_url TEXT DEFAULT '',
  company_map_url TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE t_p78845984_auto_house_cost_calc.contract_templates
  ADD COLUMN IF NOT EXISTS company_id INTEGER;

SELECT setval('t_p78845984_auto_house_cost_calc.companies_id_seq', 10);
