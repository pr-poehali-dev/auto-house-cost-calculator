UPDATE t_p78845984_auto_house_cost_calc.supplier_price_list
SET category = 'Инженерия'
WHERE supplier_id = 3
  AND category != 'Инженерия'
  AND material_name ILIKE '%утеплитель%'
  AND material_name NOT ILIKE '%панель%';