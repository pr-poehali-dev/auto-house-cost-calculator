import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AI_URL, apiFetch, AiItem } from "@/pages/staff/materials-types";

export const DOC_CATEGORIES: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  specification: { label: "Спецификация", icon: "📋", color: "#00D4FF", desc: "Спецификации материалов и изделий" },
  work_statement: { label: "Ведомость работ", icon: "📊", color: "#00FF88", desc: "Ведомости объёмов работ" },
  estimate: { label: "Смета", icon: "💰", color: "#FBBF24", desc: "Сметы и расчёты стоимости" },
  explanatory_note: { label: "Пояснительная", icon: "📝", color: "#A855F7", desc: "Пояснительные записки" },
  drawing: { label: "Чертёж", icon: "📐", color: "#FF6B1A", desc: "Чертежи и схемы" },
  other: { label: "Прочее", icon: "📎", color: "rgba(255,255,255,0.4)", desc: "Прочая документация" },
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
  by: string;
  error?: string;
}

interface PageData {
  page: number;
  text_preview: string;
  items: AiItem[];
  items_count: number;
}

interface DocUploadManagerProps {
  token: string;
  projectId?: number;
  specId?: number;
  onImport: (items: AiItem[], category: string) => void;
}

export default function DocUploadManager({ token, projectId, specId, onImport }: DocUploadManagerProps) {
  const [uploads, setUploads] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [activeDoc, setActiveDoc] = useState<UploadedDoc | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [analyzingPages, setAnalyzingPages] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadUploads(); }, [projectId]);

  const loadUploads = async () => {
    if (!projectId) return;
    const r = await apiFetch(`${AI_URL}?action=list&project_id=${projectId}`, {}, token);
    if (r.uploads) setUploads(r.uploads);
  };

  const upload = async (file: File) => {
    setUploading(true);
    setUploadProgress("Читаю файл...");
    try {
      // Читаем файл как base64
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1024) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 1024));
      }
      const file_b64 = btoa(binary);

      setUploadProgress("AI классифицирует и анализирует документ постранично...");

      const r = await apiFetch(`${AI_URL}?action=upload_doc`, {
        method: "POST",
        body: JSON.stringify({
          file_b64,
          file_name: file.name,
          project_id: projectId,
          spec_id: specId,
          page_by_page: true,
        }),
      }, token);

      setUploadProgress("");
      setUploading(false);
      await loadUploads();

      if (r.ok && r.upload_id) {
        const newDoc: UploadedDoc = {
          id: r.upload_id,
          file_name: file.name,
          file_url: r.file_url,
          status: r.status,
          doc_category: r.doc_category || "other",
          doc_category_label: r.doc_category_label || "Прочее",
          page_count: r.pages_count || null,
          created_at: new Date().toISOString(),
          by: "",
        };
        setActiveDoc(newDoc);
        if (r.pages?.length) {
          setPages(r.pages);
          setCurrentPage(1);
          // Выделяем все позиции по умолчанию
          const allKeys = new Set<string>();
          r.pages.forEach((p: PageData) => p.items.forEach((_: AiItem, i: number) => allKeys.add(`${p.page}_${i}`)));
          setSelectedItems(allKeys);
        }
      }
    } catch (e) {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const openDoc = async (doc: UploadedDoc) => {
    setActiveDoc(doc);
    setCurrentPage(1);
    setLoadingPages(true);
    const r = await apiFetch(`${AI_URL}?action=get&upload_id=${doc.id}`, {}, token);
    if (r.upload?.pages?.length) {
      setPages(r.upload.pages);
      const allKeys = new Set<string>();
      r.upload.pages.forEach((p: PageData) => p.items.forEach((_: AiItem, i: number) => allKeys.add(`${p.page}_${i}`)));
      setSelectedItems(allKeys);
    } else {
      setPages([]);
    }
    setLoadingPages(false);
  };

  const runPageAnalysis = async (doc: UploadedDoc) => {
    setAnalyzingPages(true);
    const r = await apiFetch(`${AI_URL}?action=analyze_pages`, {
      method: "POST",
      body: JSON.stringify({ upload_id: doc.id }),
    }, token);
    if (r.pages?.length) {
      setPages(r.pages);
      const allKeys = new Set<string>();
      r.pages.forEach((p: PageData) => p.items.forEach((_: AiItem, i: number) => allKeys.add(`${p.page}_${i}`)));
      setSelectedItems(allKeys);
    }
    setAnalyzingPages(false);
    await loadUploads();
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

  const allPageItems = pages.flatMap(p => p.items.map((item, i) => ({ ...item, pageNum: p.page, idx: i })));
  const totalSelected = selectedItems.size;

  const currentPageData = pages.find(p => p.page === currentPage);

  const byCategory = (cat: string) => uploads.filter(u => cat === "all" || u.doc_category === cat);
  const categoriesWithDocs = ["all", ...Array.from(new Set(uploads.map(u => u.doc_category || "other")))];

  if (activeDoc) {
    return (
      <div className="flex flex-col h-full" style={{ minHeight: 500 }}>
        {/* Заголовок документа */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => setActiveDoc(null)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="ArrowLeft" size={14} />
            Назад
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{DOC_CATEGORIES[activeDoc.doc_category]?.icon || "📎"}</span>
              <span className="font-medium text-white text-sm truncate">{activeDoc.file_name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                style={{ background: `${DOC_CATEGORIES[activeDoc.doc_category]?.color}20`, color: DOC_CATEGORIES[activeDoc.doc_category]?.color }}>
                {activeDoc.doc_category_label}
              </span>
            </div>
            {activeDoc.page_count && (
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                {activeDoc.page_count} страниц · {allPageItems.length} позиций найдено
              </div>
            )}
          </div>
          {pages.length === 0 && !loadingPages && (
            <button onClick={() => runPageAnalysis(activeDoc)} disabled={analyzingPages}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name={analyzingPages ? "Loader" : "Sparkles"} size={14} style={{ animation: analyzingPages ? "spin 1s linear infinite" : "none" }} />
              {analyzingPages ? "Анализирую..." : "Запустить анализ"}
            </button>
          )}
          {pages.length > 0 && totalSelected > 0 && (
            <button onClick={importSelected}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: "var(--neon-cyan)", color: "#000" }}>
              <Icon name="Download" size={14} />
              Импортировать {totalSelected}
            </button>
          )}
        </div>

        {loadingPages && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-orange-400 animate-spin mx-auto mb-3" />
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Загружаю данные...</div>
            </div>
          </div>
        )}

        {!loadingPages && pages.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <span className="text-4xl mb-3 block">📄</span>
              <div className="text-sm font-medium text-white mb-1">Документ ещё не проанализирован постранично</div>
              <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                Нажмите «Запустить анализ» чтобы AI постранично изучил документ
              </div>
            </div>
          </div>
        )}

        {pages.length > 0 && (
          <div className="flex gap-4 flex-1 overflow-hidden" style={{ minHeight: 400 }}>
            {/* Навигация по страницам */}
            <div className="flex-shrink-0 w-44 overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: "thin" }}>
              {pages.map(p => (
                <button key={p.page} onClick={() => setCurrentPage(p.page)}
                  className="w-full text-left p-2.5 rounded-xl transition-all"
                  style={{
                    background: currentPage === p.page ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${currentPage === p.page ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: currentPage === p.page ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)" }}>
                      Стр. {p.page}
                    </span>
                    {p.items_count > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)" }}>
                        {p.items_count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs leading-tight line-clamp-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {p.text_preview?.slice(0, 80) || "..."}
                  </div>
                </button>
              ))}
            </div>

            {/* Содержимое страницы */}
            <div className="flex-1 overflow-y-auto space-y-3" style={{ scrollbarWidth: "thin" }}>
              {currentPageData && (
                <>
                  {/* Превью текста страницы */}
                  <div className="p-3 rounded-xl text-xs leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="FileText" size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                      <span className="font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Страница {currentPageData.page} — текст</span>
                    </div>
                    <div className="font-mono">{currentPageData.text_preview}</div>
                  </div>

                  {/* Позиции на этой странице */}
                  {currentPageData.items.length > 0 ? (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="px-3 py-2 flex items-center justify-between" style={{ background: "rgba(0,255,136,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>
                          Найдено {currentPageData.items.length} позиций
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const keys = new Set(selectedItems);
                            currentPageData.items.forEach((_, i) => keys.add(`${currentPageData.page}_${i}`));
                            setSelectedItems(keys);
                          }} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Все</button>
                          <button onClick={() => {
                            const keys = new Set(selectedItems);
                            currentPageData.items.forEach((_, i) => keys.delete(`${currentPageData.page}_${i}`));
                            setSelectedItems(keys);
                          }} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Снять</button>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "rgba(20,26,40,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <th className="p-2 w-7"></th>
                            <th className="p-2 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Раздел</th>
                            <th className="p-2 text-left font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Наименование</th>
                            <th className="p-2 text-center w-14 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Ед.</th>
                            <th className="p-2 text-right w-14 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Кол.</th>
                            <th className="p-2 text-right w-20 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Цена</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPageData.items.map((item, i) => {
                            const key = `${currentPageData.page}_${i}`;
                            const isSelected = selectedItems.has(key);
                            return (
                              <tr key={i} onClick={() => toggleItem(currentPageData.page, i)}
                                className="cursor-pointer hover:bg-white/5"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSelected ? "rgba(0,212,255,0.04)" : "transparent" }}>
                                <td className="p-2 text-center">
                                  <div className="w-4 h-4 rounded flex items-center justify-center mx-auto"
                                    style={{ background: isSelected ? "var(--neon-cyan)" : "rgba(255,255,255,0.08)", border: isSelected ? "none" : "1px solid rgba(255,255,255,0.15)" }}>
                                    {isSelected && <Icon name="Check" size={9} style={{ color: "#000" }} />}
                                  </div>
                                </td>
                                <td className="p-2" style={{ color: "rgba(255,255,255,0.4)" }}>{item.section}</td>
                                <td className="p-2 text-white font-medium">{item.name}</td>
                                <td className="p-2 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                                <td className="p-2 text-right" style={{ color: "rgba(255,255,255,0.6)" }}>{item.qty || "—"}</td>
                                <td className="p-2 text-right font-semibold" style={{ color: item.price_per_unit ? "var(--neon-green)" : "rgba(255,255,255,0.25)" }}>
                                  {item.price_per_unit ? new Intl.NumberFormat("ru-RU").format(item.price_per_unit) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-6 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
                      <Icon name="Search" size={20} style={{ color: "rgba(255,255,255,0.2)", margin: "0 auto 8px" }} />
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>На этой странице позиции не обнаружены</div>
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

  return (
    <div>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--neon-orange)" }}>Проектная документация</div>
          <h3 className="font-semibold text-white">Загрузка и анализ документов</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            AI автоматически распределит по разделам и извлечёт позиции постранично
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
          <Icon name="Upload" size={16} />
          Загрузить
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
          onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>

      {/* Прогресс загрузки */}
      {uploading && (
        <div className="mb-4 p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.2)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,107,26,0.15)" }}>
            <Icon name="Loader" size={16} style={{ color: "var(--neon-orange)", animation: "spin 1s linear infinite" }} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{uploadProgress}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Не закрывайте страницу</div>
          </div>
        </div>
      )}

      {/* Разделы документации */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.entries(DOC_CATEGORIES).map(([key, cat]) => {
          const docs = uploads.filter(u => (u.doc_category || "other") === key);
          if (docs.length === 0) return null;
          return (
            <button key={key} onClick={() => setFilterCategory(filterCategory === key ? "all" : key)}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: filterCategory === key ? `${cat.color}15` : "rgba(255,255,255,0.04)",
                border: `1px solid ${filterCategory === key ? `${cat.color}40` : "rgba(255,255,255,0.07)"}`,
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-base">{cat.icon}</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${cat.color}20`, color: cat.color }}>{docs.length}</span>
              </div>
              <div className="text-xs font-medium text-white">{cat.label}</div>
            </button>
          );
        })}
      </div>

      {/* Фильтр по категориям */}
      {uploads.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {categoriesWithDocs.map(cat => {
            const info = cat === "all" ? { label: "Все", icon: "📂", color: "rgba(255,255,255,0.5)" } : DOC_CATEGORIES[cat];
            const count = cat === "all" ? uploads.length : uploads.filter(u => (u.doc_category || "other") === cat).length;
            return (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterCategory === cat ? (info?.color ? `${info.color}20` : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)",
                  color: filterCategory === cat ? (info?.color || "white") : "rgba(255,255,255,0.5)",
                  border: `1px solid ${filterCategory === cat ? (info?.color ? `${info.color}40` : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
                }}>
                {info?.icon && <span>{info.icon}</span>}
                {info?.label || cat} · {count}
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
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                onClick={() => openDoc(doc)}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{doc.file_name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${cat.color}15`, color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {doc.page_count && (
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {doc.page_count} стр.
                      </span>
                    )}
                    <span className="text-xs" style={{ color: doc.status === "done" ? "var(--neon-green)" : doc.status === "error" ? "#ef4444" : "rgba(255,255,255,0.3)" }}>
                      {doc.status === "done" ? "✓ Обработан" : doc.status === "error" ? "Ошибка" : doc.status === "processing" ? "Обрабатывается..." : "Ожидает"}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {new Date(doc.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)" }}>
                    Открыть →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center rounded-2xl" style={{ border: "2px dashed rgba(255,255,255,0.08)" }}>
          <div className="text-3xl mb-3">📂</div>
          <div className="text-sm font-medium text-white mb-1">Документы не загружены</div>
          <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Загрузите PDF, Excel или CSV — AI автоматически определит тип<br />и разберёт по позициям постранично
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {Object.values(DOC_CATEGORIES).slice(0, 5).map(cat => (
              <div key={cat.label} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}