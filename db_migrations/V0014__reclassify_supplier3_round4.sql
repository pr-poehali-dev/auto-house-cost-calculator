-- Металлопрокат: сталь угловая, электроды
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Металлопрокат'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%сталь угловая%'
    OR material_name ILIKE '%электроды%'
);

-- Крепёж и метизы: угол крепежный, шайба, шпилька, шуруп
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Крепёж и метизы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%угол крепежный%'
    OR material_name ILIKE '%шайба%'
    OR material_name ILIKE '%шпилька%'
    OR material_name ILIKE '%шуруп%'
);

-- Кровля: торцевая планка, Шинглас, шапка конька
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Кровля'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%торцевая планка%'
    OR material_name ILIKE '%шинглас%'
    OR material_name ILIKE '%шапка%'
);

-- Электрика: труба гофрированная ПВХ
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Электрика'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%труба гофрированная ПВХ%'
);

-- Сантехника: труба ПНД, труба д.25, фитинг
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Сантехника'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%труба ПНД%'
    OR material_name ILIKE '%труба д.25%'
    OR material_name ILIKE '%фитинг Varmega%'
);

-- Фасадные системы: СП / стеновая (сэндвич-панели)
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Фасадные системы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%СП / стеновая%'
);

-- Инструмент и расходники: степлер, уайт-спирит, шпагат
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инструмент и расходники'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%степлер%'
    OR material_name ILIKE '%уайт-спирит%'
    OR material_name ILIKE '%шпагат%'
);

-- Дерево и пиломатериалы: угол внутренний деревянный
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Дерево и пиломатериалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%угол внутренний деревянный%'
);