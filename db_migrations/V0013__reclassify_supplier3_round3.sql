-- Кровля: профлист С-8, планка конька, снеговой барьер, подкладочный ковер, проходной элемент
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Кровля'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%профилированный лист%'
    OR material_name ILIKE '%снеговой барьер%'
    OR material_name ILIKE '%подкладочный ковер%'
    OR material_name ILIKE '%планка конька%'
    OR material_name ILIKE '%проходной элемент%'
    OR material_name ILIKE '%праймер битумный%'
);

-- Инженерия: плиты теплоизоляционные, пленка техническая
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инженерия'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%плиты тепло%'
    OR material_name ILIKE '%теплозвукоизоляц%'
    OR material_name ILIKE '%пленка техническая%'
    OR material_name ILIKE '%плёнка укрывная%'
);

-- Сантехника: люк, отвод д 110, переходник
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Сантехника'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%люк%'
    OR material_name ILIKE '%отвод д 110%'
    OR material_name ILIKE '%отвод наружный%'
    OR material_name ILIKE '%переходник к узлу%'
);

-- Стройматериалы: цемент, плита перекрытия, противоморозная добавка, проволока
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Стройматериалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%цемент%'
    OR material_name ILIKE '%плита перекрытия%'
    OR material_name ILIKE '%противоморозная добавка%'
    OR material_name ILIKE '%проволока%'
    OR material_name ILIKE '%лист сетка%'
    OR material_name ILIKE '%сетка металлическая%'
);

-- Металлопрокат: пластина крепежная
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Металлопрокат'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%пластина крепежная%'
);

-- Фасадные системы: панель стеновая МВП
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Фасадные системы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%панель стеновая%'
);

-- Отделочные материалы: отбеливатель для дерева, состав огнебиозащитный, очиститель пены, плинтус, ГКЛ
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Отделочные материалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%отбеливатель для дерева%'
    OR material_name ILIKE '%огнебиозащитный%'
    OR material_name ILIKE '%очиститель%пены%'
    OR material_name ILIKE '%плинтус%'
    OR material_name ILIKE '%ремонтно-отделочные работы%'
);

-- Электрика: рубильник
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Электрика'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%рубильник%'
);

-- Инструмент и расходники: макловица, рулетка, сверло, карандаш, опрыскиватель
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инструмент и расходники'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%макловица%'
    OR material_name ILIKE '%рулетка%'
    OR material_name ILIKE '%сверло%'
    OR material_name ILIKE '%карандаш%'
    OR material_name ILIKE '%опрыскиватель%'
);

-- Дерево и пиломатериалы: плинтус деревянный (уже в отделке), добавляем деревянные изделия
UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Дерево и пиломатериалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%черенок%'
);