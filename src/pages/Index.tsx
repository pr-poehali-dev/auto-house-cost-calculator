import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ─── Data ────────────────────────────────────────────────────────────────────

const HOUSE_TYPES = [
  { id: "brick", label: "Кирпичный", icon: "🧱", multiplier: 1.4 },
  { id: "frame", label: "Каркасный", icon: "🏗️", multiplier: 0.85 },
  { id: "concrete", label: "Монолитный", icon: "🏢", multiplier: 1.6 },
  { id: "wood", label: "Деревянный", icon: "🪵", multiplier: 1.0 },
  { id: "aerated", label: "Газобетон", icon: "🟫", multiplier: 1.1 },
  { id: "modular", label: "Модульный", icon: "📦", multiplier: 0.75 },
];

const ROOF_TYPES = [
  { id: "flat", label: "Плоская", multiplier: 1.0, price: 2500 },
  { id: "gable", label: "Двускатная", multiplier: 1.15, price: 3200 },
  { id: "hip", label: "Вальмовая", multiplier: 1.3, price: 4200 },
  { id: "mansard", label: "Мансардная", multiplier: 1.45, price: 5500 },
  { id: "complex", label: "Сложная", multiplier: 1.6, price: 7000 },
];

const FOUNDATION_TYPES = [
  { id: "tape", label: "Ленточный", price: 8000, icon: "━" },
  { id: "pile", label: "Свайный", price: 5500, icon: "┃" },
  { id: "slab", label: "Плитный", price: 12000, icon: "▬" },
  { id: "combined", label: "Комбинированный", price: 14000, icon: "▨" },
];

const FINISHING = [
  { id: "none", label: "Без отделки", multiplier: 0 },
  { id: "rough", label: "Черновая", multiplier: 0.15 },
  { id: "standard", label: "Стандартная", multiplier: 0.3 },
  { id: "premium", label: "Премиум", multiplier: 0.55 },
  { id: "luxury", label: "Люкс", multiplier: 0.85 },
];

const COMMUNICATIONS = [
  { id: "electricity", label: "Электричество", price: 180000, icon: "⚡" },
  { id: "water", label: "Водоснабжение", price: 250000, icon: "💧" },
  { id: "sewage", label: "Канализация", price: 200000, icon: "🔧" },
  { id: "gas", label: "Газификация", price: 450000, icon: "🔥" },
  { id: "heating", label: "Отопление", price: 350000, icon: "♨️" },
  { id: "ventilation", label: "Вентиляция", price: 280000, icon: "💨" },
  { id: "internet", label: "Интернет", price: 45000, icon: "📡" },
  { id: "security", label: "Безопасность", price: 120000, icon: "🔐" },
];

const ADDITIONAL = [
  { id: "garage", label: "Гараж", price: 650000, icon: "🚗" },
  { id: "terrace", label: "Терраса", price: 180000, icon: "🏡" },
  { id: "pool", label: "Бассейн", price: 1200000, icon: "🏊" },
  { id: "sauna", label: "Баня/Сауна", price: 380000, icon: "🧖" },
  { id: "fence", label: "Забор", price: 220000, icon: "🚧" },
  { id: "landscaping", label: "Ландшафт", price: 350000, icon: "🌿" },
  { id: "solar", label: "Солнечные панели", price: 480000, icon: "☀️" },
  { id: "smart", label: "Умный дом", price: 320000, icon: "🏠" },
];

