CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.crm_events (
  id serial PRIMARY KEY,
  lead_id integer NOT NULL,
  type varchar(32) NOT NULL DEFAULT 'comment',
  content text,
  old_stage varchar(32),
  new_stage varchar(32),
  staff_id integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_events_lead ON t_p78845984_auto_house_cost_calc.crm_events(lead_id);