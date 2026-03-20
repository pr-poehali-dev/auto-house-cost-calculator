-- Сантехника — обновляем best_price из прайса поставщика
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Сантехника' AND material_name ILIKE '%труба%' AND (material_name ILIKE '%25%' OR material_name ILIKE '%ПНД%') AND price_per_unit BETWEEN 10 AND 500),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%труба полипропиленовая%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Сантехника' AND material_name ILIKE '%клапан%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%радиатор%';

-- Стены и перекрытия — бетон, кирпич, газоблок (исправленные цены)
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%бетон%' AND price_per_unit BETWEEN 3000 AND 15000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name = 'Бетон М300 (B22.5)';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%газобетон%' AND price_per_unit BETWEEN 3000 AND 30000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%газобетонный блок%';

-- Электрика — автоматы, розетки, щиты
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Электрика' AND material_name ILIKE '%выключатель автомат%' AND price_per_unit BETWEEN 100 AND 2000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%автомат%' OR name ILIKE '%выключатель автомат%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Электрика' AND (material_name ILIKE '%ЩРН%' OR material_name ILIKE '%бокс%') AND price_per_unit BETWEEN 100 AND 3000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%щит%' OR name ILIKE '%бокс%';

-- Отделка стен и потолков — ГКЛ, штукатурка, шпаклёвка
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%гипсокартон%' OR material_name ILIKE '%волма-ГКЛ%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%гипсокартон%';

-- Кровля — профнастил, мембрана, металлочерепица
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Инженерия' AND (material_name ILIKE '%пленка%' OR material_name ILIKE '%пароизоляц%') AND price_per_unit BETWEEN 500 AND 10000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%гидроизоляционная мембрана%';

-- Черновые полы — новые позиции из прайса
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Черновые полы', 'Наливной пол быстротвердеющий 20кг', 'мешок', 850.00, '0', 50, 'material', 'Наливной пол самовыравнивающийся'),
  ('Черновые полы', 'Пескобетон М300 40кг', 'мешок', 320.00, '0', 60, 'material', 'Пескобетон для стяжки');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND (material_name ILIKE '%наливной пол%') AND price_per_unit BETWEEN 400 AND 5000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Черновые полы' AND name ILIKE '%наливной пол%';

-- Стройматериалы — добавим портландцемент в Фундамент
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Фундамент', 'Цемент ЦЕМ I 42.5 (50кг)', 'мешок', 550.00, '0', 90, 'material', 'Портландцемент M500'),
  ('Фундамент', 'Щебень фракция 20-40', 'м³', 2800.00, '0', 95, 'material', 'Щебень гранитный');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%портландцемент%' AND price_per_unit BETWEEN 300 AND 1500),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Фундамент' AND name ILIKE '%цемент%';