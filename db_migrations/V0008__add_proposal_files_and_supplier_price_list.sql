-- Таблица загруженных файлов КП от поставщиков
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.proposal_files (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
    rfq_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.rfq(id),
    file_name VARCHAR(256) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(32) NOT NULL DEFAULT 'pdf',
    parsed_items JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица ценовых предложений поставщиков (новые материалы + цены)
CREATE TABLE IF NOT EXISTS t_p78845984_auto_house_cost_calc.supplier_price_list (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
    material_id INTEGER REFERENCES t_p78845984_auto_house_cost_calc.materials(id),
    material_name VARCHAR(256) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'шт',
    price_per_unit NUMERIC(12,2) NOT NULL,
    category VARCHAR(128) NOT NULL DEFAULT 'Прочее',
    article VARCHAR(64) DEFAULT '',
    note TEXT DEFAULT '',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    is_new_material BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);