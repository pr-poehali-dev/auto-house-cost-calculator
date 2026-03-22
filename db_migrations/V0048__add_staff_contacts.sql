ALTER TABLE t_p78845984_auto_house_cost_calc.staff
  ADD COLUMN IF NOT EXISTS phone varchar(20),
  ADD COLUMN IF NOT EXISTS email varchar(128),
  ADD COLUMN IF NOT EXISTS bitrix_user_id integer,
  ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_bitrix boolean DEFAULT true;