UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Утеплители'
WHERE supplier_id = 3 AND (
    material_name ILIKE '%утеплитель%'
    OR material_name ILIKE '%пеноплекс%'
    OR material_name ILIKE '%пенополистирол%'
    OR material_name ILIKE '%пенополиуретан%'
    OR material_name ILIKE '%минвата%'
    OR material_name ILIKE '%мин-вата%'
    OR material_name ILIKE '%минеральная вата%'
    OR material_name ILIKE '%базальтовая вата%'
    OR material_name ILIKE '%MARCON SHUBA%'
    OR material_name ILIKE '%теплозвукоизоляц%'
    OR material_name ILIKE '%плиты тепло%'
)
AND material_name NOT ILIKE '%панель%'
AND material_name NOT ILIKE '%дюбель%'
AND material_name NOT ILIKE '%крепеж%';