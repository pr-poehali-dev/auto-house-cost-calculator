ALTER TABLE t_p78845984_auto_house_cost_calc.tech_cards
  ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]'::jsonb;