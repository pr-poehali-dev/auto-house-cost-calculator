import { useState } from "react";
import Icon from "@/components/ui/icon";
import { formatNum, type SmetaGroupData } from "./data";

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

interface SmetaGroupProps {
  group: SmetaGroupData;
  index: number;
}

export default function SmetaGroup({ group, index }: SmetaGroupProps) {
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
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold"
                  style={{ color: "rgba(255,255,255,0.5)" }}>Итого по разделу</td>
                <td colSpan={2} className="px-4 py-3 text-right font-display font-bold text-base"
                  style={{ color }}>{formatNum(group.groupTotal)} ₽</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
