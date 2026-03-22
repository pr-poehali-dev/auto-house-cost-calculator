-- Удаляем facade, section и дублирующие render (sort_order 2,3,4) для всех 6 проектов
-- Оставляем только: главный рендер (sort_order=1) и план (sort_order=5)
UPDATE t_p78845984_auto_house_cost_calc.project_files
SET file_type = 'other'
WHERE id IN (19,20,21, 23,24,25, 27,28,29, 31,32,33, 35,36,37, 39,40,41);