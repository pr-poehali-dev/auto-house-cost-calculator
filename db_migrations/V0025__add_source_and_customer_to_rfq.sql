ALTER TABLE t_p78845984_auto_house_cost_calc.rfq
  ADD COLUMN IF NOT EXISTS source_type       VARCHAR(20) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_project_id INTEGER     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_name     TEXT        DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_phone    TEXT        DEFAULT '';
