
-- Обновляем старый лид JivoSite #4 данными из нового лида #14
UPDATE t_p78845984_auto_house_cost_calc.leads
SET name = 'Client 38464',
    phone = '+79281749448',
    email = 'rostov@stroitelstvo-dom.ru',
    source_detail = 'JivoSite (https://rostov.stroitelstvo-dom.ru)',
    updated_at = NOW()
WHERE id = 4;

-- Обновляем комментарий создания лида #4
UPDATE t_p78845984_auto_house_cost_calc.crm_events
SET content = 'Источник: JivoSite
Сайт: https://rostov.stroitelstvo-dom.ru
Клиент: Client 38464
Телефон: +79281749448
Email: rostov@stroitelstvo-dom.ru
Сообщение: Интересует дом под ключ'
WHERE lead_id = 4 AND type = 'created';

-- Деактивируем дубли (лиды 13 и 14 — то же письмо, что #4)
UPDATE t_p78845984_auto_house_cost_calc.leads
SET is_active = false, stage = 'rejected', rejected_reason = 'Дубль лида #4'
WHERE id IN (13, 14);
