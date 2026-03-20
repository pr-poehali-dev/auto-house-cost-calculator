import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { PROJECTS, formatPrice, formatNum, buildSmeta, type SmetaGroupData } from "./data";

// ─── SmetaGroup ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Земляные работы": "#A855F7",
  "Фундамент": "#00D4FF",
  "Стены и перекрытия": "#FF6B1A",
  "Кровля": "#FBBF24",
  "Окна и двери": "#00FF88",
  "Утепление и фасад": "#EC4899",
  "Черновые полы": "#6366F1",
  "Чистовые полы": "#14B8A6",
  "Отделка стен и потолков": "#F97316",
  "Электрика": "#EAB308",
  "Сантехника": "#3B82F6",
};

function SmetaGroup({ group, index }: { group: SmetaGroupData; index: number }) {
  const [open, setOpen] = useState(index < 2);
  const color = CATEGORY_COLORS[group.category] || "var(--neon-orange)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 sm:p-5 transition-all hover:bg-white/5"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="font-display font-semibold text-sm sm:text-base text-white tracking-wide">{group.category}</span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
            {group.items.length} поз.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-base sm:text-lg" style={{ color }}>
            {formatNum(group.groupTotal)} ₽
          </span>
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto animate-fade-in">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Наименование</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold w-16" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Ед.</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold w-20" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Кол-во</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold w-28" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Цена/ед., ₽</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold w-32" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Сумма, ₽</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <td className="px-4 py-2.5" style={{ color: "rgba(255,255,255,0.8)" }}>{item.name}</td>
                  <td className="px-3 py-2.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item.unit}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: "rgba(255,255,255,0.7)" }}>{item.totalQty}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: "rgba(255,255,255,0.5)" }}>{formatNum(item.pricePerUnit)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color }}>{formatNum(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: `${color}11`, borderTop: `1px solid ${color}33` }}>
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Итого по разделу</td>
                <td colSpan={2} className="px-4 py-3 text-right font-display font-bold text-base" style={{ color }}>{formatNum(group.groupTotal)} ₽</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ProjectsTab ──────────────────────────────────────────────────────────────

interface ProjectsTabProps {
  selectedProject: number | null;
  setSelectedProject: (id: number | null) => void;
  compareList: number[];
  toggleCompare: (id: number) => void;
  setActiveTab: (tab: string) => void;
}

export function ProjectsTab({ selectedProject, setSelectedProject, compareList, toggleCompare }: ProjectsTabProps) {
  const navigate = useNavigate();
  return (
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
            {/* Фото дома */}
            <div className="relative w-full h-44 overflow-hidden">
              <img
                src={p.image}
                alt={p.name}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(10,13,20,0.9) 100%)" }} />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold font-display"
                style={{ background: `${p.tagColor}ee`, color: "#0A0D14", backdropFilter: "blur(4px)" }}>
                {p.tag}
              </div>
              <button
                onClick={e => { e.stopPropagation(); toggleCompare(p.id); }}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                title="Сравнить"
                style={{
                  background: compareList.includes(p.id) ? "var(--neon-cyan)" : "rgba(10,13,20,0.55)",
                  color: compareList.includes(p.id) ? "#000" : "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(6px)",
                  border: compareList.includes(p.id) ? "none" : "1px solid rgba(255,255,255,0.15)",
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

              <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between mb-3">
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
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/supplier?rfq=1&project=${encodeURIComponent(p.name)}&area=${p.area}&floors=${p.floors}`); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.1))", color: "#A855F7", border: "1px solid rgba(168,85,247,0.35)", boxShadow: "0 0 15px rgba(168,85,247,0.1)" }}>
                  <Icon name="Truck" size={13} />
                  Запросить КП у поставщиков
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
  );
}

// ─── CompareTab ───────────────────────────────────────────────────────────────

interface CompareTabProps {
  compareList: number[];
  toggleCompare: (id: number) => void;
  setActiveTab: (tab: string) => void;
}

export function CompareTab({ compareList, toggleCompare, setActiveTab }: CompareTabProps) {
  return (
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
  );
}

// ─── SmetaTab ─────────────────────────────────────────────────────────────────

interface SmetaTabProps {
  area: number;
  floors: number;
  finishing: string;
  houseTypeLabel: string;
  finishingLabel: string;
  onDownloadPDF: () => void;
}

export function SmetaTab({ area, floors, finishing, houseTypeLabel, finishingLabel, onDownloadPDF }: SmetaTabProps) {
  const smetaGroups = buildSmeta(area, floors, finishing);
  const smetaTotal = smetaGroups.reduce((s, g) => s + g.groupTotal, 0);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-green)" }}>
            Детализация
          </div>
          <h2 className="font-display text-3xl font-bold text-white">Смета строительства</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {area} м² · {floors} эт. · {houseTypeLabel} · Отделка: {finishingLabel}
          </p>
        </div>
        <button
          onClick={onDownloadPDF}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg, var(--neon-green), #00cc66)", color: "#0A0D14", boxShadow: "0 0 25px rgba(0,255,136,0.35)" }}>
          <Icon name="Download" size={16} />
          Скачать PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        {[
          { label: "Позиций в смете", val: String(smetaGroups.reduce((s, g) => s + g.items.length, 0)), color: "var(--neon-cyan)" },
          { label: "Разделов", val: String(smetaGroups.length), color: "#A855F7" },
          { label: "Итого по смете", val: formatPrice(smetaTotal), color: "var(--neon-green)" },
          { label: "Цена / м²", val: formatPrice(Math.round(smetaTotal / area)), color: "var(--neon-orange)" },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl p-4"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
            <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {smetaGroups.map((group, gi) => (
          <SmetaGroup key={gi} group={group} index={gi} />
        ))}
      </div>

      <div className="mt-6 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: "linear-gradient(135deg, #0d1a12, #111520)", border: "1px solid rgba(0,255,136,0.3)", boxShadow: "0 0 30px rgba(0,255,136,0.1)" }}>
        <div>
          <div className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>ИТОГО ПО СМЕТЕ</div>
          <div className="font-display font-black text-4xl" style={{ color: "var(--neon-green)" }}>
            {formatNum(smetaTotal)} ₽
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            * Ориентировочные цены. Фактические могут отличаться в зависимости от региона и поставщиков.
          </div>
        </div>
        <button
          onClick={onDownloadPDF}
          className="flex items-center gap-2 px-8 py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-105 whitespace-nowrap"
          style={{ background: "linear-gradient(135deg, var(--neon-green), #00cc66)", color: "#0A0D14", boxShadow: "0 0 25px rgba(0,255,136,0.4)" }}>
          <Icon name="FileDown" size={18} />
          Скачать PDF-смету
        </button>
      </div>
    </div>
  );
}