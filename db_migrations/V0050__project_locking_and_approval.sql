ALTER TABLE t_p78845984_auto_house_cost_calc.house_projects
  ADD COLUMN IF NOT EXISTS calc_status varchar(32) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS locked_by integer,
  ADD COLUMN IF NOT EXISTS locked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assigned_reviewer integer,
  ADD COLUMN IF NOT EXISTS submitted_by integer,
  ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by integer,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS has_calc boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.project_reviews (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  action varchar(32) NOT NULL,
  staff_id integer NOT NULL,
  comment text,
  created_at timestamp with time zone DEFAULT now()
);