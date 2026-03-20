import { useState } from "react";
import Icon from "@/components/ui/icon";

interface ProjectCardImageProps {
  renders: string[];
  tagColor: string;
  tag: string;
  compareList: number[];
  id: number;
  toggleCompare: (id: number) => void;
}

export default function ProjectCardImage({ renders, tagColor, tag, compareList, id, toggleCompare }: ProjectCardImageProps) {
  const [idx, setIdx] = useState(0);
  const images = renders.length > 0 ? renders : [""];

  return (
    <div className="relative w-full h-44 overflow-hidden bg-black/20">
      {images[idx] ? (
        <img src={images[idx]} alt={tag}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <Icon name="Image" size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
        </div>
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(10,13,20,0.9) 100%)" }} />

      {/* Тег */}
      <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold font-display"
        style={{ background: `${tagColor}ee`, color: "#0A0D14", backdropFilter: "blur(4px)" }}>
        {tag}
      </div>

      {/* Кнопка сравнить */}
      <button onClick={e => { e.stopPropagation(); toggleCompare(id); }}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: compareList.includes(id) ? "var(--neon-cyan)" : "rgba(10,13,20,0.55)",
          color: compareList.includes(id) ? "#000" : "rgba(255,255,255,0.75)",
          backdropFilter: "blur(6px)",
          border: compareList.includes(id) ? "none" : "1px solid rgba(255,255,255,0.15)",
        }}>
        <Icon name="GitCompare" size={13} />
      </button>

      {/* Стрелки навигации — только если рендеров > 1 */}
      {images.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}>
            <Icon name="ChevronLeft" size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            className="absolute right-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}>
            <Icon name="ChevronRight" size={13} />
          </button>
          {/* Точки */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className="rounded-full transition-all"
                style={{ width: i === idx ? 16 : 6, height: 6, background: i === idx ? tagColor : "rgba(255,255,255,0.4)" }} />
            ))}
          </div>
          {/* Счётчик */}
          <div className="absolute bottom-2 right-10 text-xs px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)" }}>
            {idx + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
}
