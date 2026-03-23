import { useState } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  area: number;
  floor: number;
}

export interface ObjectInfo {
  // Услуги
  services: string[];
  // Основное
  project_name: string;
  project_code: string;
  style: string;
  // Характеристики объекта
  in_cottage_village: boolean | null;
  escrow: boolean | null;
  green_house: boolean | null;
  winter_construction: boolean | null;
  permanent_residence: boolean | null;
  modular: boolean | null;
  custom_project: boolean | null;
  has_partners: boolean | null;
  use_tim: boolean | null;
  // ПО
  software_2d: string[];
  software_3d: string[];
  software_viz: string[];
  // Документация
  has_typical_docs: boolean | null;
  has_homekit: boolean | null;
  // ТЭП
  build_area: number;
  house_area: number;
  above_ground_volume: number;
  floors: number;
  underground_floors: number;
  house_height: number;
  ceiling_height: number;
  // Объёмно-планировочные
  bedrooms: number;
  bathrooms: number;
  balconies: number;
  loggias: number;
  has_combined_kitchen: boolean | null;
  has_fireplace: boolean | null;
  has_veranda: boolean | null;
  has_terrace: boolean | null;
  has_garage: boolean | null;
  has_attic: boolean | null;
  has_basement: boolean | null;
  has_green_roof: boolean | null;
  // Конструктив
  ext_wall_material: string;
  ext_wall_thickness: number;
  int_wall_material: string;
  int_wall_thickness: number;
  roof_material: string;
  roof_type: string;
  foundation_type: string;
  facade_material: string;
  // Инженерия
  electricity: string;
  gas: string;
  heating: string;
  water_supply: string;
  sewage: string;
  heating_type: string;
  ventilation: string;
  has_ac: boolean | null;
  has_fire_system: boolean | null;
  has_leak_sensors: boolean | null;
  has_sound_insulation: boolean | null;
  has_air_noise_isolation: boolean | null;
  has_heat_meter: boolean | null;
  has_auto_heating: boolean | null;
  // Экспликация
  rooms: Room[];
}

export const EMPTY_INFO: ObjectInfo = {
  services: [],
  project_name: "",
  project_code: "",
  style: "",
  in_cottage_village: null,
  escrow: null,
  green_house: null,
  winter_construction: null,
  permanent_residence: null,
  modular: null,
  custom_project: null,
  has_partners: null,
  use_tim: null,
  software_2d: [],
  software_3d: [],
  software_viz: [],
  has_typical_docs: null,
  has_homekit: null,
  build_area: 0,
  house_area: 0,
  above_ground_volume: 0,
  floors: 1,
  underground_floors: 0,
  house_height: 0,
  ceiling_height: 0,
  bedrooms: 0,
  bathrooms: 0,
  balconies: 0,
  loggias: 0,
  has_combined_kitchen: null,
  has_fireplace: null,
  has_veranda: null,
  has_terrace: null,
  has_garage: null,
  has_attic: null,
  has_basement: null,
  has_green_roof: null,
  ext_wall_material: "",
  ext_wall_thickness: 0,
  int_wall_material: "",
  int_wall_thickness: 0,
  roof_material: "",
  roof_type: "",
  foundation_type: "",
  facade_material: "",
  electricity: "",
  gas: "",
  heating: "",
  water_supply: "",
  sewage: "",
  heating_type: "",
  ventilation: "",
  has_ac: null,
  has_fire_system: null,
  has_leak_sensors: null,
  has_sound_insulation: null,
  has_air_noise_isolation: null,
  has_heat_meter: null,
  has_auto_heating: null,
  rooms: [],
};

// ─── Константы ───────────────────────────────────────────────────────────────

