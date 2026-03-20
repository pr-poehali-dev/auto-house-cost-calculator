ALTER TABLE t_p78845984_auto_house_cost_calc.proposals
  ADD COLUMN IF NOT EXISTS quality_gost            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS quality_certificates    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS quality_warranty_months INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_method       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS acceptance_min_batch    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS acceptance_packaging    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS resources_warehouse     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS resources_transport     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS resources_managers      INTEGER DEFAULT 1;
