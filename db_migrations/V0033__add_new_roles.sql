INSERT INTO t_p78845984_auto_house_cost_calc.roles (code, name) VALUES
  ('manager', 'Менеджер по продажам'),
  ('build_manager', 'Руководитель строительства'),
  ('admin', 'Администратор')
ON CONFLICT (code) DO NOTHING;
