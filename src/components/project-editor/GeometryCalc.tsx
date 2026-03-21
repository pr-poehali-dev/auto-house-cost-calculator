import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import PlanSketch, { type SketchResult } from "./PlanSketch";

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface CalcSection {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface CalcVolume {
  label: string;
  value: number;
  unit: string;
  formula: string;
}

interface BomItem {
  section: string;
  name: string;
  unit: string;
  qty: number;
  ttk_id: number;
}

interface TtcMaterial {
  name: string;
  unit: string;
  qty_per_unit: number;
  note?: string;
}

interface TechCard {
  id: number;
  title: string;
  category: string;
  materials: TtcMaterial[];
}

interface GeometryCalcProps {
  projectId: number;
  token: string;
  projectArea: number;
  projectFloors: number;
  onBomReady: (items: BomItem[]) => void;
}

// ─── Секции расчёта ──────────────────────────────────────────────────────────

const SECTIONS: CalcSection[] = [
  { key: "foundation", label: "Фундамент",    icon: "Layers",      color: "#FF6B1A" },
  { key: "walls",      label: "Стены",         icon: "Square",      color: "#00D4FF" },
  { key: "roof",       label: "Кровля",        icon: "Home",        color: "#10B981" },
  { key: "floors",     label: "Перекрытия",    icon: "LayoutGrid",  color: "#A855F7" },
  { key: "windows",    label: "Окна",          icon: "AppWindow",   color: "#06B6D4" },
  { key: "heating",    label: "Отопление",     icon: "Flame",       color: "#FBBF24" },
];

// ─── Формулы расчёта объёмов ─────────────────────────────────────────────────

function calcFoundation(p: Record<string, number>): CalcVolume[] {
  // Если есть данные с чертежа — используем их
  const hasSketch = (p.sketch_total || 0) > 0;
  const outerPerimeter = hasSketch ? (p.sketch_outer || 0) : 2 * ((p.length || 0) + (p.width || 0));
  const innerTotal     = hasSketch ? (p.sketch_inner || 0) : 0;
  const totalPerimeter = hasSketch ? (p.sketch_total || 0) : outerPerimeter;
  const source         = hasSketch ? "из чертежа" : "2×(L+W)";

  const thickM   = (p.thickness || 0) / 1000;  // мм → м
  const volume   = totalPerimeter * (p.height || 0) * thickM;
  const area     = totalPerimeter * (p.height || 0);
  const armature = volume * 80;  // кг/м³
  const formwork = area * 2;

  return [
    { label: "Периметр наружных стен", value: +outerPerimeter.toFixed(2), unit: "п.м", formula: source },
    { label: "Внутренние несущие",     value: +innerTotal.toFixed(2),     unit: "п.м", formula: hasSketch ? "из чертежа" : "не задано" },
    { label: "Общая длина ленты",      value: +totalPerimeter.toFixed(2), unit: "п.м", formula: "наружные + внутренние" },
    { label: "Объём бетона",           value: +volume.toFixed(2),         unit: "м³",  formula: `${totalPerimeter.toFixed(1)}п.м × ${p.height||0}м × ${thickM}м` },
    { label: "Площадь опалубки",       value: +formwork.toFixed(1),       unit: "м²",  formula: "площадь ленты × 2 стороны" },
    { label: "Арматура А400 (ор.)",    value: +armature.toFixed(0),       unit: "кг",  formula: `объём × 80 кг/м³` },
  ];
}

function calcWalls(p: Record<string, number>): CalcVolume[] {
  const perimeter     = 2 * ((p.length || 0) + (p.width || 0));
  const grossArea     = perimeter * (p.height || 0);
  const openings      = (p.windows || 0) * (p.win_w || 1.2) * (p.win_h || 1.4)
                      + (p.doors   || 0) * (p.door_w || 0.9) * (p.door_h || 2.1);
  const netArea       = Math.max(0, grossArea - openings);
  const volume        = netArea * (p.thickness || 0) / 1000;
  const blockQty      = netArea / 0.08; // 1 блок 400×200×200 ≈ 0.08 м²
  const mortarVol     = volume * 0.22;  // раствор ~22% объёма кладки
  return [
    { label: "Площадь стен (брутто)", value: +grossArea.toFixed(1),  unit: "м²",  formula: `периметр×H` },
    { label: "Площадь проёмов",       value: +openings.toFixed(1),   unit: "м²",  formula: `${p.windows||0} окон + ${p.doors||0} дверей` },
    { label: "Площадь стен (нетто)",  value: +netArea.toFixed(1),    unit: "м²",  formula: "брутто − проёмы" },
    { label: "Объём кладки",          value: +volume.toFixed(2),     unit: "м³",  formula: `нетто × толщина(${p.thickness||0}мм)/1000` },
    { label: "Блоки/кирпичи (ор.)",   value: +blockQty.toFixed(0),   unit: "шт",  formula: "нетто / 0.08 м²/блок" },
    { label: "Раствор/клей",          value: +mortarVol.toFixed(2),  unit: "м³",  formula: "объём × 22%" },
  ];
}

function calcRoof(p: Record<string, number>): CalcVolume[] {
  const angle       = (p.angle || 30) * Math.PI / 180;
  const roofArea    = (p.length || 0) * (p.width || 0) / Math.cos(angle);
  const ridgeLen    = (p.length || 0);
  const eaveLen     = 2 * (p.length || 0);
  const rafterLen   = (p.width || 0) / 2 / Math.cos(angle);
  const rafterCount = Math.ceil((p.length || 0) / 0.6) * 2 + 2; // шаг 600 мм
  return [
    { label: "Площадь кровли",      value: +roofArea.toFixed(1),    unit: "м²",  formula: `L×W / cos(${p.angle||30}°)` },
    { label: "Длина конька",        value: +ridgeLen.toFixed(1),     unit: "п.м", formula: "= длина дома" },
    { label: "Карниз (двускат.)",   value: +eaveLen.toFixed(1),      unit: "п.м", formula: "2 × длина дома" },
    { label: "Длина стропилины",    value: +rafterLen.toFixed(2),    unit: "м",   formula: `W/2 / cos(${p.angle||30}°)` },
    { label: "Стропила (шт, ор.)",  value: rafterCount,              unit: "шт",  formula: `(L/0.6 + 1) × 2` },
    { label: "Покрытие +10%",       value: +(roofArea*1.10).toFixed(1), unit: "м²", formula: "площадь × 1.10" },
  ];
}

function calcFloors(p: Record<string, number>): CalcVolume[] {
  const area     = (p.length || 0) * (p.width || 0);
  const floors   = p.count || 1;
  const totalArea = area * floors;
  const volume   = totalArea * (p.thickness || 220) / 1000;
  const screedVol = totalArea * 0.05; // стяжка 50 мм
  return [
    { label: "Площадь 1 перекрытия", value: +area.toFixed(1),       unit: "м²",  formula: "L × W" },
    { label: "Этажей перекрытий",    value: floors,                  unit: "шт",  formula: "" },
    { label: "Суммарная площадь",    value: +totalArea.toFixed(1),   unit: "м²",  formula: `${area.toFixed(0)} × ${floors}` },
    { label: "Объём плиты",          value: +volume.toFixed(2),      unit: "м³",  formula: `площадь × толщина(${p.thickness||220}мм)` },
    { label: "Стяжка пола (50мм)",   value: +screedVol.toFixed(2),   unit: "м³",  formula: "площадь × 0.05" },
  ];
}

function calcWindows(p: Record<string, number>): CalcVolume[] {
  const count    = p.count || 0;
  const area     = count * (p.width || 1.2) * (p.height || 1.4);
  const perimeter = count * 2 * ((p.width || 1.2) + (p.height || 1.4));
  const foam     = perimeter * 0.05; // 0.05 кг/п.м монтажной пены
  return [
    { label: "Количество окон",   value: count,                   unit: "шт",  formula: "" },
    { label: "Суммарная площадь", value: +area.toFixed(2),        unit: "м²",  formula: `${count} × ${p.width||1.2} × ${p.height||1.4}` },
    { label: "Периметр монтажа",  value: +perimeter.toFixed(1),   unit: "п.м", formula: "для пены и отк." },
    { label: "Монтажная пена",    value: +foam.toFixed(2),        unit: "бал.", formula: "периметр × 0.05" },
  ];
}

function calcHeating(p: Record<string, number>): CalcVolume[] {
  const area     = p.area || 0;
  const power    = area * (p.loss || 100); // Вт/м² → Вт
  const radiators = Math.ceil(power / 2000); // секции по 2 кВт
  const pipeLen  = area * 5; // ~5 п.м трубы на м² двухтрубной
  return [
    { label: "Отапливаемая площадь", value: area,                      unit: "м²", formula: "" },
    { label: "Мощность котла (ор.)", value: +(power/1000).toFixed(1),  unit: "кВт",formula: `${area}м² × ${p.loss||100}Вт/м²` },
    { label: "Кол-во радиаторов",    value: radiators,                 unit: "шт", formula: `мощность / 2 кВт` },
    { label: "Трубопровод PPR",      value: +pipeLen.toFixed(0),       unit: "п.м",formula: "площадь × 5" },
  ];
}

const CALC_FNS: Record<string, (p: Record<string, number>) => CalcVolume[]> = {
  foundation: calcFoundation,
  walls: calcWalls,
  roof: calcRoof,
  floors: calcFloors,
  windows: calcWindows,
  heating: calcHeating,
};

// ─── Поля ввода по секциям ───────────────────────────────────────────────────

const FIELDS: Record<string, { key: string; label: string; unit: string; hint?: string; defaultVal?: number }[]> = {
  foundation: [
    { key: "length",    label: "Длина дома",       unit: "м",   hint: "внешний размер",    defaultVal: 10 },
    { key: "width",     label: "Ширина дома",       unit: "м",   hint: "внешний размер",    defaultVal: 8  },
    { key: "height",    label: "Высота ленты",      unit: "м",   hint: "от подошвы до верха",defaultVal: 1.5 },
    { key: "thickness", label: "Ширина ленты",      unit: "мм",  hint: "например 400",      defaultVal: 400 },
  ],
  walls: [
    { key: "length",    label: "Длина дома",        unit: "м",   defaultVal: 10   },
    { key: "width",     label: "Ширина дома",        unit: "м",   defaultVal: 8    },
    { key: "height",    label: "Высота стен",        unit: "м",   hint: "от пола до перекрытия", defaultVal: 3 },
    { key: "thickness", label: "Толщина стен",       unit: "мм",  defaultVal: 375  },
    { key: "windows",   label: "Кол-во окон",        unit: "шт",  defaultVal: 8    },
    { key: "win_w",     label: "Ширина окна",        unit: "м",   defaultVal: 1.2  },
    { key: "win_h",     label: "Высота окна",        unit: "м",   defaultVal: 1.4  },
    { key: "doors",     label: "Кол-во дверей",      unit: "шт",  defaultVal: 4    },
    { key: "door_w",    label: "Ширина двери",        unit: "м",   defaultVal: 0.9  },
    { key: "door_h",    label: "Высота двери",        unit: "м",   defaultVal: 2.1  },
  ],
  roof: [
    { key: "length",    label: "Длина дома",         unit: "м",   defaultVal: 10   },
    { key: "width",     label: "Ширина дома",         unit: "м",   defaultVal: 8    },
    { key: "angle",     label: "Угол наклона",        unit: "°",   hint: "типично 25-40°", defaultVal: 30 },
  ],
  floors: [
    { key: "length",    label: "Длина дома",          unit: "м",   defaultVal: 10   },
    { key: "width",     label: "Ширина дома",          unit: "м",   defaultVal: 8    },
    { key: "count",     label: "Кол-во перекрытий",    unit: "шт",  hint: "межэтажные + чердак", defaultVal: 2 },
    { key: "thickness", label: "Толщина плиты",        unit: "мм",  defaultVal: 220  },
  ],
  windows: [
    { key: "count",     label: "Кол-во окон",          unit: "шт",  defaultVal: 8    },
    { key: "width",     label: "Ширина окна (ср.)",     unit: "м",   defaultVal: 1.2  },
    { key: "height",    label: "Высота окна (ср.)",     unit: "м",   defaultVal: 1.4  },
  ],
  heating: [
    { key: "area",      label: "Отапл. площадь",       unit: "м²",  defaultVal: 150  },
    { key: "loss",      label: "Теплопотери",           unit: "Вт/м²", hint: "80-120 для утеплённого дома", defaultVal: 100 },
  ],
};

// ─── TTK map по категориям ────────────────────────────────────────────────────

const TTK_CATEGORY_MAP: Record<string, string> = {
  foundation: "Фундамент",
  walls:      "Стены",
  roof:       "Кровля",
  floors:     "Перекрытия",
  windows:    "Окна и двери",
  heating:    "Инженерия",
};

// ─── Компонент ───────────────────────────────────────────────────────────────

const TTK_URL = "https://functions.poehali.dev/aa8514d2-9f4a-46fc-80af-a91de8aa4b62";

export default function GeometryCalc({ token, projectArea, projectFloors, onBomReady }: GeometryCalcProps) {
  const [activeSection, setActiveSection] = useState("foundation");
  const [params, setParams] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {};
    for (const [key, fields] of Object.entries(FIELDS)) {
      init[key] = {};
      for (const f of fields) {
        let val = f.defaultVal ?? 0;
        if (key === "foundation" || key === "walls" || key === "roof" || key === "floors") {
          if (f.key === "length") val = Math.sqrt(projectArea * 1.2);
          if (f.key === "width")  val = Math.sqrt(projectArea / 1.2);
        }
        if (key === "floors" && f.key === "count") val = projectFloors;
        if (key === "heating" && f.key === "area") val = projectArea;
        init[key][f.key] = val;
      }
    }
    return init;
  });
  const [techCards, setTechCards] = useState<TechCard[]>([]);
  const [selectedTtk, setSelectedTtk] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [bom, setBom] = useState<BomItem[]>([]);
  // Режим ввода для фундамента: manual | sketch
  const [foundationMode, setFoundationMode] = useState<"manual" | "sketch">("manual");
  const [sketchResult, setSketchResult] = useState<SketchResult | null>(null);

  const handleSketchResult = useCallback((r: SketchResult) => {
    setSketchResult(r);
    // Синхронизируем длину ленты в ручные параметры (totalLength → используется как «периметр»)
    // чтобы ТТК расчёт тоже работал
    setParams(prev => ({
      ...prev,
      foundation: {
        ...prev.foundation,
        sketch_total: r.totalLength,
        sketch_outer: r.outerPerimeter,
        sketch_inner: r.innerTotal,
      },
    }));
  }, []);

  useEffect(() => {
    fetch(`${TTK_URL}?action=list`)
      .then(r => r.json())
      .then(d => {
        if (d.tech_cards) setTechCards(d.tech_cards);
      })
      .catch(() => {});
  }, []);

  const section = SECTIONS.find(s => s.key === activeSection)!;
  const fields  = FIELDS[activeSection] || [];
  const p       = params[activeSection] || {};
  const volumes = CALC_FNS[activeSection]?.(p) || [];

  const setParam = (key: string, val: number) => {
    setParams(prev => ({ ...prev, [activeSection]: { ...prev[activeSection], [key]: val } }));
  };

  const ttkForSection = techCards.filter(tc =>
    tc.category === TTK_CATEGORY_MAP[activeSection]
  );

  const generateBom = async () => {
    setGenerating(true);
    const items: BomItem[] = [];

    for (const sec of SECTIONS) {
      const secParams = params[sec.key] || {};
      const vols = CALC_FNS[sec.key]?.(secParams) || [];
      const ttkId = selectedTtk[sec.key];
      if (!ttkId) continue;

      const card = techCards.find(tc => tc.id === ttkId);
      if (!card?.materials) continue;

      // Ищем главный объём/площадь для данной секции
      const mainVol = vols[0]?.value || 0;

      for (const mat of card.materials) {
        if (!mat.qty_per_unit || mat.qty_per_unit <= 0) continue;
        items.push({
          section: sec.label,
          name: mat.name,
          unit: mat.unit,
          qty: +(mat.qty_per_unit * mainVol).toFixed(3),
          ttk_id: ttkId,
        });
      }
    }

    setBom(items);
    setGenerating(false);
    onBomReady(items);
  };

  const completedSections = SECTIONS.filter(s => selectedTtk[s.key]).length;

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg text-white">Геометрический расчёт</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Введи размеры → система посчитает объёмы → выбери ТТК → получи ВОР
          </p>
        </div>
        <button
          onClick={generateBom}
          disabled={generating || completedSections === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: "var(--neon-green)", color: "#000" }}
        >
          {generating ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Calculator" size={15} />}
          Сформировать ВОР ({completedSections}/{SECTIONS.length})
        </button>
      </div>

      {/* Навигация по секциям */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(s => {
          const done = !!selectedTtk[s.key];
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: activeSection === s.key ? `${s.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${activeSection === s.key ? s.color + "60" : "rgba(255,255,255,0.07)"}`,
                color: activeSection === s.key ? s.color : "rgba(255,255,255,0.5)",
              }}
            >
              <Icon name={s.icon} size={13} />
              {s.label}
              {done && <span style={{ color: "var(--neon-green)", fontSize: 10 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Чертёж фундамента на canvas */}
      {activeSection === "foundation" && foundationMode === "sketch" && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,107,26,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon name="PenLine" size={15} style={{ color: "#FF6B1A" }} />
              <span className="font-semibold text-white text-sm">Чертёж плана фундамента</span>
            </div>
            <button onClick={() => setFoundationMode("manual")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Icon name="FormInput" size={12} /> Ручной ввод
            </button>
          </div>
          <PlanSketch
            scale={0.05}
            onResult={handleSketchResult}
          />
          {sketchResult && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: "Наружный периметр", value: sketchResult.outerPerimeter, color: "#00D4FF" },
                { label: "Внутренние стены",  value: sketchResult.innerTotal,     color: "#FF6B1A" },
                { label: "Итого лент",        value: sketchResult.totalLength,    color: "var(--neon-green)" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}30` }}>
                  <div className="text-lg font-bold" style={{ color: s.color }}>{s.value.toFixed(2)}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}, п.м</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Левая панель — ввод параметров */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${section.color}30` }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${section.color}20` }}>
                <Icon name={section.icon} size={14} style={{ color: section.color }} />
              </div>
              <span className="font-semibold text-white text-sm">{section.label} — параметры</span>
            </div>
            {/* Переключатель режима только для фундамента */}
            {activeSection === "foundation" && (
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                {(["manual", "sketch"] as const).map(m => (
                  <button key={m} onClick={() => setFoundationMode(m)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-all"
                    style={{
                      background: foundationMode === m ? "rgba(255,107,26,0.2)" : "transparent",
                      color: foundationMode === m ? "#FF6B1A" : "rgba(255,255,255,0.4)",
                      borderRight: m === "manual" ? "1px solid rgba(255,255,255,0.1)" : "none",
                    }}>
                    <Icon name={m === "manual" ? "FormInput" : "PenLine"} size={11} />
                    {m === "manual" ? "Вручную" : "Чертёж"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs mb-1 font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {f.label} <span style={{ color: "rgba(255,255,255,0.25)" }}>({f.unit})</span>
                </label>
                {f.hint && <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>{f.hint}</div>}
                <input
                  type="number"
                  value={p[f.key] ?? f.defaultVal ?? 0}
                  step={f.unit === "°" ? 1 : f.unit === "мм" ? 50 : 0.1}
                  onChange={e => setParam(f.key, +e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)` }}
                />
              </div>
            ))}
          </div>

          {/* Выбор ТТК */}
          {ttkForSection.length > 0 && (
            <div className="pt-3 border-t border-white/5">
              <label className="block text-xs mb-2 font-semibold uppercase tracking-wider" style={{ color: section.color }}>
                Технологическая карта
              </label>
              <select
                value={selectedTtk[activeSection] || ""}
                onChange={e => setSelectedTtk(prev => ({ ...prev, [activeSection]: +e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <option value="">— выбери ТТК для расчёта —</option>
                {ttkForSection.map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.title}</option>
                ))}
              </select>
              {selectedTtk[activeSection] && (
                <div className="mt-2 text-xs" style={{ color: "var(--neon-green)" }}>
                  ✓ ТТК выбрана — нормы расхода будут применены к рассчитанным объёмам
                </div>
              )}
            </div>
          )}
        </div>

        {/* Правая панель — результаты расчёта */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Результаты расчёта
          </div>
          <div className="space-y-2">
            {volumes.map((v, i) => (
              <div key={i} className="flex items-start justify-between py-2.5 px-3 rounded-xl"
                style={{ background: i === 0 ? `${section.color}10` : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? section.color + "30" : "rgba(255,255,255,0.05)"}` }}>
                <div>
                  <div className="text-sm font-medium text-white">{v.label}</div>
                  {v.formula && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{v.formula}</div>}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className="text-lg font-bold" style={{ color: i === 0 ? section.color : "rgba(255,255,255,0.9)" }}>
                    {v.value.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.4)" }}>{v.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Выбранный ТТК — материалы */}
          {selectedTtk[activeSection] && (() => {
            const card = techCards.find(tc => tc.id === selectedTtk[activeSection]);
            const mainVol = volumes[0]?.value || 0;
            if (!card?.materials?.length) return null;
            return (
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Потребность в материалах (на {mainVol} {volumes[0]?.unit})
                </div>
                <div className="space-y-1">
                  {card.materials.filter(m => m.qty_per_unit > 0).map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span style={{ color: "rgba(255,255,255,0.7)" }}>{m.name}</span>
                      <span className="font-bold ml-2 flex-shrink-0" style={{ color: "var(--neon-cyan)" }}>
                        {(m.qty_per_unit * mainVol).toFixed(2)} {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ВОР — итоговая таблица */}
      {bom.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,255,136,0.2)" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: "rgba(0,255,136,0.06)", borderBottom: "1px solid rgba(0,255,136,0.15)" }}>
            <div>
              <span className="font-semibold text-white">Ведомость объёмов работ (ВОР)</span>
              <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.4)" }}>{bom.length} позиций</span>
            </div>
            <button
              onClick={() => onBomReady(bom)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--neon-green)", color: "#000" }}
            >
              <Icon name="ArrowRight" size={13} /> Перенести в спецификацию
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(20,26,40,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="p-2.5 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Раздел</th>
                  <th className="p-2.5 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Материал</th>
                  <th className="p-2.5 text-right w-20 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Кол-во</th>
                  <th className="p-2.5 text-center w-16 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Ед.</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="p-2.5" style={{ color: "rgba(255,255,255,0.4)" }}>{item.section}</td>
                    <td className="p-2.5 text-white font-medium">{item.name}</td>
                    <td className="p-2.5 text-right font-bold" style={{ color: "var(--neon-cyan)" }}>
                      {item.qty.toLocaleString("ru-RU")}
                    </td>
                    <td className="p-2.5 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}