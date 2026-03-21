import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AI_URL, apiFetch, AiItem } from "@/pages/staff/materials-types";

// Разделы проектной документации по ПП РФ №87
export const DOC_CATEGORIES: Record<string, { label: string; icon: string; color: string; group: string }> = {
  // Текстовые разделы
  explanatory_note:  { label: "Пояснительная записка (ПЗ)", icon: "📝", color: "#A855F7", group: "text" },
  construction_org:  { label: "Проект организации строительства (ПОС)", icon: "🏗️", color: "#6366F1", group: "text" },
  demolition_org:    { label: "Проект организации сноса (ПОД)", icon: "🔨", color: "#8B5CF6", group: "text" },
  environment:       { label: "Охрана окружающей среды", icon: "🌿", color: "#10B981", group: "text" },
  fire_safety:       { label: "Пожарная безопасность", icon: "🔥", color: "#EF4444", group: "text" },
  accessibility:     { label: "Доступность МГН", icon: "♿", color: "#F59E0B", group: "text" },
  energy_efficiency: { label: "Энергоэффективность", icon: "⚡", color: "#FBBF24", group: "text" },
  smeta:             { label: "Сводный сметный расчёт", icon: "💼", color: "#F97316", group: "text" },
  // Графические разделы
  scheme_layout:     { label: "Схема планировочной организации (СПОЗУ)", icon: "🗺️", color: "#0EA5E9", group: "graphic" },
  architecture:      { label: "Архитектурные решения (АР)", icon: "🏛️", color: "#06B6D4", group: "graphic" },
  construction:      { label: "Конструктивные решения (КР/КЖ/КМ)", icon: "⚙️", color: "#3B82F6", group: "graphic" },
  engineering:       { label: "Инженерные системы (ИОС/ВК/ОВ/ЭО)", icon: "🔧", color: "#2563EB", group: "graphic" },
  drawing:           { label: "Чертёж / схема", icon: "📐", color: "#FF6B1A", group: "graphic" },
  // Аналитические
  specification:     { label: "Спецификация материалов", icon: "📋", color: "#00D4FF", group: "analytic" },
  work_statement:    { label: "Ведомость объёмов работ (ВОР)", icon: "📊", color: "#00FF88", group: "analytic" },
  estimate:          { label: "Смета / расчёт стоимости", icon: "💰", color: "#FBBF24", group: "analytic" },
  other:             { label: "Прочее", icon: "📎", color: "rgba(255,255,255,0.4)", group: "other" },
};

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

interface DocUploadManagerProps {
  token: string;
  projectId?: number;
  onImport: (items: AiItem[], category: string) => void;
}

const CHUNK_SIZE = 400 * 1024; // 400 КБ

