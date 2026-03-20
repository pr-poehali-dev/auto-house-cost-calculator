UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Водосточные системы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%водост%'
    OR material_name ILIKE '%желоб%'
    OR material_name ILIKE '%воронка%'
    OR material_name ILIKE '%колено трубы%'
    OR material_name ILIKE '%колено сливн%'
    OR material_name ILIKE '%соединитель желоба%'
    OR material_name ILIKE '%держатель желоба%'
    OR material_name ILIKE '%держатель трубы%'
    OR material_name ILIKE '%угол желоба%'
    OR material_name ILIKE '%заглушка желоба%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Кровля'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%металлочерепица%'
    OR material_name ILIKE '%профнастил%'
    OR material_name ILIKE '%ондулин%'
    OR material_name ILIKE '%конёк%'
    OR material_name ILIKE '%конек%'
    OR material_name ILIKE '%снегозадержатель%'
    OR material_name ILIKE '%ендова%'
    OR material_name ILIKE '%кровел%'
    OR material_name ILIKE '%фасонное изделие%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Фасадные системы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%фасадная кассета%'
    OR material_name ILIKE '%кассета ЮК%'
    OR material_name ILIKE '%фасадн%'
    OR material_name ILIKE '%упаковка для ф/кассет%'
    OR material_name ILIKE '%сайдинг%'
    OR material_name ILIKE '%вентфасад%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Крепёж и метизы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%саморез%'
    OR material_name ILIKE '%дюбель%'
    OR material_name ILIKE '%заклепка%'
    OR material_name ILIKE '%закlepка%'
    OR material_name ILIKE '%болт%'
    OR material_name ILIKE '%гайка%'
    OR material_name ILIKE '%анкер%'
    OR material_name ILIKE '%скоба%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инженерия'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%утеплитель%'
    OR material_name ILIKE '%пароизоляц%'
    OR material_name ILIKE '%гидроизоляц%'
    OR material_name ILIKE '%пенополистирол%'
    OR material_name ILIKE '%пеноплекс%'
    OR material_name ILIKE '%пенополиуретан%'
    OR material_name ILIKE '%пена монтажн%'
    OR material_name ILIKE '%пленка гидро%'
    OR material_name ILIKE '%пленка паро%'
    OR material_name ILIKE '%мембран%'
    OR material_name ILIKE '%герметик%'
    OR material_name ILIKE '%мастика%'
    OR material_name ILIKE '%атмосфера д%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Металлопрокат'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%швеллер%'
    OR material_name ILIKE '%арматура%'
    OR material_name ILIKE '%уголок%'
    OR material_name ILIKE '%двутавр%'
    OR material_name ILIKE '%балка%'
    OR material_name ILIKE '%труба металл%'
    OR material_name ILIKE '%профильная труба%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инструмент и расходники'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%валик%'
    OR material_name ILIKE '%кисть%'
    OR material_name ILIKE '%лопата%'
    OR material_name ILIKE '%черенок%'
    OR material_name ILIKE '%перчатки%'
    OR material_name ILIKE '%диск%'
    OR material_name ILIKE '%бита%'
    OR material_name ILIKE '%пистолет для пены%'
);

UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Отделочные материалы'
WHERE supplier_id = 3 AND category = 'Прочее' AND (
    material_name ILIKE '%краска%'
    OR material_name ILIKE '%грунт%'
    OR material_name ILIKE '%шпаклёв%'
    OR material_name ILIKE '%штукатурк%'
    OR material_name ILIKE '%наливной пол%'
    OR material_name ILIKE '%клей%'
    OR material_name ILIKE '%эпоксидн%'
    OR material_name ILIKE '%разбавитель%'
    OR material_name ILIKE '%отвердитель%'
    OR material_name ILIKE '%грунт-эмаль%'
    OR material_name ILIKE '%песок кварцевый%'
);