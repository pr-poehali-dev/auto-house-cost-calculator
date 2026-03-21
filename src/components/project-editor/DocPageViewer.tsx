import Icon from "@/components/ui/icon";
import type { AiItem } from "@/pages/staff/materials-types";

interface PageData {
  page: number;
  text_preview: string;
  text?: string;
  items: AiItem[];
  items_count: number;
  analyzed?: boolean;
}

interface DocPageViewerProps {
  currentPage: number;
  currentPageData: PageData | undefined;
  analyzingPage: number | null;
  selectedItems: Set<string>;
  onReanalyze: (page: number) => void;
  onToggleItem: (page: number, idx: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export default function DocPageViewer({
  currentPage,
  currentPageData,
  analyzingPage,
  selectedItems,
  onReanalyze,
  onToggleItem,
  onSelectAll,
  onDeselectAll,
}: DocPageViewerProps) {
  return (
    <div className="flex-1 overflow-y-auto space-y-3" style={{ scrollbarWidth: "thin" }}>
      {!currentPageData && analyzingPage !== currentPage && (
        <div className="py-8 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
          <Icon name="MousePointerClick" size={20} style={{ color: "rgba(255,255,255,0.2)", margin: "0 auto 8px" }} />
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Нажмите на страницу чтобы запустить анализ</div>
        </div>
      )}
      {analyzingPage === currentPage && (
        <div className="py-8 text-center rounded-xl" style={{ background: "rgba(255,107,26,0.05)", border: "1px solid rgba(255,107,26,0.15)" }}>
          <div className="w-8 h-8 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin mx-auto mb-3" />
          <div className="text-sm text-white">AI анализирует страницу {currentPage}...</div>
        </div>
      )}
      {currentPageData && (
        <>
          {currentPageData.text_preview && (
            <div className="p-3 rounded-xl text-xs leading-relaxed font-mono"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="FileText" size={11} style={{ color: "rgba(255,255,255,0.25)" }} />
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Стр. {currentPage} — текст</span>
                <button onClick={() => onReanalyze(currentPage)} disabled={analyzingPage !== null}
                  className="ml-auto text-xs px-2 py-0.5 rounded"
                  style={{ background: "rgba(255,107,26,0.1)", color: "var(--neon-orange)" }}>
                  Перезапустить
                </button>
              </div>
              {currentPageData.text_preview}
            </div>
          )}
          {currentPageData.items.length > 0 ? (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-3 py-2 flex items-center justify-between"
                style={{ background: "rgba(0,255,136,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>
                  {currentPageData.items_count} позиций
                </span>
                <div className="flex gap-2">
                  <button onClick={onSelectAll}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    Все
                  </button>
                  <button onClick={onDeselectAll}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    Снять
                  </button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(20,26,40,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th className="p-2 w-7"></th>
                    <th className="p-2 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Раздел</th>
                    <th className="p-2 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Наименование</th>
                    <th className="p-2 text-center w-12 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Ед.</th>
                    <th className="p-2 text-right w-14 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Кол.</th>
                    <th className="p-2 text-right w-20 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageData.items.map((item, i) => {
                    const key = `${currentPage}_${i}`;
                    const sel = selectedItems.has(key);
                    return (
                      <tr key={i} onClick={() => onToggleItem(currentPage, i)}
                        className="cursor-pointer hover:bg-white/5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: sel ? "rgba(0,212,255,0.04)" : "transparent" }}>
                        <td className="p-2 text-center">
                          <div className="w-4 h-4 rounded flex items-center justify-center mx-auto"
                            style={{ background: sel ? "var(--neon-cyan)" : "rgba(255,255,255,0.08)", border: sel ? "none" : "1px solid rgba(255,255,255,0.15)" }}>
                            {sel && <Icon name="Check" size={9} style={{ color: "#000" }} />}
                          </div>
                        </td>
                        <td className="p-2" style={{ color: "rgba(255,255,255,0.4)" }}>{item.section}</td>
                        <td className="p-2 text-white font-medium">{item.name}</td>
                        <td className="p-2 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                        <td className="p-2 text-right" style={{ color: "rgba(255,255,255,0.6)" }}>{item.qty || "—"}</td>
                        <td className="p-2 text-right font-semibold"
                          style={{ color: item.price_per_unit ? "var(--neon-green)" : "rgba(255,255,255,0.2)" }}>
                          {item.price_per_unit ? new Intl.NumberFormat("ru-RU").format(item.price_per_unit) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-5 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.07)" }}>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>На этой странице позиции не найдены</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
