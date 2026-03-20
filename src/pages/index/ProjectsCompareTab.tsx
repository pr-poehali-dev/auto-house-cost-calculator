import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { PROJECTS, formatPrice, formatNum, buildSmeta, type SmetaGroupData } from "./data";
import ProjectCardImage from "./ProjectCardImage";
import ProjectCard from "./ProjectCard";
import SmetaGroup from "./SmetaGroup";

const PROJECTS_API = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";

function mapApiProject(p: Record<string, unknown>) {
  const files = (p.files as { file_type: string; file_url: string; file_name: string }[]) || [];
  const renders = files
    .filter(f => f.file_type === "render" && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.file_url))
    .map(f => f.file_url);
  const features = p.features ? String(p.features).split("\n").filter(Boolean) : [];
  return {
    id: p.id as number,
    name: p.name as string,
    type: p.type as string,
    area: p.area as number,
    floors: p.floors as number,
    rooms: p.rooms as number,
    price: p.price as number,
    tag: (p.tag as string) || p.type as string,
    tagColor: (p.tag_color as string) || "#FF6B1A",
    desc: (p.description as string) || "",
    features,
    image: renders[0] || "",
    renders,
    files,
  };
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
  const [projects, setProjects] = useState(PROJECTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${PROJECTS_API}?action=public_list`)
      .then(r => r.json())
      .then(r => {
        if (r.projects?.length) setProjects(r.projects.map(mapApiProject));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.1)", borderTopColor: "var(--neon-orange)" }} />
          Загрузка проектов...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p, i) => (
          <ProjectCard
            key={p.id}
            project={p}
            index={i}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
            compareList={compareList}
            toggleCompare={toggleCompare}
          />
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
  projects?: typeof PROJECTS;
}

export function CompareTab({ compareList, toggleCompare, setActiveTab, projects = PROJECTS }: CompareTabProps) {
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
                    const p = projects.find(pr => pr.id === id)!;
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
                  { label: "Тип строения", render: (p: (typeof projects)[0]) => p.type },
                  { label: "Площадь", render: (p: (typeof projects)[0]) => `${p.area} м²` },
                  { label: "Этажей", render: (p: (typeof projects)[0]) => String(p.floors) },
                  { label: "Комнат", render: (p: (typeof projects)[0]) => String(p.rooms) },
                  { label: "Стоимость от", render: (p: (typeof projects)[0]) => formatPrice(p.price), highlight: true },
                  { label: "Цена / м²", render: (p: (typeof projects)[0]) => formatPrice(Math.round(p.price / p.area)) },
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
                      const p = projects.find(pr => pr.id === id)!;
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
              const p = projects.find(pr => pr.id === id)!;
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

// re-export unused imports to avoid breaking any consumers that import from this file
export { ProjectCardImage };
export type { SmetaGroupData };
