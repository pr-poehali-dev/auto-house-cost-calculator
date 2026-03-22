import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AI_URL, apiFetch, type AiItem } from "@/pages/staff/materials-types";

const NOTIFY_URL = "https://functions.poehali.dev/e936bb42-3c4d-4c99-88d7-6d976ca7cb7c";

export const DOC_CATEGORIES: Record<string, { label: string; icon: string; color: string; group: string }> = {
  explanatory_note:  { label: "Пояснительная записка (ПЗ)", icon: "📝", color: "#A855F7", group: "text" },
  construction_org:  { label: "Проект организации строительства (ПОС)", icon: "🏗️", color: "#6366F1", group: "text" },
  demolition_org:    { label: "Проект организации сноса (ПОД)", icon: "🔨", color: "#8B5CF6", group: "text" },
  environment:       { label: "Охрана окружающей среды", icon: "🌿", color: "#10B981", group: "text" },
  fire_safety:       { label: "Пожарная безопасность", icon: "🔥", color: "#EF4444", group: "text" },
  accessibility:     { label: "Доступность МГН", icon: "♿", color: "#F59E0B", group: "text" },
  energy_efficiency: { label: "Энергоэффективность", icon: "⚡", color: "#FBBF24", group: "text" },
  smeta:             { label: "Сводный сметный расчёт", icon: "💼", color: "#F97316", group: "text" },
  scheme_layout:     { label: "СПОЗУ", icon: "🗺️", color: "#0EA5E9", group: "graphic" },
  architecture:      { label: "Архитектурные решения (АР)", icon: "🏛️", color: "#06B6D4", group: "graphic" },
  construction:      { label: "Конструктивные решения (КР/КЖ/КМ)", icon: "⚙️", color: "#3B82F6", group: "graphic" },
  engineering:       { label: "Инженерные системы (ИОС)", icon: "🔧", color: "#2563EB", group: "graphic" },
  drawing:           { label: "Чертёж / схема", icon: "📐", color: "#FF6B1A", group: "graphic" },
  specification:     { label: "Спецификация материалов", icon: "📋", color: "#00D4FF", group: "analytic" },
  work_statement:    { label: "Ведомость объёмов работ (ВОР)", icon: "📊", color: "#00FF88", group: "analytic" },
  estimate:          { label: "Смета / расчёт стоимости", icon: "💰", color: "#FBBF24", group: "analytic" },
  other:             { label: "Прочее", icon: "📎", color: "rgba(255,255,255,0.4)", group: "other" },
};

const FORMAT_ACCEPT = "image/*,.pdf,.dwg,.dxf,.xlsx,.xls,.csv,.ifc,.zip,.rar";

const CHUNK_SIZE = 400 * 1024;

interface PageData {
  page: number;
  text_preview: string;
  text?: string;
  items: AiItem[];
  items_count: number;
  analyzed?: boolean;
  needs_ocr?: boolean;
}

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

interface VorRow {
  id: string;
  section: string;
  name: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  note: string;
  source_doc?: string;
}

type PipelineStep = "idle" | "uploading" | "analyzing" | "vor" | "supply" | "estimate";

