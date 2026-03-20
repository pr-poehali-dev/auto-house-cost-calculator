-- Сбрасываем некорректные best_price (несовместимые единицы)
UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%гидроизоляционная мембрана%'; -- рулон vs м²

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%утеплитель кровельный%'; -- упаковка vs м²

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%краска интерьерная%'; -- ведро vs л

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%кирпич рядовой%'; -- шт vs тыс.шт

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%клей для утеплителя%'; -- мешок vs кг

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%заливка%бетона%'; -- это работа, не материал

UPDATE t_p78845984_auto_house_cost_calc.materials SET best_price = NULL, best_price_supplier_id = NULL, best_price_updated_at = NULL
WHERE name ILIKE '%арматура%'; -- прайс в шт/м, каталог в т

-- Исправляем: металлочерепица — берём минимальную цену за м² (только позиции с "м²" в unit или c реальными ценами)
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND category='Кровля' AND material_name ILIKE '%металлочерепица%' AND unit ILIKE '%м%' AND price_per_unit BETWEEN 400 AND 2500),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%металлочерепица%';

-- Бетон М300 — только прямое совпадение
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND material_name ILIKE '%бетон%' AND unit ILIKE '%м%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name = 'Бетон М300 (B22.5)';

-- Газобетонный блок D500 — м³
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND material_name ILIKE '%газобетонный%' AND price_per_unit > 1000),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%газобетонный%';

-- Утеплитель фасадный: пеноплекс за м² (пересчитаем: упак ~0.69м² * 8шт = 5.52м²)
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = ROUND((SELECT MIN(price_per_unit)/5.52 FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND material_name ILIKE '%пеноплекс%' AND material_name ILIKE '%50мм%'), 2),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%утеплитель фасадный%';

-- Дюбель-гриб — шт, корректно
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND material_name ILIKE '%дюбель%' AND (material_name ILIKE '%90%' OR material_name ILIKE '%тепло%' OR material_name ILIKE '%изол%') AND price_per_unit < 50),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%дюбель-гриб%' OR name ILIKE '%дюбель гриб%';

-- Кабель — пм, корректно (берём ВВГнг 3x2.5)
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND category='Электрика' AND material_name ILIKE '%кабель%' AND material_name ILIKE '%3х2%' AND price_per_unit BETWEEN 30 AND 300),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%кабель%3x2%' OR name ILIKE '%кабель%3х2%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list
    WHERE supplier_id=3 AND category='Электрика' AND material_name ILIKE '%кабель%' AND material_name ILIKE '%3х1%' AND price_per_unit BETWEEN 20 AND 200),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE name ILIKE '%кабель%3x1%' OR name ILIKE '%кабель%3х1%';

-- ══ ФАЗА 2: добавляем новые категории и ключевые позиции ══

-- Водосточные системы (важная категория, была только агрегированно в Кровля)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Водосточные системы', 'Желоб водосточный 3м', 'шт', 590.00, '0', 10, 'material', 'Желоб водосточный длина 3м'),
  ('Водосточные системы', 'Труба водосточная 3м', 'шт', 420.00, '0', 20, 'material', 'Труба водосточная длина 3м'),
  ('Водосточные системы', 'Держатель желоба', 'шт', 130.00, '0', 30, 'material', 'Держатель желоба металлический'),
  ('Водосточные системы', 'Воронка водосточная', 'шт', 150.00, '0', 40, 'material', 'Воронка выпускная'),
  ('Водосточные системы', 'Колено водосточной трубы', 'шт', 130.00, '0', 50, 'material', 'Колено трубы'),
  ('Водосточные системы', 'Угол желоба наружный', 'шт', 290.00, '0', 60, 'material', 'Угол желоба 90 градусов');

-- Обновляем best_price для водосточных элементов
UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%желоб водосточный%' AND material_name ILIKE '%3000%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Водосточные системы' AND name='Желоб водосточный 3м';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%труба водосточная%' AND material_name ILIKE '%3000%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Водосточные системы' AND name='Труба водосточная 3м';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%держатель желоба%' AND price_per_unit < 300),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Водосточные системы' AND name='Держатель желоба';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%воронка выпускная%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Водосточные системы' AND name='Воронка водосточная';

-- Металлопрокат (новая категория)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Металлопрокат', 'Арматура Ø12 A-III', 'пм', 65.00, '0', 10, 'material', 'Арматура стальная Ø12мм'),
  ('Металлопрокат', 'Уголок стальной 50x50x5', 'пм', 280.00, '0', 20, 'material', 'Уголок металлический'),
  ('Металлопрокат', 'Швеллер 16П', 'пм', 1200.00, '0', 30, 'material', 'Швеллер стальной'),
  ('Металлопрокат', 'Профильная труба 60x40', 'пм', 380.00, '0', 40, 'material', 'Труба профильная стальная'),
  ('Металлопрокат', 'Труба стальная Ø102', 'пм', 450.00, '0', 50, 'material', 'Труба стальная');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Металлопрокат' AND material_name ILIKE '%арматура%' AND price_per_unit BETWEEN 30 AND 200),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Металлопрокат' AND name ILIKE '%арматура%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Металлопрокат' AND material_name ILIKE '%швеллер%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Металлопрокат' AND name ILIKE '%швеллер%';

