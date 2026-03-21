-- Добавляем поле doc_category для классификации документов проекта по разделам
ALTER TABLE t_p78845984_auto_house_cost_calc.project_files
  ADD COLUMN IF NOT EXISTS doc_category VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL;

-- Добавляем поле pages_analyzed в spec_uploads для постраничного анализа
ALTER TABLE t_p78845984_auto_house_cost_calc.spec_uploads
  ADD COLUMN IF NOT EXISTS doc_category VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pages_data JSONB DEFAULT NULL;

COMMENT ON COLUMN t_p78845984_auto_house_cost_calc.project_files.doc_category IS 'Раздел проектной документации: specification, work_statement, explanatory_note, drawing, estimate, other';
COMMENT ON COLUMN t_p78845984_auto_house_cost_calc.project_files.page_count IS 'Количество страниц в документе';
COMMENT ON COLUMN t_p78845984_auto_house_cost_calc.project_files.ai_summary IS 'Краткое AI-резюме содержания документа';
