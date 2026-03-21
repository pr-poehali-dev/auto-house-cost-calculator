INSERT INTO t_p78845984_auto_house_cost_calc.companies
  (id, is_default, company_name, full_name, director_name, director_title, updated_at)
VALUES
  (1, TRUE, 'ООО "СТРОЙКОМПЛЕКТ"', 'Общество с ограниченной ответственностью "СТРОЙКОМПЛЕКТ"',
   'Дудин Александр Владимирович', 'Генеральный директор', NOW());

UPDATE t_p78845984_auto_house_cost_calc.contract_templates SET company_id = 1 WHERE id = 1;
