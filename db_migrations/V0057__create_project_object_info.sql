CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.project_object_info (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
    info_json TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_object_info_project_id_idx
    ON t_p78845984_auto_house_cost_calc.project_object_info(project_id);