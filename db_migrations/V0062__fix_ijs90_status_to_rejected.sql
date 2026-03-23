
-- Проект "ИЖС 90" (id=19) был ошибочно согласован вместо отклонения
-- Комментарий "на доработку" подтверждает, что менеджер хотел отклонить
UPDATE t_p78845984_auto_house_cost_calc.house_projects
SET calc_status = 'rejected',
    locked_by = NULL,
    locked_at = NULL
WHERE id = 19;

-- Обновляем запись в истории
UPDATE t_p78845984_auto_house_cost_calc.project_reviews
SET action = 'rejected'
WHERE project_id = 19 AND action = 'approved' AND comment = 'на доработку';
