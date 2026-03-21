import { useState, useEffect } from "react";
import { AI_URL, apiFetch, AiItem } from "@/pages/staff/materials-types";
import DocListPanel from "./DocListPanel";
import DocViewerShell from "./DocViewerShell";

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
        setTotalPages(r.is_scan ? 0 : (r.pages_count ? Number(r.pages_count) : 0));
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

  const deleteUpload = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить документ?")) return;
    await apiFetch(`${AI_URL}?action=delete_upload`, {
      method: "POST",
      body: JSON.stringify({ upload_id: id }),
    }, token);
    setUploads(prev => prev.filter(u => u.id !== id));
    if (activeDoc?.id === id) setActiveDoc(null);
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
    const pd = pages.find(x => x.page === page);
    if (!pd || !pd.analyzed) analyzePage(page);
  };

  const handleSelectAllOnPage = () => {
    const currentPageData = pages.find(p => p.page === currentPage);
    if (!currentPageData) return;
    const s = new Set(selectedItems);
    currentPageData.items.forEach((_, i) => s.add(`${currentPage}_${i}`));
    setSelectedItems(s);
  };

  const handleDeselectAllOnPage = () => {
    const currentPageData = pages.find(p => p.page === currentPage);
    if (!currentPageData) return;
    const s = new Set(selectedItems);
    currentPageData.items.forEach((_, i) => s.delete(`${currentPage}_${i}`));
    setSelectedItems(s);
  };

  const handleStartOcr = () => {
    setTotalPages(1);
    analyzePage(1);
  };

  // ── Просмотр документа ──────────────────────────────────────────────────
  if (activeDoc) {
    return (
      <DocViewerShell
        activeDoc={activeDoc}
        pages={pages}
        totalPages={totalPages}
        currentPage={currentPage}
        analyzingPage={analyzingPage}
        selectedItems={selectedItems}
        totalSelected={selectedItems.size}
        analyzedCount={pages.length}
        onBack={() => setActiveDoc(null)}
        onPageClick={handlePageClick}
        onAnalyzePage={analyzePage}
        onAnalyzeAll={analyzeAllPages}
        onImport={importSelected}
        onToggleItem={toggleItem}
        onSelectAllOnPage={handleSelectAllOnPage}
        onDeselectAllOnPage={handleDeselectAllOnPage}
        onStartOcr={handleStartOcr}
      />
    );
  }

  // ── Список документов ───────────────────────────────────────────────────
  return (
    <DocListPanel
      uploads={uploads}
      uploading={uploading}
      uploadProgress={uploadProgress}
      filterCategory={filterCategory}
      onFilterChange={setFilterCategory}
      onOpenDoc={openDoc}
      onDeleteDoc={deleteUpload}
      onUploadFile={upload}
    />
  );
}