interface DocUploadManagerProps {
  token: string;
  projectId?: number;
  projectName?: string;
  onImport: (items: AiItem[], category: string) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export default function DocUploadManager({ token, projectId, projectName = "Проект", onImport }: DocUploadManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  // Документы
  const [uploads, setUploads] = useState<UploadedDoc[]>([]);
  const [activeDoc, setActiveDoc] = useState<UploadedDoc | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Pipeline
  const [step, setStep] = useState<PipelineStep>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [analyzingPage, setAnalyzingPage] = useState<number | null>(null);
  const [analyzeLog, setAnalyzeLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // ВОР
  const [vor, setVor] = useState<VorRow[]>([]);
  const [vorSections, setVorSections] = useState<string[]>([]);
  const [vorFilter, setVorFilter] = useState("all");
  const [editingVor, setEditingVor] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<VorRow>>({});

  // Снабжение и смета
  const [supplyMsg, setSupplyMsg] = useState("");
  const [supplySent, setSupplySent] = useState(false);
  const [estimateRows, setEstimateRows] = useState<(VorRow & { total: number })[]>([]);
  const [estimateTotal, setEstimateTotal] = useState(0);

  useEffect(() => { loadUploads(); }, [projectId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [analyzeLog]);

  const log = (msg: string) => setAnalyzeLog(prev => [...prev, msg]);

  const loadUploads = async () => {
    if (!projectId) return;
    const r = await apiFetch(`${AI_URL}?action=list&project_id=${projectId}`, {}, token);
    if (r.uploads) setUploads(r.uploads);
  };

  // ── Загрузка файла ────────────────────────────────────────────────────────
  const uploadFile = async (file: File) => {
    setStep("uploading");
    setUploadPct(0);
    setAnalyzeLog([`📄 Загружаю файл «${file.name}» (${(file.size / 1024 / 1024).toFixed(1)} МБ)...`]);
    setVor([]);
    setActiveDoc(null);
    setPages([]);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isBim = ["ifc", "dwg", "dxf"].includes(ext);

    if (isBim) {
      log(`🏗️ Определён формат BIM/CAD (${ext.toUpperCase()}) — передаю на специализированный парсер...`);
    }

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
        setUploadPct(pct);

        const r = await apiFetch(`${AI_URL}?action=upload_doc_chunk`, {
          method: "POST",
          body: JSON.stringify({
            chunk: chunk_b64, chunk_index: i, total_chunks: totalChunks,
            upload_id: uploadSessId, file_name: file.name, project_id: projectId,
          }),
        }, token);

        if (!r.ok) { log("❌ Ошибка загрузки файла"); setStep("idle"); return; }
        if (r.upload_id && !uploadSessId) uploadSessId = String(r.upload_id);
        if (!r.done) continue;

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

        const pagesCount = r.is_scan ? 0 : (r.pages_count ? Number(r.pages_count) : 0);
        setActiveDoc(newDoc);
        setTotalPages(pagesCount);
        setCurrentPage(1);
        await loadUploads();

        const catLabel = DOC_CATEGORIES[r.doc_category]?.label || "Прочее";
        log(`✅ Файл загружен. Раздел: ${catLabel}`);

        if (r.is_scan) {
          log("🔍 PDF-скан обнаружен — запускаю OCR-распознавание...");
          setStep("analyzing");
          await runOcr(newDoc);
        } else if (pagesCount > 0) {
          log(`📑 Найдено ${pagesCount} стр. — начинаю AI-анализ постранично...`);
          setStep("analyzing");
          await analyzeAllPages(newDoc, pagesCount);
        } else if (isBim) {
          log(`🏗️ Обрабатываю BIM-файл...`);
          setStep("analyzing");
          await analyzePage(newDoc, 1);
        } else {
          log("⚠️ Файл загружен, но страниц не найдено.");
          setStep("vor");
        }
        return;
      }
    } catch (e) {
      log("❌ Ошибка: " + String(e));
      setStep("idle");
    }
  };

  // ── Анализ одной страницы ─────────────────────────────────────────────────
  const analyzePage = async (doc: UploadedDoc, pageNum: number): Promise<PageData | null> => {
    setAnalyzingPage(pageNum);
    try {
      const r = await apiFetch(`${AI_URL}?action=analyze_page`, {
        method: "POST",
        body: JSON.stringify({ upload_id: doc.id, page: pageNum }),
      }, token);
      if (r.ok) {
        const pageData: PageData = {
          page: pageNum,
          text_preview: r.text_preview || "",
          items: r.items || [],
          items_count: r.items_count || 0,
          analyzed: true,
        };
        setPages(prev => {
          const filtered = prev.filter(p => p.page !== pageNum);
          return [...filtered, pageData].sort((a, b) => a.page - b.page);
        });
        if (r.items_count > 0) {
          log(`  Стр. ${pageNum}: найдено ${r.items_count} позиций`);
        }
        return pageData;
      }
    } catch (e) {
      log(`  Стр. ${pageNum}: ошибка анализа`);
    }
    setAnalyzingPage(null);
    return null;
  };

  // ── Анализ всех страниц ───────────────────────────────────────────────────
  const analyzeAllPages = async (doc: UploadedDoc, total: number) => {
    const allItems: AiItem[] = [];
    for (let p = 1; p <= total; p++) {
      const pd = await analyzePage(doc, p);
      if (pd?.items) allItems.push(...pd.items);
    }
    setAnalyzingPage(null);

    await apiFetch(`${AI_URL}?action=finish_analysis`, {
      method: "POST",
      body: JSON.stringify({ upload_id: doc.id }),
    }, token);

    await loadUploads();
    log(`✅ Анализ завершён. Всего позиций: ${allItems.length}`);
    buildVor(allItems, doc.file_name);
  };

  // ── OCR для скан-документов ───────────────────────────────────────────────
  const runOcr = async (doc: UploadedDoc) => {
    const pd = await analyzePage(doc, 1);
    setAnalyzingPage(null);
    const items = pd?.items || [];
    await loadUploads();
    log(`✅ OCR завершён. Найдено позиций: ${items.length}`);
    buildVor(items, doc.file_name);
  };

  // ── Формирование ВОР ─────────────────────────────────────────────────────
  const buildVor = (items: AiItem[], sourceName: string) => {
    log(`📊 Формирую сводную ВОР...`);
    const rows: VorRow[] = items.map((it, i) => ({
      id: `vor_${i}`,
      section: it.section || "Прочее",
      name: it.name,
      unit: it.unit,
      qty: it.qty || 0,
      price_per_unit: it.price_per_unit || 0,
      note: it.note || "",
      source_doc: sourceName,
    }));
    const sects = [...new Set(rows.map(r => r.section))];
    setVor(rows);
    setVorSections(sects);
    setVorFilter("all");
    log(`✅ ВОР сформирована: ${rows.length} позиций, ${sects.length} разделов`);
    setStep("vor");
  };

  // ── Сохранение ВОР в систему ──────────────────────────────────────────────
  const saveVorToProject = async () => {
    if (!projectId || vor.length === 0) return;
    onImport(vor.map(r => ({
      section: r.section, name: r.name, unit: r.unit,
      qty: r.qty, price_per_unit: r.price_per_unit, note: r.note,
    })), "work_statement");
    log(`✅ ВОР сохранена в проект (${vor.length} позиций)`);
  };

  // ── Отправка в снабжение ──────────────────────────────────────────────────
  const sendToSupply = async () => {
    if (vor.length === 0) return;
    setSupplyMsg("Отправляю...");
    log("📬 Отправляю уведомления в снабжение...");
    try {
      const r = await apiFetch(`${NOTIFY_URL}?action=send_vor_notification`, {
        method: "POST",
        body: JSON.stringify({
          project_name: projectName,
          vor_count: vor.length,
          vor_sections: vorSections,
          doc_name: activeDoc?.file_name || "",
        }),
      }, token);

      setSupplyMsg("");
      setSupplySent(true);
      setStep("supply");

      if (r.ok) {
        const res = r.results || {};
        if (res.bitrix_tasks?.length) log(`✅ Задача в Битрикс24 создана (ID: ${res.bitrix_tasks[0]})`);
        if (res.bitrix_failed?.length) log(`⚠️ Битрикс: ${res.bitrix_failed[0]}`);
        if (res.max_sent?.length) log(`💬 Max уведомление отправлено: ${res.max_sent.join(", ")}`);
        if (!res.bitrix_tasks?.length && !res.max_sent?.length) {
          log("ℹ️ Укажите Битрикс24 ID сотрудников в разделе «Администрирование → Уведомления»");
        }
      } else {
        log(`⚠️ ${r.error || "Ошибка отправки уведомлений"}`);
      }
    } catch (e) {
      setSupplyMsg("");
      setSupplySent(true);
      setStep("supply");
      log("⚠️ Ошибка отправки уведомлений: " + String(e));
    }
  };

  // ── Формирование сметы (после получения цен) ──────────────────────────────
  const buildEstimate = () => {
    const rows = vor.map(r => ({ ...r, total: r.qty * r.price_per_unit }));
    const total = rows.reduce((s, r) => s + r.total, 0);
    setEstimateRows(rows);
    setEstimateTotal(total);
    log(`💰 Смета сформирована автоматически. Итого: ${fmt(total)} ₽`);
    setStep("estimate");
  };

  // ── Открыть существующий документ ────────────────────────────────────────
  const openDoc = async (doc: UploadedDoc) => {
    setActiveDoc(doc);
    setCurrentPage(1);
    setPages([]);
    setVor([]);
    setAnalyzeLog([`📂 Открываю «${doc.file_name}»...`]);
    setTotalPages(doc.page_count || 0);
    const r = await apiFetch(`${AI_URL}?action=get&upload_id=${doc.id}`, {}, token);
    if (r.upload?.pages?.length) {
      setPages(r.upload.pages);
      setTotalPages(r.upload.pages.length);
      const allItems: AiItem[] = [];
      r.upload.pages.forEach((p: PageData) => { if (p.items?.length) allItems.push(...p.items); });
      if (allItems.length > 0) {
        buildVor(allItems, doc.file_name);
      } else {
        setStep("analyzing");
        log("Документ загружен, но позиции не найдены. Запустите повторный анализ.");
      }
    } else {
      setStep("idle");
      log("Данные документа не найдены");
    }
  };

  const deleteDoc = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить документ?")) return;
    await apiFetch(`${AI_URL}?action=delete_upload`, { method: "POST", body: JSON.stringify({ upload_id: id }) }, token);
    await loadUploads();
    if (activeDoc?.id === id) { setActiveDoc(null); setStep("idle"); }
  };

