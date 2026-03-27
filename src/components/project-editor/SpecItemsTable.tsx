import Icon from "@/components/ui/icon";
import { DEFAULT_SECTIONS, fmt } from "./types";
import type { Spec, SpecItem } from "./types";

interface Props {
  spec: Spec;
  canEdit: boolean;
  saving: number | null;
  editingCell: { id: number; field: string } | null;
  newItemSection: string;
  onEditCell: (cell: { id: number; field: string } | null) => void;
  onUpdateItem: (item: SpecItem, field: string, value: string | number) => void;
  onDeleteItem: (id: number) => void;
  onAddItem: () => void;
  onSectionChange: (s: string) => void;
}

export default function SpecItemsTable({
  spec, canEdit, saving, editingCell, newItemSection,
  onEditCell, onUpdateItem, onDeleteItem, onAddItem, onSectionChange,
}: Props) {
  const sections = Array.from(new Set(spec.items.map(i => i.section)));
  const grandTotal = spec.items.reduce((s, i) => s + i.total_price, 0);

  return (
    <>
      <div className="space-y-3">
        {sections.map(section => {
          const items = spec.items.filter(i => i.section === section);
          const sTotal = items.reduce((s, i) => s + i.total_price, 0);
          return (
            <div key={section} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)" }}>
                <span className="font-display font-semibold text-sm text-white">{section}</span>
                <span className="text-sm font-bold" style={{ color: "var(--neon-orange)" }}>{fmt(sTotal)} ₽</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Наименование", "Ед.", "Кол-во", "Цена/ед., ₽", "Сумма, ₽", "Примечание", ""].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                      {(["name", "unit", "qty", "price_per_unit", "total_price", "note"] as const).map(field => {
                        const isEditing = canEdit && editingCell?.id === item.id && editingCell?.field === field;
                        const isReadonly = field === "total_price";
                        const val = item[field];
                        return (
                          <td key={field} className="px-3 py-2"
                            onClick={() => canEdit && !isReadonly && onEditCell({ id: item.id, field })}
                            style={{ cursor: canEdit && !isReadonly ? "pointer" : "default" }}>
                            {isEditing ? (
                              <input autoFocus
                                type={["qty", "price_per_unit"].includes(field) ? "number" : "text"}
                                defaultValue={String(val)}
                                className="w-full px-1.5 py-1 rounded text-sm text-white outline-none"
                                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid var(--neon-cyan)", minWidth: 60 }}
                                onBlur={e => onUpdateItem(item, field, ["qty", "price_per_unit"].includes(field) ? +e.target.value : e.target.value)}
                                onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                              />
                            ) : (
                              <span style={{
                                color: field === "total_price" ? "var(--neon-orange)" : field === "name" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                                fontWeight: field === "total_price" ? 600 : "normal",
                              }}>
                                {saving === item.id && field === editingCell?.field ? "..." : typeof val === "number" ? fmt(val) : String(val || "—")}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        {canEdit && (
                          <button onClick={() => onDeleteItem(item.id)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20"
                            style={{ color: "rgba(255,255,255,0.2)" }}>
                            <Icon name="Trash2" size={11} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select value={newItemSection} onChange={e => onSectionChange(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {DEFAULT_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={onAddItem}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,107,26,0.12)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.25)" }}>
            <Icon name="Plus" size={14} /> Добавить позицию
          </button>
        </div>
      )}

      <div className="mt-4 rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.2)" }}>
        <span className="font-display font-semibold text-white">ИТОГО ПО ВЕДОМОСТИ</span>
        <span className="font-display font-black text-2xl" style={{ color: "var(--neon-orange)" }}>{fmt(grandTotal)} ₽</span>
      </div>
    </>
  );
}
