import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";

const FILE_TYPES = [
  { id: "render", label: "Рендер", icon: "🎨", accept: "image/*" },
  { id: "plan", label: "План", icon: "📐", accept: "image/*,application/pdf" },
  { id: "facade", label: "Фасад", icon: "🏛️", accept: "image/*,application/pdf" },
  { id: "section", label: "Разрез", icon: "✂️", accept: "image/*,application/pdf" },
  { id: "other", label: "Прочее", icon: "📎", accept: "*" },
];

const DEFAULT_SECTIONS = [
  "Земляные работы", "Фундамент", "Стены и перекрытия", "Кровля",
  "Окна и двери", "Утепление и фасад", "Черновые полы", "Чистовые полы",
  "Отделка стен и потолков", "Электрика", "Сантехника",
];

interface ProjectFile { id: number; file_type: string; file_url: string; file_name: string; sort_order: number; }
interface SpecItem { id: number; section: string; name: string; unit: string; qty: number; price_per_unit: number; total_price: number; note: string; sort_order: number; }
interface Spec { id: number; title: string; version: number; status: string; items: SpecItem[]; created_at: string; updated_at: string; }
interface Project { id: number; name: string; type: string; area: number; floors: number; rooms: number; price: number; files?: ProjectFile[]; specs?: { id: number; title: string; version: number; status: string }[]; }
interface HistoryEntry { id: number; field: string; old: string; new: string; at: string; by: string; item: string; }

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }

function authFetch(url: string, opts: RequestInit = {}, token: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Auth-Token": token, ...(opts.headers || {}) },
  }).then(r => r.json());
}

