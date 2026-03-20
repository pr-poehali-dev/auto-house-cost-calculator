import Icon from "@/components/ui/icon";
import {
  HOUSE_TYPES, ROOF_TYPES, FOUNDATION_TYPES, FINISHING,
  COMMUNICATIONS, ADDITIONAL, formatPrice,
} from "./data";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, badge, children }: {
  icon: string; title: string; badge?: number; children: React.ReactNode
}) {
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

// ─── Правая панель с результатом ──────────────────────────────────────────────

interface ResultPanelProps {
  animKey: number;
  totalCost: number;
  area: number;
  floors: number;
  houseTypeLabel: string;
  finishingLabel: string;
  baseConstruction: number;
  roofCost: number;
  foundationCost: number;
  finishingCost: number;
  commsCost: number;
  additionalCost: number;
}

function ResultPanel({
  animKey, totalCost, area, floors, houseTypeLabel, finishingLabel,
  baseConstruction, roofCost, foundationCost, finishingCost, commsCost, additionalCost,
}: ResultPanelProps) {
  const breakdown = [
    { label: "Строительство", val: baseConstruction, color: "var(--neon-orange)" },
    { label: "Кровля", val: roofCost, color: "#A855F7" },
    { label: "Фундамент", val: foundationCost, color: "var(--neon-cyan)" },
    { label: "Отделка", val: finishingCost, color: "var(--neon-green)" },
    ...(commsCost > 0 ? [{ label: "Коммуникации", val: commsCost, color: "#FBBF24" }] : []),
    ...(additionalCost > 0 ? [{ label: "Дополнительно", val: additionalCost, color: "#EC4899" }] : []),
  ];

  return (
    <div className="sticky top-24 space-y-4">
      {/* Total */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #111520 0%, #1a0f05 100%)", border: "1px solid rgba(255,107,26,0.35)" }}>
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
        {breakdown.map((row, i) => {
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
          { label: "Тип дома", val: houseTypeLabel, icon: "Home" },
          { label: "Отделка", val: finishingLabel, icon: "Paintbrush" },
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
        style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 30px rgba(255,107,26,0.45)" }}>
        Получить коммерческое предложение
      </button>
      <button className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10"
        style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
        💾 Сохранить расчёт
      </button>
    </div>
  );
}

// ─── CalcTab ──────────────────────────────────────────────────────────────────

interface CalcTabProps {
  area: number; setArea: (v: number) => void;
  floors: number; setFloors: (v: number) => void;
  houseType: string; setHouseType: (v: string) => void;
  roofType: string; setRoofType: (v: string) => void;
  foundation: string; setFoundation: (v: string) => void;
  finishing: string; setFinishing: (v: string) => void;
  communications: string[]; toggleComm: (id: string) => void;
  additionals: string[]; toggleAdditional: (id: string) => void;
  region: number; setRegion: (v: number) => void;
  animKey: number;
  totalCost: number;
  baseConstruction: number;
  roofCost: number;
  foundationCost: number;
  finishingCost: number;
  commsCost: number;
  additionalCost: number;
}

export default function CalcTab({
  area, setArea, floors, setFloors,
  houseType, setHouseType, roofType, setRoofType,
  foundation, setFoundation, finishing, setFinishing,
  communications, toggleComm, additionals, toggleAdditional,
  region, setRegion,
  animKey, totalCost,
  baseConstruction, roofCost, foundationCost, finishingCost, commsCost, additionalCost,
}: CalcTabProps) {
  const houseTypeData = HOUSE_TYPES.find(h => h.id === houseType)!;
  const finishingData = FINISHING.find(f => f.id === finishing)!;

  return (
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
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">Сколько стоит</h1>
            <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: "var(--neon-orange)" }}>построить дом?</h1>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
              Настройте параметры — цена обновляется мгновенно
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: params */}
        <div className="xl:col-span-2 space-y-5">

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

        {/* Right: result */}
        <div className="xl:col-span-1">
          <ResultPanel
            animKey={animKey}
            totalCost={totalCost}
            area={area}
            floors={floors}
            houseTypeLabel={houseTypeData.label}
            finishingLabel={finishingData.label}
            baseConstruction={baseConstruction}
            roofCost={roofCost}
            foundationCost={foundationCost}
            finishingCost={finishingCost}
            commsCost={commsCost}
            additionalCost={additionalCost}
          />
        </div>
      </div>
    </div>
  );
}