const SERVICES = ["Строительство", "Архитектурное проектирование", "Дизайн интерьера", "Инженерное проектирование", "Авторский надзор"];
const STYLES = ["Классический", "Современный", "Хай-тек", "Минимализм", "Шале", "Скандинавский", "Барнхаус", "Прованс", "Лофт"];
const SW_2D = ["BriksCAD", "NanoCAD", "IntelliCAD", "AutoCAD", "Другое", "Не используется"];
const SW_3D = ["ArchiCAD", "SketchUp", "3ds Max", "Allplan", "Catia", "Revit", "Другое", "Не используется"];
const SW_VIZ = ["BriksCAD", "Lumion", "3ds Max", "Другое", "Не используется"];
const FOUNDATION_TYPES = ["Ленточный монолитный", "Плитный (УШП)", "Свайно-ростверковый", "Столбчатый", "Свайный (винтовые сваи)", "Комбинированный"];
const ROOF_TYPES = ["Двускатная", "Вальмовая", "Полувальмовая", "Плоская", "Мансардная", "Односкатная", "Многощипцовая"];
const GRID_OPTIONS = ["Центральное", "Индивидуальное", "Не предусмотрено"];
const HEATING_SOURCES = ["Центральное", "Индивидуальное", "Местное", "Не предусмотрено"];
const VENTILATION_TYPES = ["Естественная", "Принудительная", "Рекуперация"];

const ROOM_SUGGESTIONS = [
  "Гостиная", "Кухня", "Кухня-гостиная", "Спальня", "Мастер-спальня",
  "Детская", "Кабинет", "Санузел", "Ванная", "Прихожая", "Коридор",
  "Гардеробная", "Котельная", "Кладовая", "Постирочная", "Тамбур",
  "Терраса", "Веранда", "Гараж", "Мастерская",
];

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function Section({ title, color = "#FF6B1A", icon, children }: {
  title: string; color?: string; icon: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <div className="flex items-center gap-2.5">
          <Icon name={icon} size={15} style={{ color }} />
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
    />
  );
}

