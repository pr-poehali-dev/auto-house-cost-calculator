ALTER TABLE t_p78845984_auto_house_cost_calc.rfq
  ADD COLUMN IF NOT EXISTS order_id integer REFERENCES t_p78845984_auto_house_cost_calc.orders(id);