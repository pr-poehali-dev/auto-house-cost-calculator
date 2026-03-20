-- ══ ФАЗА 1: обновляем best_price у существующих материалов ══

-- Металлочерепица
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%металлочерепица%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%металлочерепица%';

-- Водосточная система (пм) — берём желоб 3м / 3
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit)/3 FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%желоб водосточный%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%водосточная система%';

-- Гидроизоляционная мембрана
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND (material_name ILIKE '%мембрана%' OR material_name ILIKE '%пленка гидро%' OR material_name ILIKE '%атмосфера%')),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%гидроизоляционная мембрана%';

-- Утеплитель кровельный минвата
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Утеплители' AND (material_name ILIKE '%минвата%' OR material_name ILIKE '%мин-вата%' OR material_name ILIKE '%кнауф%' OR material_name ILIKE '%технониколь%')),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%утеплитель кровельный%';

-- Утеплитель фасадный ЭППС / пеноплекс
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Утеплители' AND (material_name ILIKE '%пеноплекс%' OR material_name ILIKE '%пенополистирол%')),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%утеплитель фасадный%';

-- Арматура Ø12
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Металлопрокат' AND material_name ILIKE '%арматура%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%арматура%';

-- Бетон М300
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Стройматериалы' AND material_name ILIKE '%бетон%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%бетон%';

-- Кирпич рядовой
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Стройматериалы' AND material_name ILIKE '%кирпич%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%кирпич%';

-- Дюбель-гриб
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Крепёж и метизы' AND material_name ILIKE '%дюбель%' AND (material_name ILIKE '%изол%' OR material_name ILIKE '%тепло%')),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%дюбель-гриб%' OR name ILIKE '%дюбель гриб%';

-- Краска интерьерная
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Отделочные материалы' AND material_name ILIKE '%краска%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%краска%';

-- Штукатурка гипсовая
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Отделочные материалы' AND material_name ILIKE '%штукатурк%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%штукатурка гипсовая%';

-- Шпаклёвка финишная
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Отделочные материалы' AND material_name ILIKE '%шпаклёв%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%шпаклёвка%';

-- Кабель (электрика)
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Электрика' AND material_name ILIKE '%кабель%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%кабель%' OR name ILIKE '%провод%';

-- Клей для утеплителя
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND (material_name ILIKE '%клей%' AND (material_name ILIKE '%утеплит%' OR material_name ILIKE '%блок%'))),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%клей для утеплителя%';