function NumInput({ value, onChange, placeholder, unit }: { value: number; onChange: (v: number) => void; placeholder?: string; unit?: string }) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value || ""}
        onChange={e => onChange(+e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", paddingRight: unit ? "3rem" : undefined }}
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{unit}</span>
      )}
    </div>
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
      style={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <option value="">— не выбрано —</option>
      {options.map(o => <option key={o} value={o} style={{ background: "#1a1f2e" }}>{o}</option>)}
    </select>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {([true, false] as const).map(v => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: value === v ? (v ? "rgba(0,255,136,0.15)" : "rgba(239,68,68,0.15)") : "rgba(255,255,255,0.05)",
            color: value === v ? (v ? "#00FF88" : "#ef4444") : "rgba(255,255,255,0.4)",
            border: `1px solid ${value === v ? (v ? "rgba(0,255,136,0.3)" : "rgba(239,68,68,0.3)") : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {v ? "Да" : "Нет"}
        </button>
      ))}
    </div>
  );
}

function MultiCheck({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o}
          onClick={() => toggle(o)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: selected.includes(o) ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
            color: selected.includes(o) ? "#a78bfa" : "rgba(255,255,255,0.45)",
            border: `1px solid ${selected.includes(o) ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Экспликация помещений ────────────────────────────────────────────────────

function RoomsExplication({ rooms, onChange }: { rooms: Room[]; onChange: (r: Room[]) => void }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const addRoom = (name: string) => {
    const room: Room = { id: Date.now().toString(), name, area: 0, floor: 1 };
    onChange([...rooms, room]);
    setShowSuggestions(false);
    setNewName("");
    setTimeout(() => setEditingId(room.id), 50);
  };

  const updateRoom = (id: string, patch: Partial<Room>) => {
    onChange(rooms.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRoom = (id: string) => onChange(rooms.filter(r => r.id !== id));

  const totalArea = rooms.reduce((s, r) => s + (r.area || 0), 0);
  const byFloor = rooms.reduce((acc, r) => {
    const f = r.floor || 1;
    if (!acc[f]) acc[f] = [];
    acc[f].push(r);
    return acc;
  }, {} as Record<number, Room[]>);

  const inp = "px-2.5 py-1.5 rounded-lg text-xs text-white outline-none";
  const inpSty = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div>
      {/* Итого */}
      {rooms.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{rooms.length} помещений</span>
          <span className="text-xs font-semibold text-white">{totalArea.toFixed(1)} м² общая площадь</span>
        </div>
      )}

      {/* Список по этажам */}
      {Object.entries(byFloor).sort(([a], [b]) => +a - +b).map(([floor, floorRooms]) => (
        <div key={floor} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,107,26,0.15)", color: "#FF6B1A" }}>{floor}</div>
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Этаж {floor}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>({floorRooms.reduce((s, r) => s + (r.area || 0), 0).toFixed(1)} м²)</span>
          </div>
          <div className="space-y-1.5">
            {floorRooms.map(room => (
              <div key={room.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {editingId === room.id ? (
                  <>
                    <input
                      autoFocus
                      value={room.name}
                      onChange={e => updateRoom(room.id, { name: e.target.value })}
                      className={`flex-1 ${inp}`}
                      style={inpSty}
                      placeholder="Наименование помещения"
                    />
                    <input
                      type="number"
                      value={room.area || ""}
                      onChange={e => updateRoom(room.id, { area: +e.target.value })}
                      className={`w-24 ${inp}`}
                      style={inpSty}
                      placeholder="Площадь"
                    />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>м²</span>
                    <input
                      type="number"
                      value={room.floor || ""}
                      onChange={e => updateRoom(room.id, { floor: +e.target.value })}
                      className={`w-16 ${inp}`}
                      style={inpSty}
                      placeholder="Эт."
                    />
                    <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <Icon name="Check" size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-white">{room.name || "—"}</span>
                    <span className="text-sm font-semibold" style={{ color: room.area ? "#FF6B1A" : "rgba(255,255,255,0.25)" }}>
                      {room.area ? `${room.area} м²` : "—"}
                    </span>
                    <button onClick={() => setEditingId(room.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <Icon name="Pencil" size={12} />
                    </button>
                    <button onClick={() => removeRoom(room.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors" style={{ color: "rgba(255,255,255,0.25)" }}>
                      <Icon name="X" size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Добавить помещение */}
      <div className="mt-3">
        {showSuggestions ? (
          <div>
            <div className="flex gap-2 mb-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newName.trim()) addRoom(newName.trim()); if (e.key === "Escape") setShowSuggestions(false); }}
                placeholder="Введите название или выберите ниже..."
                className={`flex-1 ${inp} text-sm`}
                style={{ ...inpSty, padding: "10px 12px" }}
              />
              {newName.trim() && (
                <button onClick={() => addRoom(newName.trim())}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,107,26,0.15)", color: "#FF6B1A", border: "1px solid rgba(255,107,26,0.3)" }}>
                  Добавить
                </button>
              )}
              <button onClick={() => setShowSuggestions(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10"
                style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROOM_SUGGESTIONS.filter(s => !newName || s.toLowerCase().includes(newName.toLowerCase())).map(s => (
                <button key={s} onClick={() => addRoom(s)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all hover:scale-105"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowSuggestions(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium w-full justify-center transition-all hover:bg-white/5"
            style={{ border: "1px dashed rgba(255,107,26,0.3)", color: "rgba(255,107,26,0.7)" }}>
            <Icon name="Plus" size={14} />
            Добавить помещение
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Главный компонент вкладки ────────────────────────────────────────────────

export default function ObjectInfoTab({
  info,
  onChange,
  onSave,
  saving,
}: {
  info: ObjectInfo;
  onChange: (patch: Partial<ObjectInfo>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof ObjectInfo>(k: K) => (v: ObjectInfo[K]) => onChange({ [k]: v });

  return (
    <div>
      {/* Шапка с кнопкой сохранения */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#FF6B1A" }}>Вкладка 1</div>
          <h3 className="font-display font-bold text-xl text-white">Информация об объекте</h3>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
          style={{ background: "#FF6B1A", color: "#fff" }}
        >
          <Icon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Сохраняю..." : "Сохранить"}
        </button>
      </div>

      {/* 1. Услуги */}
      <Section title="Услуги по проекту" icon="Briefcase" color="#FF6B1A">
        <MultiCheck options={SERVICES} selected={info.services} onChange={set("services")} />
      </Section>

      {/* 2. Наименование */}
      <Section title="Наименование и стиль" icon="Tag" color="#00D4FF">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Наименование проекта">
            <TextInput value={info.project_name} onChange={set("project_name")} placeholder='Например: «Двухэтажное шале КС-6»' />
          </Field>
          <Field label="Шифр проекта">
            <TextInput value={info.project_code} onChange={set("project_code")} placeholder="СП-115" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Архитектурный стиль">
              <div className="flex flex-wrap gap-2">
                {STYLES.map(s => (
                  <button key={s} onClick={() => set("style")(s)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: info.style === s ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.05)",
                      color: info.style === s ? "#00D4FF" : "rgba(255,255,255,0.45)",
                      border: `1px solid ${info.style === s ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Section>

      {/* 3. Особые условия */}
      <Section title="Условия строительства" icon="Settings2" color="#A855F7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["in_cottage_village", "Объект в коттеджном посёлке"],
            ["escrow", "Строительство с эскроу"],
            ["green_house", "Зелёный дом"],
            ["winter_construction", "Возможность строительства зимой"],
            ["permanent_residence", "Пригодность для постоянного проживания"],
            ["modular", "Модульное строительство (заводские конструкции)"],
            ["custom_project", "Возможность нетипового проекта"],
            ["has_partners", "Наличие партнёров по проекту"],
            ["use_tim", "Использование технологий ТИМ"],
          ] as [keyof ObjectInfo, string][]).map(([key, label]) => (
            <div key={key}>
              <Field label={label}>
                <YesNo value={info[key] as boolean | null} onChange={set(key) as (v: boolean) => void} />
              </Field>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. ПО */}
      <Section title="Используемое программное обеспечение" icon="Monitor" color="#00FF88">
        <div className="space-y-4">
          <Field label="2D-черчение">
            <MultiCheck options={SW_2D} selected={info.software_2d} onChange={set("software_2d")} />
          </Field>
          <Field label="3D-моделирование">
            <MultiCheck options={SW_3D} selected={info.software_3d} onChange={set("software_3d")} />
          </Field>
          <Field label="Визуализация и дизайн">
            <MultiCheck options={SW_VIZ} selected={info.software_viz} onChange={set("software_viz")} />
          </Field>
        </div>
      </Section>

      {/* 5. Документация */}
      <Section title="Документация и домокомплекты" icon="FileText" color="#FBBF24">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Типовая проектная документация">
            <YesNo value={info.has_typical_docs} onChange={set("has_typical_docs")} />
          </Field>
          <Field label="Наличие домокомплектов">
            <YesNo value={info.has_homekit} onChange={set("has_homekit")} />
          </Field>
        </div>
      </Section>

      {/* 6. ТЭП */}
      <Section title="Технико-экономические показатели" icon="BarChart2" color="#FF6B1A">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Площадь застройки">
            <NumInput value={info.build_area} onChange={set("build_area")} unit="м²" />
          </Field>
          <Field label="Площадь дома">
            <NumInput value={info.house_area} onChange={set("house_area")} unit="м²" />
          </Field>
          <Field label="Объём надземной части">
            <NumInput value={info.above_ground_volume} onChange={set("above_ground_volume")} unit="м³" />
          </Field>
          <Field label="Этажей надземных">
            <NumInput value={info.floors} onChange={set("floors")} />
          </Field>
          <Field label="Этажей подземных">
            <NumInput value={info.underground_floors} onChange={set("underground_floors")} />
          </Field>
          <Field label="Высота дома">
            <NumInput value={info.house_height} onChange={set("house_height")} unit="м" />
          </Field>
          <Field label="Высота потолков">
            <NumInput value={info.ceiling_height} onChange={set("ceiling_height")} unit="м" />
          </Field>
        </div>
      </Section>

      {/* 7. Объёмно-планировочные */}
      <Section title="Объёмно-планировочные решения" icon="LayoutGrid" color="#00D4FF">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Field label="Спален">
            <NumInput value={info.bedrooms} onChange={set("bedrooms")} />
          </Field>
          <Field label="Санузлов">
            <NumInput value={info.bathrooms} onChange={set("bathrooms")} />
          </Field>
          <Field label="Балконов">
            <NumInput value={info.balconies} onChange={set("balconies")} />
          </Field>
          <Field label="Лоджий">
            <NumInput value={info.loggias} onChange={set("loggias")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["has_combined_kitchen", "Совмещённая кухня-гостиная"],
            ["has_fireplace", "Камин"],
            ["has_veranda", "Веранда"],
            ["has_terrace", "Терраса"],
            ["has_garage", "Пристроенный гараж / автостоянка"],
            ["has_attic", "Чердачное помещение"],
            ["has_basement", "Подвал"],
            ["has_green_roof", "Эксплуатируемая / зелёная кровля"],
          ] as [keyof ObjectInfo, string][]).map(([key, label]) => (
            <Field key={key} label={label}>
              <YesNo value={info[key] as boolean | null} onChange={set(key) as (v: boolean) => void} />
            </Field>
          ))}
        </div>
      </Section>

      {/* 8. Конструктив */}
      <Section title="Конструктивные решения" icon="Layers" color="#A855F7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Материал внешних стен">
            <TextInput value={info.ext_wall_material} onChange={set("ext_wall_material")} placeholder="СИП-панели, Газоблок, Кирпич..." />
          </Field>
          <Field label="Толщина внешних стен">
            <NumInput value={info.ext_wall_thickness} onChange={set("ext_wall_thickness")} unit="мм" />
          </Field>
          <Field label="Материал внутренних перегородок">
            <TextInput value={info.int_wall_material} onChange={set("int_wall_material")} placeholder="Газоблок D400, Гипсокартон..." />
          </Field>
          <Field label="Толщина перегородок">
            <NumInput value={info.int_wall_thickness} onChange={set("int_wall_thickness")} unit="мм" />
          </Field>
          <Field label="Материал кровли">
            <TextInput value={info.roof_material} onChange={set("roof_material")} placeholder="Металлочерепица, Мягкая кровля..." />
          </Field>
          <Field label="Форма кровли">
            <SelectInput value={info.roof_type} onChange={set("roof_type")} options={ROOF_TYPES} />
          </Field>
          <Field label="Тип фундамента">
            <SelectInput value={info.foundation_type} onChange={set("foundation_type")} options={FOUNDATION_TYPES} />
          </Field>
          <Field label="Материал фасада">
            <TextInput value={info.facade_material} onChange={set("facade_material")} placeholder="Фасадная плитка, Штукатурка..." />
          </Field>
        </div>
      </Section>

      {/* 9. Инженерия */}
      <Section title="Подключение к сетям и инженерия" icon="Zap" color="#00FF88">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Электроснабжение">
            <SelectInput value={info.electricity} onChange={set("electricity")} options={GRID_OPTIONS} />
          </Field>
          <Field label="Газоснабжение">
            <SelectInput value={info.gas} onChange={set("gas")} options={GRID_OPTIONS} />
          </Field>
          <Field label="Теплоснабжение">
            <SelectInput value={info.heating} onChange={set("heating")} options={HEATING_SOURCES} />
          </Field>
          <Field label="Водоснабжение">
            <SelectInput value={info.water_supply} onChange={set("water_supply")} options={GRID_OPTIONS} />
          </Field>
          <Field label="Водоотведение">
            <SelectInput value={info.sewage} onChange={set("sewage")} options={["Центральное", "Локальные очистные сооружения", "Не предусмотрено"]} />
          </Field>
          <Field label="Отопление">
            <SelectInput value={info.heating_type} onChange={set("heating_type")} options={HEATING_SOURCES} />
          </Field>
          <Field label="Вентиляция">
            <div className="flex flex-wrap gap-2">
              {VENTILATION_TYPES.map(v => (
                <button key={v} onClick={() => set("ventilation")(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: info.ventilation === v ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
                    color: info.ventilation === v ? "#00FF88" : "rgba(255,255,255,0.45)",
                    border: `1px solid ${info.ventilation === v ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["has_ac", "Система кондиционирования"],
            ["has_fire_system", "Противопожарная система"],
            ["has_leak_sensors", "Датчики протечки воды"],
            ["has_sound_insulation", "Улучшенные шумовые характеристики"],
            ["has_air_noise_isolation", "Изоляция воздушного шума"],
            ["has_heat_meter", "Приборы учёта тепловой энергии"],
            ["has_auto_heating", "Автоматическое регулирование теплоносителя"],
          ] as [keyof ObjectInfo, string][]).map(([key, label]) => (
            <Field key={key} label={label}>
              <YesNo value={info[key] as boolean | null} onChange={set(key) as (v: boolean) => void} />
            </Field>
          ))}
        </div>
      </Section>

      {/* 10. Экспликация */}
      <Section title="Экспликация помещений" icon="DoorOpen" color="#FBBF24">
        <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Добавьте каждое помещение с площадью — эти данные используются в расчётах
        </p>
        <RoomsExplication rooms={info.rooms} onChange={set("rooms")} />
      </Section>

      {/* Кнопка сохранения внизу */}
      <div className="mt-2 pt-4 flex justify-end" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
          style={{ background: "#FF6B1A", color: "#fff" }}
        >
          <Icon name={saving ? "Loader" : "Save"} size={15} />
          {saving ? "Сохраняю..." : "Сохранить данные объекта"}
        </button>
      </div>
    </div>
  );
}