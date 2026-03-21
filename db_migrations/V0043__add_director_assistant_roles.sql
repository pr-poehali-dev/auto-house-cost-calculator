INSERT INTO t_p78845984_auto_house_cost_calc.roles (code, name)
VALUES 
  ('director', 'Руководитель'),
  ('assistant', 'Помощник руководителя')
ON CONFLICT (code) DO NOTHING;