  const currentPageData = pages.find(p => p.page === currentPage);
  const analyzedCount = pages.filter(p => p.analyzed).length;
  const vorFiltered = vorFilter === "all" ? vor : vor.filter(r => r.section === vorFilter);
  const vorTotal = vor.reduce((s, r) => s + r.qty * r.price_per_unit, 0);

  // ── ШАПКА PIPELINE ────────────────────────────────────────────────────────
  const STEPS = [
    { id: "uploading", label: "Загрузка", icon: "Upload" },
    { id: "analyzing", label: "AI-анализ", icon: "Sparkles" },
    { id: "vor",       label: "ВОР",      icon: "ClipboardList" },
    { id: "supply",    label: "Снабжение", icon: "Send" },
    { id: "estimate",  label: "Смета",    icon: "Calculator" },
  ] as const;

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="flex flex-col gap-0" style={{ minHeight: 600 }}>

      {/* ── Верхняя панель: заголовок + pipeline ── */}
      <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-5 py-4 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(255,107,26,0.08), rgba(0,212,255,0.06))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,107,26,0.15)" }}>
            <Icon name="FolderOpen" size={20} style={{ color: "var(--neon-orange)" }} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-white text-sm">5. Проектная документация</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              PDF, Excel, IFC, DWG/DXF — AI разберёт, сформирует ВОР и смету
            </div>
          </div>

          {/* Кнопка загрузки */}
          <input ref={fileRef} type="file" accept={FORMAT_ACCEPT} className="hidden"
            onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={step === "uploading" || step === "analyzing"}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
            <Icon name="Plus" size={15} />
            Загрузить файл
          </button>
        </div>

        {/* Pipeline шаги */}
        {step !== "idle" && (
          <div className="px-5 py-3 flex items-center gap-1">
            {STEPS.map((s, i) => {
              const done = stepIndex > i;
              const active = stepIndex === i;
              return (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: done ? "rgba(0,255,136,0.2)" : active ? "rgba(255,107,26,0.2)" : "rgba(255,255,255,0.06)",
                        color: done ? "#00FF88" : active ? "var(--neon-orange)" : "rgba(255,255,255,0.25)",
                        border: active ? "1px solid rgba(255,107,26,0.4)" : "none",
                      }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className="text-xs hidden sm:block"
                      style={{ color: done ? "#00FF88" : active ? "var(--neon-orange)" : "rgba(255,255,255,0.25)" }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-1"
                      style={{ background: done ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.07)" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Прогресс загрузки */}
        {step === "uploading" && (
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Загружаю...</span>
              <span className="text-xs font-mono" style={{ color: "var(--neon-orange)" }}>{uploadPct}%</span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: "var(--neon-orange)" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Основное содержимое: сплит ── */}
      <div className="flex gap-4" style={{ flex: 1 }}>

        {/* ── ЛЕВАЯ КОЛОНКА: документы + страницы ── */}
        <div className="flex flex-col gap-3" style={{ width: 260, flexShrink: 0 }}>

          {/* Список загруженных документов */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-3 py-2.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                Файлы проекта
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{uploads.length}</span>
            </div>
            {uploads.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <div className="text-2xl mb-2">📁</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Файлов нет — загрузите проект</div>
              </div>
            ) : (
              <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.04)", maxHeight: 280, overflowY: "auto" }}>
                {uploads.map(doc => {
                  const cat = DOC_CATEGORIES[doc.doc_category] || DOC_CATEGORIES.other;
                  const isActive = activeDoc?.id === doc.id;
                  return (
                    <div key={doc.id}
                      onClick={() => openDoc(doc)}
                      className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-all hover:bg-white/5"
                      style={{ background: isActive ? "rgba(255,107,26,0.08)" : "transparent" }}>
                      <span className="text-base flex-shrink-0 mt-0.5">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{doc.file_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs" style={{ color: cat.color, fontSize: 10 }}>{cat.label}</span>
                          {doc.page_count && (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                              · {doc.page_count} стр.
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={(e) => deleteDoc(doc.id, e)}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 flex-shrink-0 opacity-0 group-hover:opacity-100"
                        style={{ color: "rgba(255,100,100,0.5)" }}>
                        <Icon name="Trash2" size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Список страниц активного документа */}
          {activeDoc && totalPages > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.07)", flex: 1 }}>
              <div className="px-3 py-2.5 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Страницы
                </span>
                <div className="flex items-center gap-1.5">
                  {step === "analyzing" && analyzingPage && (
                    <Icon name="Loader" size={10} className="animate-spin" style={{ color: "var(--neon-orange)" }} />
                  )}
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {analyzedCount}/{totalPages}
                  </span>
                </div>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const pd = pages.find(x => x.page === p);
                  const isAnalyzing = analyzingPage === p;
                  const isActive = currentPage === p;
                  return (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 transition-all hover:bg-white/5"
                      style={{ background: isActive ? "rgba(0,212,255,0.08)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div className="w-8 text-xs font-mono text-center flex-shrink-0"
                        style={{ color: isActive ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                        {p}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isAnalyzing ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full border border-orange-400 border-t-transparent animate-spin" />
                            <span className="text-xs" style={{ color: "var(--neon-orange)" }}>Анализирую...</span>
                          </div>
                        ) : pd ? (
                          <div className="text-xs truncate" style={{ color: pd.items_count > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>
                            {pd.text_preview?.slice(0, 35) || "—"}
                          </div>
                        ) : (
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Не проанализирована</div>
                        )}
                      </div>
                      {pd && (
                        <div className="flex-shrink-0 text-xs font-bold px-1 rounded"
                          style={{
                            background: pd.items_count > 0 ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.05)",
                            color: pd.items_count > 0 ? "var(--neon-green)" : "rgba(255,255,255,0.2)",
                          }}>
                          {pd.items_count || "—"}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Форматы */}
          <div className="rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Поддерживаемые форматы:</div>
            <div className="flex flex-wrap gap-1">
              {["PDF", "Excel", "CSV", "IFC", "DWG", "DXF"].map(f => (
                <span key={f} className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── ПРАВАЯ КОЛОНКА: AI-лог + результаты ── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Лог AI */}
          {(step !== "idle" || analyzeLog.length > 0) && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,107,26,0.15)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,107,26,0.06)" }}>
                <Icon name="Sparkles" size={13} style={{ color: "var(--neon-orange)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--neon-orange)" }}>AI-лог обработки</span>
                {(step === "uploading" || step === "analyzing") && (
                  <div className="ml-auto w-4 h-4 rounded-full border-2 border-white/10 animate-spin" style={{ borderTopColor: "var(--neon-orange)" }} />
                )}
              </div>
              <div ref={logRef} className="px-4 py-3 space-y-1 font-mono" style={{ maxHeight: 160, overflowY: "auto" }}>
                {analyzeLog.map((line, i) => (
                  <div key={i} className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {line}
                  </div>
                ))}
                {(step === "uploading" || step === "analyzing") && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--neon-orange)" }} />
                    {step === "uploading" ? `Загружаю... ${uploadPct}%` : `Анализирую стр. ${analyzingPage || "..."}...`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Текст текущей страницы */}
          {currentPageData && (step === "analyzing" || step === "vor" || step === "supply" || step === "estimate") && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <span className="text-xs font-semibold text-white">Страница {currentPage}</span>
                <div className="flex items-center gap-2">
                  {currentPageData.items_count > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)" }}>
                      {currentPageData.items_count} позиций
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {DOC_CATEGORIES[activeDoc?.doc_category || "other"]?.label}
                  </span>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs leading-relaxed whitespace-pre-line mb-3"
                  style={{ color: "rgba(255,255,255,0.5)", maxHeight: 80, overflowY: "auto" }}>
                  {currentPageData.text_preview || "Текст не найден"}
                </div>
                {currentPageData.items.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Извлечённые позиции:
                    </div>
                    {currentPageData.items.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg"
                        style={{ background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.1)" }}>
                        <span className="font-medium text-white truncate flex-1">{item.name}</span>
                        <span style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>{item.qty} {item.unit}</span>
                        {item.price_per_unit > 0 && (
                          <span style={{ color: "#FBBF24", flexShrink: 0 }}>{fmt(item.price_per_unit)} ₽</span>
                        )}
                      </div>
                    ))}
                    {currentPageData.items.length > 5 && (
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        + ещё {currentPageData.items.length - 5} позиций
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ВОР ── */}
          {(step === "vor" || step === "supply" || step === "estimate") && vor.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,255,136,0.04)" }}>
                <div className="flex items-center gap-2">
                  <Icon name="ClipboardList" size={15} style={{ color: "var(--neon-green)" }} />
                  <span className="text-sm font-bold text-white">Сводная ВОР</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)" }}>
                    {vor.length} позиций
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {vorTotal > 0 && (
                    <span className="font-mono font-bold text-sm" style={{ color: "#FBBF24" }}>
                      {fmt(vorTotal)} ₽
                    </span>
                  )}
                  <button onClick={saveVorToProject}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
                    <Icon name="Save" size={12} />
                    Сохранить в проект
                  </button>
                </div>
              </div>

              {/* Фильтр по разделам */}
              <div className="px-4 py-2 flex gap-1.5 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={() => setVorFilter("all")}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-all"
                  style={{
                    background: vorFilter === "all" ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
                    color: vorFilter === "all" ? "var(--neon-green)" : "rgba(255,255,255,0.4)",
                  }}>
                  Все ({vor.length})
                </button>
                {vorSections.map(sec => (
                  <button key={sec} onClick={() => setVorFilter(sec)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 transition-all whitespace-nowrap"
                    style={{
                      background: vorFilter === sec ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)",
                      color: vorFilter === sec ? "var(--neon-cyan)" : "rgba(255,255,255,0.4)",
                    }}>
                    {sec} ({vor.filter(r => r.section === sec).length})
                  </button>
                ))}
              </div>

              {/* Таблица ВОР */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", position: "sticky", top: 0 }}>
                      {["Раздел", "Наименование", "Ед.", "Кол-во", "Цена/ед.", "Примечание", ""].map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold"
                          style={{ color: "rgba(255,255,255,0.3)", background: "var(--card-bg)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vorFiltered.map(row => (
                      <tr key={row.id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        {editingVor === row.id ? (
                          <>
                            <td className="px-2 py-1.5">
                              <input className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.section}
                                onChange={e => setEditBuf(b => ({ ...b, section: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.name}
                                onChange={e => setEditBuf(b => ({ ...b, name: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5 w-14">
                              <input className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.unit}
                                onChange={e => setEditBuf(b => ({ ...b, unit: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5 w-16">
                              <input type="number" className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.qty}
                                onChange={e => setEditBuf(b => ({ ...b, qty: +e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5 w-24">
                              <input type="number" className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.price_per_unit}
                                onChange={e => setEditBuf(b => ({ ...b, price_per_unit: +e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input className="w-full px-1.5 py-1 rounded text-xs text-white bg-white/10 outline-none"
                                defaultValue={row.note}
                                onChange={e => setEditBuf(b => ({ ...b, note: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1">
                                <button onClick={() => {
                                  setVor(prev => prev.map(r => r.id === row.id ? { ...r, ...editBuf } : r));
                                  setEditingVor(null); setEditBuf({});
                                }} className="px-2 py-1 rounded text-xs font-bold"
                                  style={{ background: "var(--neon-green)", color: "#000" }}>✓</button>
                                <button onClick={() => { setEditingVor(null); setEditBuf({}); }}
                                  className="px-2 py-1 rounded text-xs"
                                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">
                              <span className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(0,212,255,0.08)", color: "rgba(0,212,255,0.8)" }}>
                                {row.section}
                              </span>
                            </td>
                            <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.85)", maxWidth: 220 }}>
                              <div className="truncate">{row.name}</div>
                              {row.note && (
                                <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                                  {row.note}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{row.unit}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>{row.qty}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: row.price_per_unit > 0 ? "#FBBF24" : "rgba(255,255,255,0.25)" }}>
                              {row.price_per_unit > 0 ? fmt(row.price_per_unit) : "—"}
                            </td>
                            <td className="px-3 py-2 max-w-xs">
                              <div className="truncate text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{row.note}</div>
                            </td>
                            <td className="px-2 py-2">
                              <button onClick={() => { setEditingVor(row.id); setEditBuf({}); }}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                                style={{ color: "rgba(255,255,255,0.3)" }}>
                                <Icon name="Pencil" size={11} />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Кнопки действий ВОР */}
              {step === "vor" && (
                <div className="px-4 py-3 flex items-center gap-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Проверьте ВОР — материалы и марки взяты из проекта без изменений
                  </div>
                  <button onClick={sendToSupply} disabled={supplySent}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ml-auto transition-all hover:scale-105 disabled:opacity-60"
                    style={{ background: "rgba(0,212,255,0.15)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.3)" }}>
                    <Icon name="Send" size={14} />
                    {supplyMsg || "Отправить в снабжение →"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Снабжение ── */}
          {(step === "supply" || step === "estimate") && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(0,212,255,0.12)" }}>
                  <Icon name="Send" size={16} style={{ color: "var(--neon-cyan)" }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white">Запрос в снабжение</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    ВОР отправлена · {vor.length} позиций · Ожидаем ответ поставщиков
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
                  <Icon name="CheckCircle" size={13} style={{ color: "var(--neon-green)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>Отправлено</span>
                </div>
              </div>

              {step === "supply" && (
                <div className="px-4 pb-4 flex items-center gap-3">
                  <div className="flex-1 text-xs rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px dashed rgba(255,255,255,0.1)" }}>
                    После получения цен от поставщиков нажмите «Сформировать смету» — она составится автоматически
                  </div>
                  <button onClick={buildEstimate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
                    <Icon name="Calculator" size={14} />
                    Сформировать смету
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Смета ── */}
          {step === "estimate" && estimateRows.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(251,191,36,0.04)" }}>
                <div className="flex items-center gap-2">
                  <Icon name="Calculator" size={15} style={{ color: "#FBBF24" }} />
                  <span className="text-sm font-bold text-white">Смета</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>
                    {estimateRows.length} позиций
                  </span>
                </div>
                <div className="font-mono font-bold text-lg" style={{ color: "#FBBF24" }}>
                  Итого: {fmt(estimateTotal)} ₽
                </div>
              </div>

              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                      {["Раздел", "Наименование", "Ед.", "Кол-во", "Цена/ед.", "Сумма"].map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold"
                          style={{ color: "rgba(255,255,255,0.3)", position: "sticky", top: 0, background: "var(--card-bg)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vorSections.map(sec => {
                      const secRows = estimateRows.filter(r => r.section === sec);
                      const secTotal = secRows.reduce((s, r) => s + r.total, 0);
                      return [
                        <tr key={`sec_${sec}`} style={{ background: "rgba(255,255,255,0.025)" }}>
                          <td colSpan={5} className="px-3 py-1.5 font-bold text-xs uppercase tracking-wider"
                            style={{ color: "rgba(0,212,255,0.8)" }}>
                            {sec}
                          </td>
                          <td className="px-3 py-1.5 text-right font-bold font-mono"
                            style={{ color: "#FBBF24" }}>
                            {fmt(secTotal)} ₽
                          </td>
                        </tr>,
                        ...secRows.map((row, i) => (
                          <tr key={`row_${sec}_${i}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td className="px-3 py-2 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>—</td>
                            <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.8)", maxWidth: 240 }}>
                              <div className="truncate">{row.name}</div>
                              {row.note && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{row.note}</div>}
                            </td>
                            <td className="px-3 py-2 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{row.unit}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>{row.qty}</td>
                            <td className="px-3 py-2 text-right font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                              {row.price_per_unit > 0 ? fmt(row.price_per_unit) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold"
                              style={{ color: row.total > 0 ? "var(--neon-green)" : "rgba(255,255,255,0.25)" }}>
                              {row.total > 0 ? fmt(row.total) : "—"}
                            </td>
                          </tr>
                        ))
                      ];
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.04)" }}>
                      <td colSpan={5} className="px-3 py-3 font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
                        ИТОГО ПО СМЕТЕ
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-base" style={{ color: "#FBBF24" }}>
                        {fmt(estimateTotal)} ₽
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-4 py-3 flex items-center gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Смета сформирована автоматически по ВОР и ценам поставщиков
                </div>
                <button onClick={saveVorToProject}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <Icon name="Save" size={14} />
                  Сохранить смету в проект
                </button>
              </div>
            </div>
          )}

          {/* Состояние idle — подсказка */}
          {step === "idle" && uploads.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center rounded-2xl"
              style={{ background: "var(--card-bg)", border: "2px dashed rgba(255,255,255,0.07)" }}>
              <div className="text-5xl mb-4">📐</div>
              <div className="font-bold text-white text-lg mb-2">Загрузите проект</div>
              <div className="text-sm max-w-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                AI постранично разберёт PDF, сформирует ВОР, отправит в снабжение и автоматически составит смету
              </div>
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {[
                  { icon: "📄", label: "Пояснительная записка" },
                  { icon: "📊", label: "Ведомость объёмов работ" },
                  { icon: "📋", label: "Спецификация материалов" },
                  { icon: "🏗️", label: "BIM / IFC / DWG" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span>{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
                <Icon name="Upload" size={16} />
                Выбрать файл
              </button>
            </div>
          )}

          {step === "idle" && uploads.length > 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center rounded-2xl"
              style={{ background: "var(--card-bg)", border: "1px dashed rgba(255,255,255,0.07)" }}>
              <Icon name="FolderOpen" size={32} style={{ color: "rgba(255,255,255,0.2)", marginBottom: 12 }} />
              <div className="text-sm mb-1 text-white">Выберите документ слева</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>или загрузите новый файл</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}