INSERT INTO t_p78845984_auto_house_cost_calc.staff (login, password_hash, full_name, role_code)
VALUES (
  'alexander',
  encode(sha256('Alexander2024!'::bytea), 'hex'),
  'Александр Дудин',
  'manager'
);