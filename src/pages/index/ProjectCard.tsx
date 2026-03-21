import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { formatPrice } from "./data";
import ProjectCardImage from "./ProjectCardImage";

interface Project {
  id: number;
  name: string;
  type: string;
  area: number;
  floors: number;
  rooms: number;
  price: number;
  tag: string;
  tagColor: string;
  desc: string;
  features: string[];
  image: string;
  renders?: string[];
}

interface ProjectCardProps {
  project: Project;
  index: number;
  selectedProject: number | null;
  setSelectedProject: (id: number | null) => void;
  compareList: number[];
  toggleCompare: (id: number) => void;
}

export default function ProjectCard({ project: p, index: i, selectedProject, setSelectedProject, compareList, toggleCompare }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: "var(--card-bg)",
        border: selectedProject === p.id ? `1px solid ${p.tagColor}` : "1px solid var(--card-border)",
        boxShadow: selectedProject === p.id ? `0 0 30px ${p.tagColor}44` : "none",
        animation: `fadeInUp 0.5s ease-out ${i * 0.07}s both`,
      }}
      onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}>
      {/* Шапка с рендерами */}
      <ProjectCardImage
        renders={p.renders ?? ([p.image].filter(Boolean) as string[])}
        tagColor={p.tagColor}
        tag={p.tag}
        compareList={compareList}
        id={p.id}
        toggleCompare={toggleCompare}
      />

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
            <button
              onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: `${p.tagColor}22`, color: p.tagColor, border: `1px solid ${p.tagColor}44` }}>
              Подробнее
            </button>
          </div>

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
  );
}