export default function DocUploadManager({ token, projectId, onImport }: DocUploadManagerProps) {
  const [uploads, setUploads] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [activeDoc, setActiveDoc] = useState<UploadedDoc | null>(null);
  const [activeS3Key, setActiveS3Key] = useState("");
  const [pages, setPages] = useState<PageData[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [analyzingPage, setAnalyzingPage] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("all");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadUploads(); }, [projectId]);

  const loadUploads = async () => {
    if (!projectId) return;
    const r = await apiFetch(`${AI_URL}?action=list&project_id=${projectId}`, {}, token);
    if (r.uploads) setUploads(r.uploads);
  };

  const upload = async (file: File) => {
    setUploading(true);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadSessId = "";

    try {
      for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const arrayBuf = await slice.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let j = 0; j < bytes.length; j += 1024)
          binary += String.fromCharCode(...bytes.subarray(j, j + 1024));
        const chunk_b64 = btoa(binary);

        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(`Загружаю файл... ${pct}%`);

        const r = await apiFetch(`${AI_URL}?action=upload_doc_chunk`, {
          method: "POST",
          body: JSON.stringify({
            chunk: chunk_b64, chunk_index: i, total_chunks: totalChunks,
            upload_id: uploadSessId, file_name: file.name, project_id: projectId,
          }),
        }, token);

        if (!r.ok) { setUploadProgress("Ошибка загрузки"); setUploading(false); return; }
        if (r.upload_id && !uploadSessId) uploadSessId = String(r.upload_id);
        if (!r.done) continue;

        // Файл загружен и классифицирован
        setUploadProgress("");
        setUploading(false);
        await loadUploads();

        const newDoc: UploadedDoc = {
          id: Number(r.upload_id),
          file_name: file.name,
          file_url: String(r.file_url || ""),
          status: "uploaded",
          doc_category: String(r.doc_category || "other"),
          doc_category_label: String(r.doc_category_label || "Прочее"),
          page_count: r.pages_count ? Number(r.pages_count) : null,
          created_at: new Date().toISOString(),
          s3_key: String(r.s3_key || ""),
        };
        setActiveDoc(newDoc);
        setActiveS3Key(String(r.s3_key || ""));
        setTotalPages(r.pages_count ? Number(r.pages_count) : 0);
        setPages([]);
        setCurrentPage(1);
        return;
      }
    } catch (e) {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const analyzePage = async (pageNum: number) => {
    if (!activeDoc) return;
    setAnalyzingPage(pageNum);
    try {
      const r = await apiFetch(`${AI_URL}?action=analyze_page`, {
        method: "POST",
        body: JSON.stringify({ upload_id: activeDoc.id, page: pageNum }),
      }, token);
      if (r.ok) {
        const pageData: PageData = {
          page: pageNum,
          text_preview: r.text_preview || "",
          items: r.items || [],
          items_count: r.items_count || 0,
        };
        setPages(prev => {
          const filtered = prev.filter(p => p.page !== pageNum);
          return [...filtered, pageData].sort((a, b) => a.page - b.page);
        });
        // Автовыбор всех позиций
        const newKeys = new Set(selectedItems);
        (r.items || []).forEach((_: AiItem, i: number) => newKeys.add(`${pageNum}_${i}`));
        setSelectedItems(newKeys);
      }
    } catch (e) {
      console.error("analyze page error", e);
    }
    setAnalyzingPage(null);
  };

  const analyzeAllPages = async () => {
    if (!activeDoc || !totalPages) return;
    for (let p = 1; p <= totalPages; p++) {
      await analyzePage(p);
    }
    // Завершаем анализ
    await apiFetch(`${AI_URL}?action=finish_analysis`, {
      method: "POST",
      body: JSON.stringify({ upload_id: activeDoc.id }),
    }, token);
    await loadUploads();
  };

  const openDoc = async (doc: UploadedDoc) => {
    setActiveDoc(doc);
    setCurrentPage(1);
    setPages([]);
    setSelectedItems(new Set());
    const match = doc.file_url.match(/\/bucket\/(.+)$/);
    setActiveS3Key(match ? match[1] : "");
    setTotalPages(doc.page_count || 0);
    // Загружаем страницы из БД (уже содержат текст и возможно items)
    const r = await apiFetch(`${AI_URL}?action=get&upload_id=${doc.id}`, {}, token);
    if (r.upload?.pages?.length) {
      setPages(r.upload.pages);
      setTotalPages(r.upload.pages.length);
      const allKeys = new Set<string>();
      r.upload.pages.forEach((p: PageData) => {
        if (p.items?.length) p.items.forEach((_: AiItem, i: number) => allKeys.add(`${p.page}_${i}`));
      });
      setSelectedItems(allKeys);
    }
  };

  const toggleItem = (pageNum: number, idx: number) => {
    const key = `${pageNum}_${idx}`;
    setSelectedItems(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const importSelected = () => {
    if (!activeDoc) return;
    const items: AiItem[] = [];
    pages.forEach(p => p.items.forEach((item, i) => {
      if (selectedItems.has(`${p.page}_${i}`)) items.push(item);
    }));
    onImport(items, activeDoc.doc_category);
    setActiveDoc(null);
    setPages([]);
  };

  const currentPageData = pages.find(p => p.page === currentPage);
  const analyzedCount = pages.length;
  const totalSelected = selectedItems.size;
  const byCategory = (cat: string) => uploads.filter(u => cat === "all" || (u.doc_category || "other") === cat);
  const cats = ["all", ...Array.from(new Set(uploads.map(u => u.doc_category || "other")))];

  // ── Просмотр документа ──────────────────────────────────────────────────
  if (activeDoc) {
    const cat = DOC_CATEGORIES[activeDoc.doc_category] || DOC_CATEGORIES.other;
    return (
      <div className="flex flex-col" style={{ minHeight: 500 }}>
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => setActiveDoc(null)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="ArrowLeft" size={14} /> Назад
          </button>
          <span className="text-xl flex-shrink-0">{cat.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white text-sm truncate">{activeDoc.file_name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${cat.color}20`, color: cat.color }}>
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
              <button onClick={analyzeAllPages} disabled={analyzingPage !== null}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
                <Icon name={analyzingPage !== null ? "Loader" : "Sparkles"} size={14}
                  style={{ animation: analyzingPage !== null ? "spin 1s linear infinite" : "none" }} />
                {analyzingPage !== null ? `Анализирую стр. ${analyzingPage}...` : "Анализировать всё"}
              </button>
            )}
            {totalSelected > 0 && (
              <button onClick={importSelected}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: "var(--neon-cyan)", color: "#000" }}>
                <Icon name="Download" size={14} /> Импорт ({totalSelected})
              </button>
            )}
          </div>
        </div>

        {totalPages === 0 && (
          <div className="flex-1 flex items-center justify-center py-16 text-center">
            <div>
              <div className="text-4xl mb-3">📄</div>
              <div className="text-sm text-white mb-1">Документ загружен и классифицирован</div>
              <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Не удалось извлечь текст. Возможно, документ содержит только изображения.</div>
            </div>
          </div>
        )}

        {totalPages > 0 && (
          <div className="flex gap-4" style={{ minHeight: 420 }}>
            {/* Список страниц */}
            <div className="flex-shrink-0 w-40 overflow-y-auto space-y-1" style={{ scrollbarWidth: "thin" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                const pd = pages.find(x => x.page === p);
                const isAnalyzing = analyzingPage === p;
                const isActive = currentPage === p;
                return (
                  <button key={p} onClick={() => { setCurrentPage(p); if (!pd || !pd.analyzed) analyzePage(p); }}
                    className="w-full text-left p-2.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: isActive ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)" }}>
                        Стр. {p}
                      </span>
                      {isAnalyzing ? (
                        <div className="w-3 h-3 rounded-full border border-orange-400 border-t-transparent animate-spin" />
                      ) : pd ? (
                        <span className="text-xs font-bold px-1 rounded" style={{ background: pd.items_count > 0 ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)", color: pd.items_count > 0 ? "var(--neon-green)" : "rgba(255,255,255,0.3)" }}>
                          {pd.items_count}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                      )}
                    </div>
                    {pd && (
                      <div className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                        {pd.text_preview?.slice(0, 50)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Содержимое страницы */}
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
                        <button onClick={() => analyzePage(currentPage)} disabled={analyzingPage !== null}
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
                          <button onClick={() => {
                            const s = new Set(selectedItems);
                            currentPageData.items.forEach((_, i) => s.add(`${currentPage}_${i}`));
                            setSelectedItems(s);
                          }} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Все</button>
                          <button onClick={() => {
                            const s = new Set(selectedItems);
                            currentPageData.items.forEach((_, i) => s.delete(`${currentPage}_${i}`));
                            setSelectedItems(s);
                          }} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Снять</button>
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
                              <tr key={i} onClick={() => toggleItem(currentPage, i)}
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
                                <td className="p-2 text-right font-semibold" style={{ color: item.price_per_unit ? "var(--neon-green)" : "rgba(255,255,255,0.2)" }}>
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
          </div>
        )}
      </div>
    );
  }

  // ── Список документов ───────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--neon-orange)" }}>ПП РФ №87</div>
          <h3 className="font-semibold text-white">Проектная документация</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            AI определит раздел и разберёт по позициям постранично
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
          <Icon name="Upload" size={16} />
          Загрузить
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
          onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      {(uploading || uploadProgress) && (
        <div className="mb-4 p-4 rounded-xl flex items-center gap-3"
          style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.2)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,107,26,0.15)" }}>
            <Icon name="Loader" size={16} style={{ color: "var(--neon-orange)", animation: "spin 1s linear infinite" }} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{uploadProgress || "Обработка..."}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Не закрывайте страницу</div>
          </div>
        </div>
      )}

      {/* Фильтр по разделам */}
      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cats.map(cat => {
            const info = cat === "all" ? { label: "Все", icon: "📂", color: "rgba(255,255,255,0.5)" } : DOC_CATEGORIES[cat];
            const count = cat === "all" ? uploads.length : uploads.filter(u => (u.doc_category || "other") === cat).length;
            return (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterCategory === cat ? `${info?.color}20` : "rgba(255,255,255,0.04)",
                  color: filterCategory === cat ? (info?.color || "white") : "rgba(255,255,255,0.5)",
                  border: `1px solid ${filterCategory === cat ? `${info?.color}40` : "rgba(255,255,255,0.07)"}`,
                }}>
                <span>{info?.icon}</span> {info?.label?.split(" ")[0]} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Список документов */}
      {byCategory(filterCategory).length > 0 ? (
        <div className="space-y-2">
          {byCategory(filterCategory).map(doc => {
            const cat = DOC_CATEGORIES[doc.doc_category || "other"] || DOC_CATEGORIES.other;
            return (
              <div key={doc.id} onClick={() => openDoc(doc)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{doc.file_name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${cat.color}15`, color: cat.color }}>
                      {cat.label.split(" ")[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {doc.page_count && <span>{doc.page_count} стр.</span>}
                    <span style={{ color: doc.status === "done" ? "var(--neon-green)" : doc.status === "uploaded" ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                      {doc.status === "done" ? "✓ Обработан" : doc.status === "uploaded" ? "Загружен" : doc.status}
                    </span>
                    <span>{new Date(doc.created_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
                <Icon name="ChevronRight" size={16} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center rounded-2xl" style={{ border: "2px dashed rgba(255,255,255,0.08)" }}>
          <div className="text-3xl mb-3">📂</div>
          <div className="text-sm font-medium text-white mb-1">Документы не загружены</div>
          <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Загрузите PDF, Excel, CSV — AI определит раздел по ПП РФ №87<br/>и разберёт по позициям постранично
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto text-left">
            {["specification","work_statement","estimate","architecture","construction","engineering"].map(k => {
              const c = DOC_CATEGORIES[k];
              return (
                <div key={k} className="flex items-center gap-1.5 text-xs p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}>
                  <span>{c.icon}</span><span className="truncate">{c.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}