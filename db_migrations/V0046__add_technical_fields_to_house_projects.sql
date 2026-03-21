-- Технические поля проекта по ТЗ
ALTER TABLE t_p78845984_auto_house_cost_calc.house_projects
  -- Фундамент
  ADD COLUMN IF NOT EXISTS foundation_material    varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS foundation_depth       varchar(64)  DEFAULT '',
  -- Внешние стены
  ADD COLUMN IF NOT EXISTS ext_wall_material      varchar(256) DEFAULT '',
  ADD COLUMN IF NOT EXISTS ext_wall_thickness     varchar(64)  DEFAULT '',
  -- Внутренние несущие стены
  ADD COLUMN IF NOT EXISTS int_bearing_material   varchar(256) DEFAULT '',
  ADD COLUMN IF NOT EXISTS int_bearing_thickness  varchar(64)  DEFAULT '',
  -- Перегородки
  ADD COLUMN IF NOT EXISTS partition_material     varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS partition_thickness    varchar(64)  DEFAULT '',
  -- Перекрытия
  ADD COLUMN IF NOT EXISTS floor_slab_material    varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS floor_slab_thickness   varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS floor_slab_area        varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS attic_slab_material    varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS attic_slab_thickness   varchar(64)  DEFAULT '',
  -- Окна и двери
  ADD COLUMN IF NOT EXISTS window_material        varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS window_profile         varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS window_color           varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS window_area            varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS door_info              varchar(256) DEFAULT '',
  -- Лестницы
  ADD COLUMN IF NOT EXISTS staircase_info         varchar(256) DEFAULT '',
  -- Кровля
  ADD COLUMN IF NOT EXISTS roof_material          varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS roof_area              varchar(64)  DEFAULT '',
  ADD COLUMN IF NOT EXISTS roof_style             varchar(64)  DEFAULT '',
  -- Инженерные системы
  ADD COLUMN IF NOT EXISTS heating_type          varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS water_supply           varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS sewage                 varchar(128) DEFAULT '',
  ADD COLUMN IF NOT EXISTS electrical             varchar(128) DEFAULT '';
