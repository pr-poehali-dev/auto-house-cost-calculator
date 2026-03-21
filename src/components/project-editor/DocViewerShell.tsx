import Icon from "@/components/ui/icon";
import { DOC_CATEGORIES } from "./DocUploadManager";
import DocPageViewer from "./DocPageViewer";
import type { AiItem } from "@/pages/staff/materials-types";

interface UploadedDoc {
  id: number;
  file_name: string;
  file_url: string;
  status: string;
  doc_category: string;
  doc_category_label: string;
  page_count: number | null;
  created_at: string;
  s3_key?: string;
}

interface PageData {
  page: number;
  text_preview: string;
  text?: string;
  items: AiItem[];
  items_count: number;
  analyzed?: boolean;
}

interface DocViewerShellProps {
  activeDoc: UploadedDoc;
  pages: PageData[];
  totalPages: number;
  currentPage: number;
  analyzingPage: number | null;
  selectedItems: Set<string>;
  totalSelected: number;
  analyzedCount: number;
  onBack: () => void;
  onPageClick: (page: number) => void;
  onAnalyzePage: (page: number) => void;
  onAnalyzeAll: () => void;
  onImport: () => void;
  onToggleItem: (page: number, idx: number) => void;
  onSelectAllOnPage: () => void;
  onDeselectAllOnPage: () => void;
  onStartOcr: () => void;
}

export default function DocViewerShell({
  activeDoc,
  pages,
  totalPages,
  currentPage,
  analyzingPage,
  selectedItems,
  totalSelected,
  analyzedCount,
  onBack,
  onPageClick,
  onAnalyzePage,
  onAnalyzeAll,
  onImport,
  onToggleItem,
  onSelectAllOnPage,
  onDeselectAllOnPage,
  onStartOcr,
}: DocViewerShellProps) {
  const cat = DOC_CATEGORIES[activeDoc.doc_category] || DOC_CATEGORIES.other;
  const currentPageData = pages.find(p => p.page === currentPage);

  return (
    <div className="flex flex-col" style={{ minHeight: 500 }}>
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}>
          <Icon name="ArrowLeft" size={14} /> Назад
        </button>
        <span className="text-xl flex-shrink-0">{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm truncate">{activeDoc.file_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${cat.color}20`, color: cat.color }}>
              {activeDoc.doc_category_label}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            {totalPages > 0 ? `${totalPages} стр.` : ""} · Проанализировано: {analyzedCount}/{totalPages || "?"}
            {totalSelected > 0 && <span style={{ color: "var(--neon-green)" }}> · Выбрано: {totalSelected}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {totalPages > 0 && analyzedCount < totalPages && (
            <button onClick={onAnalyzeAll} disabled={analyzingPage !== null}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name={analyzingPage !== null ? "Loader" : "Sparkles"} size={14}
                style={{ animation: analyzingPage !== null ? "spin 1s linear infinite" : "none" }} />
              {analyzingPage !== null ? `Анализирую стр. ${analyzingPage}...` : "Анализировать всё"}
            </button>
          )}
          {totalSelected > 0 && (
            <button onClick={onImport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: "var(--neon-cyan)", color: "#000" }}>
              <Icon name="Download" size={14} /> Импорт ({totalSelected})
            </button>
          )}
        </div>
      </div>

      {/* OCR-заглушка для скан-документов */}
      {totalPages === 0 && (
        <div className="flex-1 flex items-center justify-center py-16 text-center">
          <div>
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm text-white mb-1">Документ-скан (PDF с изображениями)</div>
            <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
              Встроенного текста не найдено. Нажмите «OCR-распознавание» — <br/>
              AI прочитает текст со страниц через OCR и разберёт по позициям.
            </div>
            <button onClick={onStartOcr}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium mx-auto"
              style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name="ScanText" size={16} />
              OCR-распознавание
            </button>
          </div>
        </div>
      )}

      {/* Основное содержимое: список страниц + просмотр */}
      {totalPages > 0 && (
        <div className="flex gap-4" style={{ minHeight: 420 }}>
          {/* Список страниц (левая колонка) */}
          <div className="flex-shrink-0 w-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: "thin" }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
              const pd = pages.find(x => x.page === p);
              const isAnalyzing = analyzingPage === p;
              const isActive = currentPage === p;
              return (
                <button key={p}
                  onClick={() => onPageClick(p)}
                  className="w-full text-left p-2.5 rounded-xl transition-all"
                  style={{
                    background: isActive ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold"
                      style={{ color: isActive ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)" }}>
                      Стр. {p}
                    </span>
                    {isAnalyzing ? (
                      <div className="w-3 h-3 rounded-full border border-orange-400 border-t-transparent animate-spin" />
                    ) : pd ? (
                      <span className="text-xs font-bold px-1 rounded"
                        style={{
                          background: pd.items_count > 0 ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)",
                          color: pd.items_count > 0 ? "var(--neon-green)" : "rgba(255,255,255,0.3)",
                        }}>
                        {pd.items_count}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                    )}
                  </div>
                  {pd && (
                    <div className="text-xs leading-tight"
                      style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                      {pd.text_preview?.slice(0, 50)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Просмотр содержимого страницы */}
          <DocPageViewer
            currentPage={currentPage}
            currentPageData={currentPageData}
            analyzingPage={analyzingPage}
            selectedItems={selectedItems}
            onReanalyze={onAnalyzePage}
            onToggleItem={onToggleItem}
            onSelectAll={onSelectAllOnPage}
            onDeselectAll={onDeselectAllOnPage}
          />
        </div>
      )}
    </div>
  );
}
