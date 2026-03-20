INSERT INTO t_p78845984_auto_house_cost_calc.materials
  (category, name, unit, price_per_unit, qty_formula, sort_order, item_type, best_price, best_price_supplier_id, best_price_updated_at)
SELECT
  pl.category,
  pl.material_name,
  pl.unit,
  pl.min_price,
  '0',
  0,
  'material',
  pl.min_price,
  3,
  NOW()
FROM (
  SELECT
    pl.category,
    pl.material_name,
    pl.unit,
    MIN(pl.price_per_unit) AS min_price,
    ROW_NUMBER() OVER (PARTITION BY LOWER(pl.material_name) ORDER BY MIN(pl.price_per_unit)) AS rn
  FROM t_p78845984_auto_house_cost_calc.supplier_price_list pl
  WHERE pl.supplier_id = 3
    AND pl.category != 'Прочее'
    AND NOT EXISTS (
      SELECT 1 FROM t_p78845984_auto_house_cost_calc.materials m
      WHERE LOWER(m.name) = LOWER(pl.material_name)
    )
  GROUP BY pl.category, pl.material_name, pl.unit
) pl
WHERE pl.rn = 1;