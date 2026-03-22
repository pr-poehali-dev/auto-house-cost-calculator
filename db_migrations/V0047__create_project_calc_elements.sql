CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.project_calc_elements (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.house_projects(id),
    elements_json TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS project_calc_elements_project_id_idx
    ON t_p78845984_auto_house_cost_calc.project_calc_elements(project_id);
