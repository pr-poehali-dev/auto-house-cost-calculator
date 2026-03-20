ALTER TABLE t_p78845984_auto_house_cost_calc.tech_cards
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS storage_conditions text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS acceptance_conditions text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags text[] NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS work_type varchar(128) NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_url text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS file_name text NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parse_status varchar(32) NULL DEFAULT 'manual';
