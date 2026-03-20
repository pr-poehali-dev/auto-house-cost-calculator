CREATE TABLE t_p78845984_auto_house_cost_calc.price_list_versions (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.suppliers(id),
    version_date DATE NOT NULL DEFAULT CURRENT_DATE,
    file_name VARCHAR(256) NULL DEFAULT '',
    items_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p78845984_auto_house_cost_calc.price_list_archive (
    id SERIAL PRIMARY KEY,
    version_id INTEGER NOT NULL REFERENCES t_p78845984_auto_house_cost_calc.price_list_versions(id),
    supplier_id INTEGER NOT NULL,
    material_name VARCHAR(256) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'шт',
    price_per_unit NUMERIC(12,2) NOT NULL,
    category VARCHAR(128) NOT NULL DEFAULT 'Прочее',
    article VARCHAR(64) NULL DEFAULT '',
    note TEXT NULL DEFAULT '',
    valid_from DATE NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_list_archive_supplier ON t_p78845984_auto_house_cost_calc.price_list_archive(supplier_id);
CREATE INDEX idx_price_list_versions_supplier ON t_p78845984_auto_house_cost_calc.price_list_versions(supplier_id, version_date DESC);