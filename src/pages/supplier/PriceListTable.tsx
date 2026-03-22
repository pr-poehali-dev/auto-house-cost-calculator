import Icon from "@/components/ui/icon";
import type { PriceRow } from "./supplier-types";
import { UNITS, CATS } from "./supplier-types";

interface PriceListTableProps {
  rows: PriceRow[];
  loadingExisting: boolean;
  classifying: boolean;
  searchQ: Record<number, string>;
  searchRes: Record<number, { id: number; name: string; unit: string; category: string }[]>;
  onAddRow: () => void;
  onRemoveRow: (k: number) => void;
  onUpdateRow: (k: number, field: keyof PriceRow, value: unknown) => void;
  onSearchMaterial: (k: number, q: string) => void;
  onPickMaterial: (k: number, mat: { id: number; name: string; unit: string; category: string }) => void;
  onClearSearch: (k: number) => void;
  onClassifyWithAI: () => void;
}

const inp = "w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none";
const inpSt = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" };

export default function PriceListTable({
  rows, loadingExisting, classifying,
  searchQ, searchRes,
  onAddRow, onRemoveRow, onUpdateRow,
  onSearchMaterial, onPickMaterial, onClearSearch,
  onClassifyWithAI,
}: PriceListTableProps) {
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--card-border)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
          Позиции прайс-листа ({rows.length})
        </span>
        <div className="flex items-center gap-2">
          {rows.some(r => r.material_name.trim()) && (
            <button onClick={onClassifyWithAI} disabled={classifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
              <Icon name={classifying ? "Loader" : "Sparkles"} size={13} />
              {classifying ? "AI думает..." : "Распознать AI"}
            </button>
          )}
          <button onClick={onAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
            <Icon name="Plus" size={13} /> Добавить строку
          </button>
        </div>
      </div>

      {loadingExisting ? (
        <div className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузите файл или добавьте позиции вручную</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Наименование","Ед.","Цена, ₽","Категория","Артикул","Примечание",""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row._key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                  {/* Наименование с поиском */}
                  <td className="px-3 py-2 min-w-48 relative">
                    <input
                      className={inp}
                      style={{ ...inpSt, ...(row.material_id ? { borderColor: "rgba(0,255,136,0.3)" } : {}) }}
                      placeholder="Название материала"
                      value={searchQ[row._key] !== undefined ? searchQ[row._key] : row.material_name}
                      onChange={e => onSearchMaterial(row._key, e.target.value)}
                    />
                    {row.material_id && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--neon-green)" }}>✓</span>
                    )}
                    {(searchRes[row._key]?.length || 0) > 0 && (
                      <div className="absolute z-20 left-3 top-full mt-1 rounded-xl overflow-hidden shadow-xl"
                        style={{ background: "#1a1f2e", border: "1px solid rgba(0,212,255,0.2)", minWidth: 240 }}>
                        {searchRes[row._key].map(m => (
                          <button key={m.id} type="button" onClick={() => onPickMaterial(row._key, m)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors">
                            <span className="text-white font-medium">{m.name}</span>
                            <span className="ml-2 opacity-50">{m.unit} · {m.category}</span>
                          </button>
                        ))}
                        <button type="button" onClick={() => onClearSearch(row._key)}
                          className="w-full text-left px-3 py-2 text-xs border-t transition-colors hover:bg-white/10"
                          style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--neon-orange)" }}>
                          + Добавить как новый материал
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 w-20">
                    <select className={inp} style={inpSt} value={row.unit} onChange={e => onUpdateRow(row._key, "unit", e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-28">
                    <input type="number" className={inp}
                      style={{ ...inpSt, ...(parseFloat(String(row.price_per_unit)) > 0 ? { borderColor: "rgba(0,212,255,0.3)" } : {}) }}
                      placeholder="0" value={row.price_per_unit}
                      onChange={e => onUpdateRow(row._key, "price_per_unit", e.target.value)} />
                  </td>
                  <td className="px-3 py-2 w-36">
                    <select className={inp} style={inpSt} value={row.category} onChange={e => onUpdateRow(row._key, "category", e.target.value)}>
                      {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 w-24">
                    <input className={inp} style={inpSt} placeholder="—" value={row.article}
                      onChange={e => onUpdateRow(row._key, "article", e.target.value)} />
                  </td>
                  <td className="px-3 py-2 w-36">
                    <input className={inp} style={inpSt} placeholder="Примечание" value={row.note}
                      onChange={e => onUpdateRow(row._key, "note", e.target.value)} />
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => onRemoveRow(row._key)}
                      className="p-1 rounded-lg transition-all hover:bg-red-500/20"
                      style={{ color: "rgba(255,255,255,0.2)" }}>
                      <Icon name="X" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