const PROJECTS = [
  {
    id: 1,
    name: "Эко Минимал",
    type: "Каркасный",
    area: 85,
    floors: 1,
    rooms: 3,
    price: 3200000,
    tag: "Популярный",
    tagColor: "#00D4FF",
    desc: "Современный одноэтажный дом в скандинавском стиле",
    features: ["Панорамные окна", "Открытая планировка", "Эко-материалы"],
  },
  {
    id: 2,
    name: "Классик Плюс",
    type: "Кирпичный",
    area: 150,
    floors: 2,
    rooms: 5,
    price: 7800000,
    tag: "Хит",
    tagColor: "#FF6B1A",
    desc: "Двухэтажный кирпичный дом с просторными комнатами",
    features: ["Камин", "Подвал", "Гараж на 2 авто"],
  },
  {
    id: 3,
    name: "Модерн XL",
    type: "Монолитный",
    area: 220,
    floors: 3,
    rooms: 7,
    price: 14500000,
    tag: "Премиум",
    tagColor: "#00FF88",
    desc: "Трёхэтажный монолитный дом с эксплуатируемой кровлей",
    features: ["Кровельная терраса", "Лифт", "Умный дом"],
  },
  {
    id: 4,
    name: "Лесная Усадьба",
    type: "Деревянный",
    area: 120,
    floors: 2,
    rooms: 4,
    price: 5600000,
    tag: "Новинка",
    tagColor: "#A855F7",
    desc: "Двухэтажный деревянный дом с мансардой",
    features: ["Мансарда", "Панорамная баня", "Терраса"],
  },
  {
    id: 5,
    name: "Компакт Смарт",
    type: "Газобетон",
    area: 65,
    floors: 1,
    rooms: 2,
    price: 2100000,
    tag: "Бюджет",
    tagColor: "#FBBF24",
    desc: "Компактный дом для молодой семьи",
    features: ["Оптимальная площадь", "Энергоэффективность", "Быстрое строительство"],
  },
  {
    id: 6,
    name: "Вилла Гранд",
    type: "Кирпичный",
    area: 400,
    floors: 3,
    rooms: 10,
    price: 32000000,
    tag: "Люкс",
    tagColor: "#EC4899",
    desc: "Элитная вилла с полным набором опций",
    features: ["Бассейн", "Кинозал", "Винный погреб"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн ₽";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + " тыс ₽";
  return n.toFixed(0) + " ₽";
}

const NAV_ITEMS = [
  { id: "calc", label: "Калькулятор", icon: "Calculator" },
  { id: "projects", label: "Проекты", icon: "LayoutGrid" },
  { id: "compare", label: "Сравнение", icon: "GitCompare" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Index() {
  const [activeTab, setActiveTab] = useState("calc");

  // Calculator state
  const [area, setArea] = useState(120);
  const [floors, setFloors] = useState(2);
  const [houseType, setHouseType] = useState("brick");
  const [roofType, setRoofType] = useState("gable");
  const [foundation, setFoundation] = useState("tape");
  const [finishing, setFinishing] = useState("standard");
  const [communications, setCommunications] = useState<string[]>(["electricity", "water", "sewage"]);
  const [additionals, setAdditionals] = useState<string[]>([]);
  const [region, setRegion] = useState(1.0);
  const [animKey, setAnimKey] = useState(0);

  // Projects state
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [compareList, setCompareList] = useState<number[]>([]);

  // Calculation
  const BASE_PRICE_PER_SQM = 45000;
  const houseTypeData = HOUSE_TYPES.find(h => h.id === houseType)!;
  const roofData = ROOF_TYPES.find(r => r.id === roofType)!;
  const foundationData = FOUNDATION_TYPES.find(f => f.id === foundation)!;
  const finishingData = FINISHING.find(f => f.id === finishing)!;

  const baseConstruction = area * BASE_PRICE_PER_SQM * houseTypeData.multiplier * floors * 0.85 * region;
  const roofCost = area * roofData.price * roofData.multiplier;
  const foundationCost = area * foundationData.price;
  const finishingCost = baseConstruction * finishingData.multiplier;
  const commsCost = communications.reduce((sum, id) => sum + (COMMUNICATIONS.find(c => c.id === id)?.price || 0), 0);
  const additionalCost = additionals.reduce((sum, id) => sum + (ADDITIONAL.find(a => a.id === id)?.price || 0), 0);
  const totalCost = baseConstruction + roofCost + foundationCost + finishingCost + commsCost + additionalCost;

  const toggleComm = (id: string) =>
    setCommunications(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAdditional = (id: string) =>
    setAdditionals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCompare = (id: number) =>
    setCompareList(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [area, floors, houseType, roofType, foundation, finishing, communications, additionals, region]);

  return (
    <div className="noise-bg min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-orange) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #A855F7 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff" }}>
              СК
            </div>
            <div>
              <div className="font-display font-semibold text-base tracking-wide text-white">СтройКалькулятор</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Автоматический расчёт</div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === item.id ? "var(--neon-orange)" : "transparent",
                  color: activeTab === item.id ? "#fff" : "rgba(255,255,255,0.5)",
                  boxShadow: activeTab === item.id ? "0 0 20px rgba(255,107,26,0.35)" : "none",
                }}>
                <Icon name={item.icon} size={15} />
                {item.label}
                {item.id === "compare" && compareList.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: activeTab === "compare" ? "rgba(255,255,255,0.3)" : "var(--neon-orange)", color: "#fff", fontSize: 10 }}>
                    {compareList.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="sm:hidden flex gap-1">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="p-2 rounded-lg transition-all"
                style={{ background: activeTab === item.id ? "var(--neon-orange)" : "rgba(255,255,255,0.05)", color: "#fff" }}>
                <Icon name={item.icon} size={18} />
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── CALCULATOR TAB ── */}
        {activeTab === "calc" && (
          <div className="animate-fade-in">
            {/* Hero banner */}
            <div className="relative rounded-2xl overflow-hidden mb-8">
              <img
                src="https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/18ef8126-de0c-4571-a466-a3809e6ec703.jpg"
                alt="Строительство дома"
                className="w-full object-cover"
                style={{ height: 200, objectPosition: "center 40%" }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(10,13,20,0.97) 45%, rgba(10,13,20,0.3))" }} />
              <div className="absolute inset-0 flex items-center px-8">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-orange)" }}>
                    Онлайн расчёт · 2026
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                    Сколько стоит
                  </h1>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: "var(--neon-orange)" }}>
                    построить дом?
                  </h1>
                  <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Настройте параметры — цена обновляется мгновенно
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left column: all params */}
              <div className="xl:col-span-2 space-y-5">

                {/* Area & Floors */}
                <Section icon="Ruler" title="Площадь и этажность">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Площадь дома</span>
                        <span className="font-display font-bold text-xl" style={{ color: "var(--neon-cyan)" }}>{area} м²</span>
                      </div>
                      <input type="range" min={30} max={500} value={area} onChange={e => setArea(+e.target.value)} />
                      <div className="flex justify-between mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <span>30 м²</span><span>500 м²</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Количество этажей</span>
                        <span className="font-display font-bold text-xl" style={{ color: "var(--neon-cyan)" }}>{floors}</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(f => (
                          <button key={f} onClick={() => setFloors(f)}
                            className="flex-1 py-3 rounded-xl font-display font-bold text-xl transition-all duration-200"
                            style={{
                              background: floors === f ? "var(--neon-cyan)" : "rgba(255,255,255,0.05)",
                              color: floors === f ? "#0A0D14" : "rgba(255,255,255,0.5)",
                              boxShadow: floors === f ? "0 0 18px rgba(0,212,255,0.45)" : "none",
                            }}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* House type */}
                <Section icon="Home" title="Тип строения">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {HOUSE_TYPES.map(h => (
                      <button key={h.id} onClick={() => setHouseType(h.id)}
                        className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: houseType === h.id ? "rgba(255,107,26,0.14)" : "rgba(255,255,255,0.04)",
                          border: houseType === h.id ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: houseType === h.id ? "0 0 20px rgba(255,107,26,0.2)" : "none",
                        }}>
                        <div className="text-2xl mb-2">{h.icon}</div>
                        <div className="font-semibold text-sm text-white">{h.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: houseType === h.id ? "var(--neon-orange)" : "rgba(255,255,255,0.3)" }}>
                          {h.multiplier >= 1 ? "+" : ""}{Math.round((h.multiplier - 1) * 100)}% к цене
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Foundation */}
                <Section icon="Layers" title="Фундамент">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {FOUNDATION_TYPES.map(f => (
                      <button key={f.id} onClick={() => setFoundation(f.id)}
                        className="p-4 rounded-xl text-center transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: foundation === f.id ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                          border: foundation === f.id ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: foundation === f.id ? "0 0 18px rgba(0,212,255,0.2)" : "none",
                        }}>
                        <div className="text-xl font-mono mb-2" style={{ color: "var(--neon-cyan)" }}>{f.icon}</div>
                        <div className="text-xs font-semibold text-white">{f.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {(f.price / 1000).toFixed(0)}&nbsp;тыс/м²
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Roof */}
                <Section icon="Triangle" title="Кровля">
                  <div className="flex flex-wrap gap-3">
                    {ROOF_TYPES.map(r => (
                      <button key={r.id} onClick={() => setRoofType(r.id)}
                        className="px-5 py-3 rounded-xl text-sm transition-all duration-200"
                        style={{
                          background: roofType === r.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                          border: roofType === r.id ? "1px solid #A855F7" : "1px solid rgba(255,255,255,0.07)",
                          color: roofType === r.id ? "#A855F7" : "rgba(255,255,255,0.6)",
                        }}>
                        <div className="font-semibold">{r.label}</div>
                        <div className="text-xs mt-0.5 opacity-70">{(r.price / 1000).toFixed(1)}K/м²</div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Finishing */}
                <Section icon="Paintbrush" title="Отделка">
                  <div className="flex flex-wrap gap-3">
                    {FINISHING.map(f => (
                      <button key={f.id} onClick={() => setFinishing(f.id)}
                        className="px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                        style={{
                          background: finishing === f.id ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.04)",
                          border: finishing === f.id ? "1px solid var(--neon-green)" : "1px solid rgba(255,255,255,0.07)",
                          color: finishing === f.id ? "var(--neon-green)" : "rgba(255,255,255,0.6)",
                        }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Communications */}
                <Section icon="Zap" title="Коммуникации" badge={communications.length}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {COMMUNICATIONS.map(c => {
                      const active = communications.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleComm(c.id)}
                          className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: active ? "rgba(255,107,26,0.12)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div className="text-xl mb-2">{c.icon}</div>
                          <div className="text-xs font-semibold text-white">{c.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: active ? "var(--neon-orange)" : "rgba(255,255,255,0.3)" }}>
                            +{formatPrice(c.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Additional */}
                <Section icon="Plus" title="Дополнительные опции" badge={additionals.length}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ADDITIONAL.map(a => {
                      const active = additionals.includes(a.id);
                      return (
                        <button key={a.id} onClick={() => toggleAdditional(a.id)}
                          className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: active ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div className="text-xl mb-2">{a.icon}</div>
                          <div className="text-xs font-semibold text-white">{a.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: active ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                            +{formatPrice(a.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Region */}
                <Section icon="MapPin" title="Регион строительства">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Москва / МО", val: 1.35 },
                      { label: "Санкт-Петербург", val: 1.2 },
                      { label: "Города-миллионники", val: 1.1 },
                      { label: "Региональный центр", val: 1.0 },
                      { label: "Малые города", val: 0.9 },
                      { label: "Сельская местность", val: 0.8 },
                    ].map(r => (
                      <button key={r.val} onClick={() => setRegion(r.val)}
                        className="p-3 rounded-xl text-sm text-center transition-all duration-200"
                        style={{
                          background: region === r.val ? "rgba(255,107,26,0.12)" : "rgba(255,255,255,0.04)",
                          border: region === r.val ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          color: region === r.val ? "var(--neon-orange)" : "rgba(255,255,255,0.6)",
                        }}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </Section>

              </div>

              {/* Right: sticky result */}
              <div className="xl:col-span-1">
                <div className="sticky top-24 space-y-4">
                  {/* Total */}
                  <div className="rounded-2xl p-6 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #111520 0%, #1a0f05 100%)",
                      border: "1px solid rgba(255,107,26,0.35)",
                    }}>
                    <div className="absolute inset-0 opacity-20"
                      style={{ background: "radial-gradient(circle at top right, var(--neon-orange), transparent 65%)" }} />
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Итоговая стоимость
                      </div>
                      <div key={animKey} className="font-display font-black text-3xl sm:text-4xl animate-counter"
                        style={{ color: "var(--neon-orange)", lineHeight: 1.1 }}>
                        {formatPrice(totalCost)}
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        ≈ {formatPrice(Math.round(totalCost / area))} за м²
                      </div>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="rounded-2xl p-5 space-y-3.5"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Детальный расчёт
                    </div>
                    {[
                      { label: "Строительство", val: baseConstruction, color: "var(--neon-orange)" },
                      { label: "Кровля", val: roofCost, color: "#A855F7" },
                      { label: "Фундамент", val: foundationCost, color: "var(--neon-cyan)" },
                      { label: "Отделка", val: finishingCost, color: "var(--neon-green)" },
                      ...(commsCost > 0 ? [{ label: "Коммуникации", val: commsCost, color: "#FBBF24" }] : []),
                      ...(additionalCost > 0 ? [{ label: "Дополнительно", val: additionalCost, color: "#EC4899" }] : []),
                    ].map((row, i) => {
                      const pct = Math.round((row.val / totalCost) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span style={{ color: "rgba(255,255,255,0.55)" }}>{row.label}</span>
                            <span className="font-semibold text-xs" style={{ color: row.color }}>{formatPrice(row.val)}</span>
                          </div>
                          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-1 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: row.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini summary */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Площадь", val: `${area} м²`, icon: "Maximize2" },
                      { label: "Этажей", val: String(floors), icon: "Layers" },
                      { label: "Тип дома", val: houseTypeData.label, icon: "Home" },
                      { label: "Отделка", val: finishingData.label, icon: "Paintbrush" },
                    ].map((p, i) => (
                      <div key={i} className="rounded-xl p-3 flex items-center gap-2"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Icon name={p.icon} size={13} style={{ color: "var(--neon-orange)", flexShrink: 0 }} />
                        <div className="min-w-0">
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{p.label}</div>
                          <div className="text-xs font-semibold text-white truncate">{p.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button className="w-full py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)",
                      color: "#fff",
                      boxShadow: "0 0 30px rgba(255,107,26,0.45)",
                    }}>
                    Получить коммерческое предложение
                  </button>
                  <button className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                    💾 Сохранить расчёт
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS TAB ── */}
        {activeTab === "projects" && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-orange)" }}>
                Каталог проектов
              </div>
              <h2 className="font-display text-3xl font-bold text-white">Готовые проекты домов</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Нажмите на иконку <Icon name="GitCompare" size={13} style={{ display: "inline", color: "var(--neon-cyan)" }} /> для сравнения до 3 проектов
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROJECTS.map((p, i) => (
                <div key={p.id}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: "var(--card-bg)",
                    border: selectedProject === p.id ? `1px solid ${p.tagColor}` : "1px solid var(--card-border)",
                    boxShadow: selectedProject === p.id ? `0 0 30px ${p.tagColor}44` : "none",
                    animation: `fadeInUp 0.5s ease-out ${i * 0.07}s both`,
                  }}
                  onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}>
                  <div className="px-5 pt-5 flex items-start justify-between">
                    <div className="px-3 py-1 rounded-full text-xs font-semibold font-display"
                      style={{ background: `${p.tagColor}22`, color: p.tagColor, border: `1px solid ${p.tagColor}44` }}>
                      {p.tag}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleCompare(p.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                      title="Сравнить"
                      style={{
                        background: compareList.includes(p.id) ? "var(--neon-cyan)" : "rgba(255,255,255,0.07)",
                        color: compareList.includes(p.id) ? "#000" : "rgba(255,255,255,0.4)",
                      }}>
                      <Icon name="GitCompare" size={13} />
                    </button>
                  </div>

                  <div className="px-5 py-4">
                    <h3 className="font-display font-bold text-xl text-white">{p.name}</h3>
                    <p className="text-xs mt-1 mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{p.desc}</p>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { icon: "Maximize2", val: `${p.area} м²`, label: "Площадь" },
                        { icon: "Layers", val: `${p.floors} эт.`, label: "Этажей" },
                        { icon: "BedDouble", val: `${p.rooms} комн.`, label: "Комнат" },
                      ].map((s, j) => (
                        <div key={j} className="rounded-xl p-2 text-center"
                          style={{ background: "rgba(255,255,255,0.04)" }}>
                          <Icon name={s.icon} size={12} style={{ color: p.tagColor, margin: "0 auto 3px" }} />
                          <div className="font-bold text-xs text-white">{s.val}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {p.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.tagColor }} />
                          {f}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Стоимость от</div>
                        <div className="font-display font-bold text-xl" style={{ color: p.tagColor }}>
                          {formatPrice(p.price)}
                        </div>
                      </div>
                      <button className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                        style={{ background: `${p.tagColor}22`, color: p.tagColor, border: `1px solid ${p.tagColor}44` }}>
                        Подробнее
                      </button>
                    </div>

                    {selectedProject === p.id && (
                      <div className="mt-4 rounded-xl p-4 animate-scale-in"
                        style={{ background: `${p.tagColor}11`, border: `1px solid ${p.tagColor}33` }}>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Цена за м²
                        </div>
                        <div className="font-display text-lg font-bold" style={{ color: p.tagColor }}>
                          {formatPrice(Math.round(p.price / p.area))} / м²
                        </div>
                        <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {p.type} · {p.area} м² · {p.floors} этаж(а)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {activeTab === "compare" && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-cyan)" }}>
                Сравнение
              </div>
              <h2 className="font-display text-3xl font-bold text-white">Сравнение проектов</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Добавьте до 3 проектов через вкладку «Проекты»
              </p>
            </div>

            {compareList.length === 0 ? (
              <div className="rounded-2xl p-16 text-center"
                style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-6xl mb-4">⚖️</div>
                <div className="font-display text-xl text-white mb-2">Нет проектов для сравнения</div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Перейдите в «Проекты» и нажмите иконку сравнения на карточках
                </p>
                <button onClick={() => setActiveTab("projects")}
                  className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: "var(--neon-cyan)", color: "#0A0D14", boxShadow: "0 0 20px rgba(0,212,255,0.4)" }}>
                  Перейти к проектам
                </button>
              </div>
            ) : (
              <div>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left p-5 text-sm font-medium w-40"
                          style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)" }}>
                          Параметр
                        </th>
                        {compareList.map(id => {
                          const p = PROJECTS.find(pr => pr.id === id)!;
                          return (
                            <th key={id} className="p-5 text-center"
                              style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)" }}>
                              <div className="font-display font-bold text-white text-lg">{p.name}</div>
                              <div className="text-xs mt-0.5 font-semibold" style={{ color: p.tagColor }}>{p.tag}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Тип строения", render: (p: typeof PROJECTS[0]) => p.type },
                        { label: "Площадь", render: (p: typeof PROJECTS[0]) => `${p.area} м²` },
                        { label: "Этажей", render: (p: typeof PROJECTS[0]) => String(p.floors) },
                        { label: "Комнат", render: (p: typeof PROJECTS[0]) => String(p.rooms) },
                        { label: "Стоимость от", render: (p: typeof PROJECTS[0]) => formatPrice(p.price), highlight: true },
                        { label: "Цена / м²", render: (p: typeof PROJECTS[0]) => formatPrice(Math.round(p.price / p.area)) },
                      ].map((row, i) => (
                        <tr key={i}>
                          <td className="p-5 text-sm"
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                              borderBottom: "1px solid var(--card-border)",
                            }}>
                            {row.label}
                          </td>
                          {compareList.map(id => {
                            const p = PROJECTS.find(pr => pr.id === id)!;
                            return (
                              <td key={id} className="p-5 text-center"
                                style={{
                                  background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                                  borderBottom: "1px solid var(--card-border)",
                                  color: row.highlight ? p.tagColor : "rgba(255,255,255,0.85)",
                                  fontWeight: row.highlight ? 700 : 500,
                                  fontFamily: row.highlight ? "Oswald, sans-serif" : "inherit",
                                }}>
                                {row.render(p)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap">
                  {compareList.map(id => {
                    const p = PROJECTS.find(pr => pr.id === id)!;
                    return (
                      <button key={id} onClick={() => toggleCompare(id)}
                        className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all hover:bg-white/10"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Icon name="X" size={11} />
                        Убрать «{p.name}»
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t py-8 text-center"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        СтройКалькулятор · Автоматический расчёт стоимости строительства · 2026
      </footer>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, badge, children }: { icon: string; title: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 gradient-border">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,107,26,0.14)" }}>
          <Icon name={icon} size={16} style={{ color: "var(--neon-orange)" }} />
        </div>
        <h2 className="font-display font-semibold text-base text-white tracking-wide">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "var(--neon-orange)", color: "#fff" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}