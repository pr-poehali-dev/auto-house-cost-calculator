-- Таблица нормативных документов для обучения AI-ассистента
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.norm_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(512) NOT NULL,
    doc_type VARCHAR(64) NOT NULL DEFAULT 'norm',  -- norm, gost, snip, pp, letter, other
    doc_number VARCHAR(128) DEFAULT '',            -- номер документа (СП 70.13330.2022)
    content TEXT DEFAULT '',                        -- текст / выдержки
    file_url TEXT DEFAULT '',
    file_name VARCHAR(256) DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_by INTEGER REFERENCES t_p78845984_auto_house_cost_calc.staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE t_p78845984_auto_house_cost_calc.norm_documents IS 'Нормативные документы (СП, ГОСТ, ПП РФ) для контекста AI-ассистента';