-- Крепёж и метизы (новая категория)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Крепёж и метизы', 'Саморез кровельный 4.8x35', 'шт', 4.50, '0', 10, 'material', 'Саморез с буром для кровли'),
  ('Крепёж и метизы', 'Анкер распорный М10x80', 'шт', 18.00, '0', 20, 'material', 'Анкер для крепления'),
  ('Крепёж и метизы', 'Гвоздь строительный 3.5x90', 'кг', 95.00, '0', 30, 'material', 'Гвоздь строительный'),
  ('Крепёж и метизы', 'Болт М12x80 с гайкой', 'шт', 28.00, '0', 40, 'material', 'Болт с гайкой и шайбой'),
  ('Крепёж и метизы', 'Дюбель нейлоновый 10x80', 'шт', 5.50, '0', 50, 'material', 'Дюбель нейлоновый');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Крепёж и метизы' AND material_name ILIKE '%саморез%' AND price_per_unit < 20),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Крепёж и метизы' AND name ILIKE '%саморез%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Крепёж и метизы' AND material_name ILIKE '%гвозди%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Крепёж и метизы' AND name ILIKE '%гвоздь%';

-- Утеплители (новая категория)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Утеплители', 'Минеральная вата 100мм (плита)', 'м²', 380.00, '0', 10, 'material', 'Базальтовая/минеральная вата, плита 100мм'),
  ('Утеплители', 'Пеноплекс ЭППС 50мм', 'м²', 450.00, '0', 20, 'material', 'Экструдированный пенополистирол 50мм'),
  ('Утеплители', 'Пеноплекс ЭППС 30мм', 'м²', 310.00, '0', 30, 'material', 'Экструдированный пенополистирол 30мм'),
  ('Утеплители', 'Утеплитель рулонный 50мм', 'м²', 220.00, '0', 40, 'material', 'Утеплитель рулонный Технониколь');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = ROUND((SELECT MIN(price_per_unit)/5.52 FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%пеноплекс%50мм%'), 2),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Утеплители' AND name ILIKE '%50мм%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = ROUND((SELECT MIN(price_per_unit)/8.97 FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%пеноплекс%30мм%'), 2),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Утеплители' AND name ILIKE '%30мм%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = ROUND((SELECT MIN(price_per_unit)/15 FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Утеплители' AND material_name ILIKE '%технониколь%'), 2),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Утеплители' AND name ILIKE '%рулонный%';

-- Фасадные системы (новая категория)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Фасадные системы', 'Фасадная кассета ЮК', 'м²', 2800.00, '0', 10, 'material', 'Фасадная металлическая кассета'),
  ('Фасадные системы', 'Сэндвич-панель стеновая 100мм', 'м²', 2400.00, '0', 20, 'material', 'Сэндвич-панель с минватой'),
  ('Фасадные системы', 'Профнастил С-8', 'м²', 520.00, '0', 30, 'material', 'Профилированный лист С-8');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%фасадная кассета%'),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Фасадные системы' AND name ILIKE '%кассета%';

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND material_name ILIKE '%профилированный лист%' AND material_name ILIKE '%С-8%' AND price_per_unit > 100),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Фасадные системы' AND name ILIKE '%профнастил%';

-- Дерево и пиломатериалы (новая категория)
INSERT INTO t_p78845984_auto_house_cost_calc.materials (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, description)
VALUES
  ('Дерево и пиломатериалы', 'Доска обрезная 50x150x6000', 'м³', 28000.00, '0', 10, 'material', 'Доска хвойная сухая'),
  ('Дерево и пиломатериалы', 'Брус 150x150x6000', 'м³', 32000.00, '0', 20, 'material', 'Брус строительный хвойный'),
  ('Дерево и пиломатериалы', 'Фанера ФК 12мм (1220x2440)', 'м²', 780.00, '0', 30, 'material', 'Фанера ФК влагостойкая'),
  ('Дерево и пиломатериалы', 'OSB-3 18мм (1220x2440)', 'м²', 920.00, '0', 40, 'material', 'ОСБ-3 плита'),
  ('Дерево и пиломатериалы', 'Вагонка хвойная 14x90мм', 'м²', 420.00, '0', 50, 'material', 'Вагонка сосна/ель');

UPDATE t_p78845984_auto_house_cost_calc.materials SET
  best_price = (SELECT MIN(price_per_unit) FROM t_p78845984_auto_house_cost_calc.supplier_price_list WHERE supplier_id=3 AND category='Дерево и пиломатериалы' AND material_name ILIKE '%вагонка%' AND price_per_unit > 100),
  best_price_supplier_id = 3, best_price_updated_at = NOW()
WHERE category='Дерево и пиломатериалы' AND name ILIKE '%вагонка%';