ALTER TABLE t_p78845984_auto_house_cost_calc.house_projects
  ADD COLUMN IF NOT EXISTS roof_type varchar(128) NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS foundation_type varchar(128) NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wall_type varchar(128) NULL DEFAULT '';
