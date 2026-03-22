import Icon from "@/components/ui/icon";
import type { PriceRow, PriceVersion } from "./supplier-types";

interface PriceListArchiveProps {
  versions: PriceVersion[];
  archiveItems: PriceRow[];
  archiveLoading: boolean;
  onLoadVersion: (versionId: number) => void;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function PriceListArchive({ versions, archiveItems, archiveLoading, onLoadVersion }: PriceListArchiveProps) {
  return (
    <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>История версий прайса</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {versions.map(v => (
          <button key={v.id} onClick={() => onLoadVersion(v.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
            style={{ background: archiveItems[0]?.valid_from === v.version_date ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span>{formatDate(v.version_date)}</span>
            <span className="ml-1.5 opacity-50">{v.items_count} поз.</span>
            {v.file_name && <span className="ml-1.5 opacity-40">· {v.file_name.split("/").pop()}</span>}
          </button>
        ))}
      </div>
      {archiveLoading ? (
        <div className="text-xs py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : archiveItems.length > 0 && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Наименование","Ед.","Цена","Категория"].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archiveItems.map((r, i) => (
                <tr key={r._key || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-1.5 text-white">{r.material_name}</td>
                  <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>{r.unit}</td>
                  <td className="px-3 py-1.5 font-mono" style={{ color: "var(--neon-cyan)" }}>{Number(r.price_per_unit).toLocaleString("ru-RU")}</td>
                  <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
