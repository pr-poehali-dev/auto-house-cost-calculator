-- Крепёж: гвозди
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Крепёж и метизы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%гвозди%'
    OR material_name ILIKE '%гвоздь%'
    OR material_name ILIKE '%лента уплотн%'
);

-- Электрика
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Электрика'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%кабель%'
    OR material_name ILIKE '%провод%'
    OR material_name ILIKE '%выключатель автомат%'
    OR material_name ILIKE '%УЗО%'
    OR material_name ILIKE '%ВД3-%'
    OR material_name ILIKE '%ВА47%'
    OR material_name ILIKE '%изолятор%'
    OR material_name ILIKE '%коробка распая%'
    OR material_name ILIKE '%бокс ЩРН%'
    OR material_name ILIKE '%корпус навесной%'
    OR material_name ILIKE '%ЩРН%'
);

-- Стройматериалы: кирпич, бетон, блоки, брусчатка, кольца
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Стройматериалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%кирпич%'
    OR material_name ILIKE '%бетон%'
    OR material_name ILIKE '%брусчатка%'
    OR material_name ILIKE '%блок%'
    OR material_name ILIKE '%кольцо стеновое%'
    OR material_name ILIKE '%ГКЛ%'
    OR material_name ILIKE '%гипсокартон%'
    OR material_name ILIKE '%Волма-ГКЛ%'
);

-- Дерево и пиломатериалы
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Дерево и пиломатериалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%вагонка%'
    OR material_name ILIKE '%доска%'
    OR material_name ILIKE '%брус%'
    OR material_name ILIKE '%фанера%'
    OR material_name ILIKE '%OSB%'
    OR material_name ILIKE '%деревянная панель%'
    OR material_name ILIKE '%пиломатериал%'
);

-- Инструмент и расходники: ванночки, вёдра, ёмкости, лезвия
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инструмент и расходники'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%ванночка%'
    OR material_name ILIKE '%ведро%'
    OR material_name ILIKE '%ёмкость строит%'
    OR material_name ILIKE '%емкость строит%'
    OR material_name ILIKE '%лезвие%'
    OR material_name ILIKE '%пистолет%'
    OR material_name ILIKE '%леска%'
);

-- Кровля: заглушка конька, планка завершающая
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Кровля'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%заглушка конька%'
    OR material_name ILIKE '%завершающая планка%'
    OR material_name ILIKE '%планка карнизная%'
    OR material_name ILIKE '%планка торцевая%'
    OR material_name ILIKE '%планка коньковая%'
);

-- Сантехника
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Сантехника'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%клапан запорн%'
    OR material_name ILIKE '%труба канализац%'
    OR material_name ILIKE '%тройник%'
    OR material_name ILIKE '%отвод канализац%'
    OR material_name ILIKE '%муфта%'
    OR material_name ILIKE '%колодец%'
    OR material_name ILIKE '%НПВХ%'
);

-- Инженерия: вент труба
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инженерия'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%вент. труба%'
    OR material_name ILIKE '%вент труба%'
    OR material_name ILIKE '%KNAUF INSULATION%'
);

-- Мебель и отделка: двери
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Мебель и отделка'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%дверь%'
    OR material_name ILIKE '%дверей%'
);