// ─── Галерея файлов ────────────────────────────────────────────────────────────
function FileGallery({ project, token, canEdit }: { project: Project; token: string; canEdit: boolean }) {
  const [files, setFiles] = useState<ProjectFile[]>(project.files || []);
  const [activeType, setActiveType] = useState("render");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${PROJECTS_URL}?action=get`, { method: "POST", body: JSON.stringify({ project_id: project.id }) }, token);
    if (res.project?.files) setFiles(res.project.files);
  }, [project.id, token]);

  const uploadFile = async (file: File, ftype: string) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      const res = await authFetch(`${PROJECTS_URL}?action=upload_file`, {
        method: "POST",
        body: JSON.stringify({ project_id: project.id, file_data: b64, file_name: file.name, file_type: ftype }),
      }, token);
      setUploading(false);
      if (res.ok) load();
    };
    reader.readAsDataURL(file);
  };

  const deleteFile = async (fid: number) => {
    if (!confirm("Удалить файл?")) return;
    await authFetch(`${PROJECTS_URL}?action=delete_file`, { method: "POST", body: JSON.stringify({ file_id: fid }) }, token);
    load();
  };

  const byType = (t: string) => files.filter(f => f.file_type === t);

  return (
    <div>
      {/* Type tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {FILE_TYPES.map(t => {
          const count = byType(t.id).length;
          return (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: activeType === t.id ? "var(--neon-cyan)" : "rgba(255,255,255,0.06)",
                color: activeType === t.id ? "#000" : "rgba(255,255,255,0.6)",
                border: activeType === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span>{t.icon}</span>{t.label}
              {count > 0 && (
                <span className="ml-0.5 font-bold px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: activeType === t.id ? "rgba(0,0,0,0.2)" : "rgba(0,212,255,0.2)", color: activeType === t.id ? "#000" : "var(--neon-cyan)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Upload zone */}
      {canEdit && (
        <div
          className="border-2 border-dashed rounded-2xl p-6 text-center mb-4 cursor-pointer transition-all hover:bg-white/5"
          style={{ borderColor: uploading ? "var(--neon-cyan)" : "rgba(255,255,255,0.1)" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, activeType)); }}>
          <input ref={fileInputRef} type="file" className="hidden" multiple
            accept={FILE_TYPES.find(t => t.id === activeType)?.accept}
            onChange={e => Array.from(e.target.files || []).forEach(f => uploadFile(f, activeType))} />
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: "var(--neon-cyan)" }} />
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Загрузка...</span>
            </div>
          ) : (
            <>
              <Icon name="Upload" size={20} style={{ color: "rgba(255,255,255,0.3)", margin: "0 auto 8px" }} />
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Перетащите файлы или нажмите для загрузки
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                {FILE_TYPES.find(t => t.id === activeType)?.label} · до 4 файлов рекомендуется
              </div>
            </>
          )}
        </div>
      )}

      {/* Files grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {byType(activeType).map(f => {
          const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.file_url);
          return (
            <div key={f.id} className="relative rounded-xl overflow-hidden group"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", aspectRatio: "4/3" }}>
              {isImg ? (
                <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightbox(f.file_url)} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => window.open(f.file_url, "_blank")}>
                  <Icon name="FileText" size={28} style={{ color: "var(--neon-cyan)" }} />
                  <div className="text-xs mt-2 px-2 text-center truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {f.file_name}
                  </div>
                </div>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                <span className="text-xs text-white truncate">{f.file_name}</span>
                {canEdit && (
                  <button onClick={() => deleteFile(f.id)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.8)" }}>
                    <Icon name="X" size={11} style={{ color: "#fff" }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {byType(activeType).length === 0 && !canEdit && (
          <div className="col-span-4 text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
            Файлы этого типа не загружены
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
            <Icon name="X" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Редактор ведомости ────────────────────────────────────────────────────────
function SpecEditor({ project, token, role }: { project: Project; token: string; role: string }) {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [newItemSection, setNewItemSection] = useState(DEFAULT_SECTIONS[0]);
  const [msg, setMsg] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const canEdit = role === "architect" || role === "constructor";

  const loadSpec = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`${PROJECTS_URL}?action=spec_get`, { method: "POST", body: JSON.stringify({ project_id: project.id }) }, token);
    setSpec(res.spec || null);
    setLoading(false);
  }, [project.id, token]);

  useEffect(() => { loadSpec(); }, [loadSpec]);

  const createSpec = async () => {
    const res = await authFetch(`${PROJECTS_URL}?action=spec_create`, {
      method: "POST",
      body: JSON.stringify({ project_id: project.id, items: [] }),
    }, token);
    if (res.ok) loadSpec();
  };

  const updateItem = async (item: SpecItem, field: string, value: string | number) => {
    setSaving(item.id);
    await authFetch(`${PROJECTS_URL}?action=spec_update_item`, {
      method: "POST",
      body: JSON.stringify({ item_id: item.id, spec_id: spec?.id, [field]: value }),
    }, token);
    setSaving(null);
    setEditingCell(null);
    setSpec(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === item.id ? { ...i, [field]: value, total_price: field === "qty" ? Number(value) * i.price_per_unit : field === "price_per_unit" ? i.qty * Number(value) : i.total_price } : i)
    } : null);
  };

  const addItem = async () => {
    if (!spec) return;
    const res = await authFetch(`${PROJECTS_URL}?action=spec_add_item`, {
      method: "POST",
      body: JSON.stringify({ spec_id: spec.id, section: newItemSection, name: "Новая позиция", unit: "шт", qty: 1, price_per_unit: 0 }),
    }, token);
    if (res.ok) { setMsg("Позиция добавлена"); loadSpec(); }
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm("Удалить позицию?")) return;
    await authFetch(`${PROJECTS_URL}?action=spec_delete_item`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    }, token);
    setSpec(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);
  };

  const approve = async () => {
    if (!spec) return;
    await authFetch(`${PROJECTS_URL}?action=spec_approve`, {
      method: "POST",
      body: JSON.stringify({ spec_id: spec.id }),
    }, token);
    setMsg("Ведомость утверждена!");
    loadSpec();
  };

  const loadHistory = async () => {
    if (!spec) return;
    const res = await authFetch(`${PROJECTS_URL}?action=spec_history&spec_id=${spec.id}`, {}, token);
    setHistory(res.history || []);
    setShowHistory(true);
  };

  const downloadPDF = async () => {
    if (!spec) return;
    setGeneratingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFillColor(10, 13, 20);
      doc.rect(0, 0, 297, 210, "F");
      doc.setFontSize(16); doc.setTextColor(255, 107, 26);
      doc.text(`ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ`, 14, 16);
      doc.setFontSize(10); doc.setTextColor(180, 180, 180);
      doc.text(`Проект: ${project.name} · ${project.area} м² · ${project.floors} эт. · ${project.type}`, 14, 24);
      doc.text(`Версия: ${spec.version} · Статус: ${spec.status === "approved" ? "Утверждена" : "Черновик"} · Дата: ${new Date().toLocaleDateString("ru-RU")}`, 14, 30);

      const sections = Array.from(new Set(spec.items.map(i => i.section)));
      let startY = 36;

      for (const section of sections) {
        const sectionItems = spec.items.filter(i => i.section === section);
        const sTotal = sectionItems.reduce((s, i) => s + i.total_price, 0);

        doc.setFillColor(30, 37, 53);
        doc.rect(14, startY, 269, 6, "F");
        doc.setFontSize(8); doc.setTextColor(255, 107, 26);
        doc.text(`${section.toUpperCase()}`, 16, startY + 4.2);
        startY += 7;

        autoTable(doc, {
          startY,
          head: [["Наименование", "Ед.", "Кол-во", "Цена/ед., ₽", "Сумма, ₽", "Примечание"]],
          body: [
            ...sectionItems.map(item => [
              item.name, item.unit, String(item.qty),
              fmt(item.price_per_unit), fmt(item.total_price), item.note || ""
            ]),
            ["", "", "", "Итого по разделу:", fmt(sTotal), ""],
          ],
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [220, 220, 220], fillColor: [15, 19, 30], lineColor: [30, 37, 53] },
          headStyles: { fillColor: [20, 26, 40], textColor: [0, 212, 255], fontStyle: "bold", fontSize: 7 },
          footStyles: { fillColor: [20, 26, 40], textColor: [0, 255, 136], fontStyle: "bold" },
          columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 15, halign: "center" }, 2: { cellWidth: 20, halign: "right" }, 3: { cellWidth: 30, halign: "right" }, 4: { cellWidth: 30, halign: "right" }, 5: { cellWidth: "auto" } },
          margin: { left: 14, right: 14 },
          didParseCell: (data) => {
            if (data.row.index === sectionItems.length) {
              data.cell.styles.fillColor = [20, 26, 40];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [0, 255, 136];
            }
          },
        });
        startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
      }

      const grandTotal = spec.items.reduce((s, i) => s + i.total_price, 0);
      doc.setFontSize(13); doc.setTextColor(255, 107, 26);
      doc.text(`ИТОГО: ${fmt(grandTotal)} руб.`, 14, startY + 8);

      doc.save(`vedomost_${project.name}_v${spec.version}.pdf`);
    } catch (e) {
      setMsg("Ошибка генерации PDF");
    }
    setGeneratingPDF(false);
  };

  if (loading) return <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  if (!spec) {
    return (
      <div className="text-center py-10 rounded-2xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="text-4xl mb-3">📋</div>
        <div className="font-display text-lg text-white mb-1">Ведомость не создана</div>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          {canEdit ? "Создайте ведомость объёмов работ для этого проекта" : "Ведомость ещё не создана архитектором или конструктором"}
        </p>
        {canEdit && (
          <button onClick={createSpec}
            className="px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "var(--neon-orange)", color: "#fff" }}>
            Создать ведомость
          </button>
        )}
      </div>
    );
  }

  const sections = Array.from(new Set(spec.items.map(i => i.section)));
  const grandTotal = spec.items.reduce((s, i) => s + i.total_price, 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-white">{spec.title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: spec.status === "approved" ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.07)", color: spec.status === "approved" ? "var(--neon-green)" : "rgba(255,255,255,0.5)" }}>
            {spec.status === "approved" ? "✓ Утверждена" : `Черновик v${spec.version}`}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={loadHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            <Icon name="History" size={12} /> История
          </button>
          {canEdit && spec.status !== "approved" && (
            <button onClick={approve}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
              <Icon name="Check" size={12} /> Утвердить
            </button>
          )}
          <button onClick={downloadPDF} disabled={generatingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: "var(--neon-orange)", color: "#fff" }}>
            <Icon name="FileDown" size={12} /> {generatingPDF ? "Генерация..." : "PDF"}
          </button>
        </div>
      </div>

      {msg && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(0,255,136,0.08)", color: "var(--neon-green)" }}>{msg}</div>}

      {/* Items by section */}
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
                            onClick={() => canEdit && !isReadonly && setEditingCell({ id: item.id, field })}
                            style={{ cursor: canEdit && !isReadonly ? "pointer" : "default" }}>
                            {isEditing ? (
                              <input autoFocus
                                type={["qty", "price_per_unit"].includes(field) ? "number" : "text"}
                                defaultValue={String(val)}
                                className="w-full px-1.5 py-1 rounded text-sm text-white outline-none"
                                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid var(--neon-cyan)", minWidth: 60 }}
                                onBlur={e => updateItem(item, field, ["qty","price_per_unit"].includes(field) ? +e.target.value : e.target.value)}
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
                          <button onClick={() => deleteItem(item.id)}
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

      {/* Add item */}
      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select value={newItemSection} onChange={e => setNewItemSection(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {DEFAULT_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={addItem}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,107,26,0.12)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.25)" }}>
            <Icon name="Plus" size={14} /> Добавить позицию
          </button>
        </div>
      )}

      {/* Total */}
      <div className="mt-4 rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.2)" }}>
        <span className="font-display font-semibold text-white">ИТОГО ПО ВЕДОМОСТИ</span>
        <span className="font-display font-black text-2xl" style={{ color: "var(--neon-orange)" }}>{fmt(grandTotal)} ₽</span>
      </div>

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-white">История изменений</h3>
              <button onClick={() => setShowHistory(false)} style={{ color: "rgba(255,255,255,0.4)" }}>
                <Icon name="X" size={18} />
              </button>
            </div>
            {history.length === 0
              ? <div className="text-center py-6" style={{ color: "rgba(255,255,255,0.3)" }}>История пуста</div>
              : <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      <span>{h.by}</span><span>·</span><span>{new Date(h.at).toLocaleString("ru-RU")}</span>
                    </div>
                    <div className="text-sm text-white">{h.item}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span style={{ color: "#ef4444" }}>{h.old}</span>
                      <Icon name="ArrowRight" size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                      <span style={{ color: "var(--neon-green)" }}>{h.new}</span>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>({h.field})</span>
                    </div>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export: панель проекта ────────────────────────────────────────────────
export default function ProjectPanel({ project, token, role, onClose }: {
  project: Project; token: string; role: string; onClose: () => void
}) {
  const [tab, setTab] = useState<"gallery" | "spec">("gallery");
  const canEdit = role === "architect" || role === "constructor";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--dark-bg)", border: "1px solid var(--card-border)" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--card-border)", background: "rgba(255,255,255,0.02)" }}>
          <div>
            <div className="font-display font-bold text-xl text-white">{project.name}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {project.type} · {project.area} м² · {project.floors} эт. · {project.rooms} комн.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex p-1 rounded-xl gap-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              {[{id:"gallery",label:"Файлы",icon:"Images"},{id:"spec",label:"Ведомость",icon:"ClipboardList"}].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as "gallery"|"spec")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: tab === t.id ? "var(--neon-orange)" : "transparent", color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)" }}>
                  <Icon name={t.icon} size={13} />{t.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}>
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "gallery"
            ? <FileGallery project={project} token={token} canEdit={canEdit} />
            : <SpecEditor project={project} token={token} role={role} />}
        </div>
      </div>
    </div>
  );
}
