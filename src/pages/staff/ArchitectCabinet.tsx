import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";
const CHUNK_SIZE = 3 * 1024 * 1024; // 3МБ на чанк

async function uploadFileChunked(
  file: File,
  projectId: number,
  fileType: string,
  token: string,
  onProgress?: (pct: number) => void
): Promise<{ cdn_url: string; key: string } | null> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let uploadId = "";
  let parts: { PartNumber: number; ETag: string }[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const arrayBuf = await slice.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

    const body: Record<string, unknown> = {
      project_id: projectId,
      file_name: file.name,
      file_type: fileType,
      chunk: b64,
      chunk_index: i,
      total_chunks: totalChunks,
      upload_id: uploadId,
      parts,
    };

    const r = await apiFetch(`${PROJECTS_URL}?action=upload_file`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token);

    if (!r.ok) return null;
    if (r.upload_id) uploadId = r.upload_id;
    if (r.parts) parts = r.parts;
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    if (r.done) return { cdn_url: r.cdn_url, key: r.key };
  }
  return null;
}

const HOUSE_TYPES = ["Кирпичный", "Каркасный", "Монолитный", "Деревянный", "Газобетон", "Модульный"];
const TAG_COLORS = ["#FF6B1A", "#00D4FF", "#00FF88", "#A855F7", "#FBBF24", "#EC4899"];
const FILE_TYPES = [
  { id: "render", label: "Рендер фасада", icon: "Image" },
  { id: "plan", label: "План", icon: "LayoutGrid" },
  { id: "facade", label: "Фасад", icon: "Building2" },
  { id: "section", label: "Разрез", icon: "Scissors" },
  { id: "spec", label: "Спецификация", icon: "FileText" },
  { id: "other", label: "Прочее", icon: "File" },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}), ...(opts.headers || {}) },
  }).then(r => r.json());
}

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }



// ─── interfaces ──────────────────────────────────────────────────────────────

interface StaffUser { id: number; full_name: string; role_code: string; }

interface Project {
  id: number; name: string; type: string; area: number; floors: number;
  rooms: number; price: number; tag: string; tag_color: string;
  description: string; features: string; is_active: boolean;
  created_at: string; files: ProjectFile[]; specs: Spec[];
}

interface ProjectFile {
  id: number; file_type: string; file_url: string; file_name: string; sort_order: number;
}

interface Spec {
  id: number; title: string; version: number; status: string;
  created_at: string; updated_at: string; items?: SpecItem[];
}

interface SpecItem {
  id: number; section: string; name: string; unit: string;
  qty: number; price_per_unit: number; total_price: number; note: string;
}

interface TechCard {
  id: number; title: string; category: string; description: string;
  content: Array<{ step: number; name: string; desc: string; duration: string }>;
}

// ─── TechCards modal ─────────────────────────────────────────────────────────

function TechCardsModal({ token, projectId, onClose }: { token: string; projectId: number; onClose: () => void }) {
  const [cards, setCards] = useState<TechCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [attached, setAttached] = useState<Set<number>>(new Set());

  useEffect(() => {
    apiFetch(`${PROJECTS_URL}?action=tech_cards`, {}, token)
      .then(r => { setCards(r.tech_cards || []); setLoading(false); });
  }, [token]);

  const attach = async (cardId: number) => {
    await apiFetch(`${PROJECTS_URL}?action=tech_card_attach`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, tech_card_id: cardId }),
    }, token);
    setAttached(prev => new Set([...prev, cardId]));
  };

  const categories = [...new Set(cards.map(c => c.category))];
  const catColors: Record<string, string> = {
    "Фундамент": "#00D4FF", "Стены": "#FF6B1A", "Кровля": "#A855F7",
    "Полы": "#FBBF24", "Окна и двери": "#00FF88", "Отделка": "#EC4899",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--dark-bg)", border: "1px solid rgba(168,85,247,0.3)" }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#A855F7" }}>Библиотека</div>
            <h3 className="font-display font-bold text-xl text-white">Технологические карты</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {loading ? (
            <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : categories.map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: catColors[cat] || "#fff" }} />
                <span className="text-sm font-semibold text-white">{cat}</span>
              </div>
              <div className="space-y-2">
                {cards.filter(c => c.category === cat).map(card => (
                  <div key={card.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5"
                      onClick={() => setOpenCard(openCard === card.id ? null : card.id)}
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div>
                        <div className="text-sm font-medium text-white">{card.title}</div>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{card.description}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={e => { e.stopPropagation(); attach(card.id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={{
                            background: attached.has(card.id) ? "rgba(0,255,136,0.15)" : "rgba(168,85,247,0.2)",
                            color: attached.has(card.id) ? "var(--neon-green)" : "#A855F7",
                            border: `1px solid ${attached.has(card.id) ? "rgba(0,255,136,0.3)" : "rgba(168,85,247,0.3)"}`,
                          }}>
                          {attached.has(card.id) ? "Добавлено ✓" : "Добавить"}
                        </button>
                        <Icon name={openCard === card.id ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                      </div>
                    </div>

                    {openCard === card.id && (
                      <div className="px-4 py-3 space-y-2" style={{ background: "rgba(168,85,247,0.04)" }}>
                        {card.content.map((step) => (
                          <div key={step.step} className="flex gap-3">
                            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                              style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>{step.step}</div>
                            <div>
                              <div className="text-sm font-medium text-white">{step.name}</div>
                              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{step.desc}</div>
                              <div className="text-xs mt-0.5" style={{ color: "#A855F7" }}>⏱ {step.duration}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SpecEditor ───────────────────────────────────────────────────────────────

function SpecEditor({ spec, token, onUpdate }: { spec: Spec; token: string; onUpdate: () => void }) {
  const [items, setItems] = useState<SpecItem[]>(spec.items || []);
  const [loading, setLoading] = useState(!spec.items);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<SpecItem>>({});
  const [addForm, setAddForm] = useState({ section: "", name: "", unit: "м²", qty: 0, price_per_unit: 0, note: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!spec.items) {
      apiFetch(`${PROJECTS_URL}?action=spec_get&project_id=${spec.id}`, {}, token)
        .then(r => { setItems(r.spec?.items || []); setLoading(false); });
    }
  }, [spec, token]);

  const loadItems = async () => {
    const r = await apiFetch(`${PROJECTS_URL}?action=spec_get&project_id=${items[0]?.id}`, {}, token);
    setItems(r.spec?.items || []);
  };

  const saveItem = async (itemId: number) => {
    setSaving(true);
    await apiFetch(`${PROJECTS_URL}?action=spec_update_item`, {
      method: "POST",
      body: JSON.stringify({ item_id: itemId, spec_id: spec.id, ...editBuf }),
    }, token);
    setSaving(false);
    setEditingItem(null);
    // обновляем локально
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, ...editBuf, total_price: (editBuf.qty ?? it.qty) * (editBuf.price_per_unit ?? it.price_per_unit) }
      : it));
    onUpdate();
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm("Удалить позицию?")) return;
    await apiFetch(`${PROJECTS_URL}?action=spec_delete_item`, {
      method: "POST", body: JSON.stringify({ item_id: itemId }),
    }, token);
    setItems(prev => prev.filter(it => it.id !== itemId));
    onUpdate();
  };

  const addItem = async () => {
    setSaving(true);
    const r = await apiFetch(`${PROJECTS_URL}?action=spec_add_item`, {
      method: "POST", body: JSON.stringify({ spec_id: spec.id, ...addForm }),
    }, token);
    setSaving(false);
    if (r.ok) {
      setItems(prev => [...prev, { id: r.id, ...addForm, total_price: addForm.qty * addForm.price_per_unit }]);
      setShowAdd(false);
      setAddForm({ section: "", name: "", unit: "м²", qty: 0, price_per_unit: 0, note: "" });
      onUpdate();
    }
  };

  const sections = [...new Set(items.map(i => i.section))];
  const total = items.reduce((s, i) => s + (i.total_price || i.qty * i.price_per_unit), 0);

  const inpCls = "px-2.5 py-1.5 rounded-lg text-xs text-white outline-none w-full";
  const inpSty = { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" };

  if (loading) return <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  return (
    <div>
      {/* Итого */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{items.length} позиций</div>
        <div className="font-display font-bold text-lg" style={{ color: "var(--neon-green)" }}>
          Итого: {fmt(total)} ₽
        </div>
      </div>

      {/* Таблица по разделам */}
      {sections.length === 0 ? (
        <div className="text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Позиций нет — добавьте первую</div>
      ) : sections.map(sec => (
        <div key={sec} className="mb-5 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(0,212,255,0.8)" }}>{sec}</div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Наименование", "Ед.", "Кол-во", "Цена/ед.", "Сумма", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.filter(it => it.section === sec).map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {editingItem === item.id ? (
                    <>
                      <td className="px-2 py-1.5"><input className={inpCls} style={inpSty} defaultValue={item.name} onChange={e => setEditBuf(b => ({ ...b, name: e.target.value }))} /></td>
                      <td className="px-2 py-1.5 w-16"><input className={inpCls} style={inpSty} defaultValue={item.unit} onChange={e => setEditBuf(b => ({ ...b, unit: e.target.value }))} /></td>
                      <td className="px-2 py-1.5 w-20"><input type="number" className={inpCls} style={inpSty} defaultValue={item.qty} onChange={e => setEditBuf(b => ({ ...b, qty: +e.target.value }))} /></td>
                      <td className="px-2 py-1.5 w-28"><input type="number" className={inpCls} style={inpSty} defaultValue={item.price_per_unit} onChange={e => setEditBuf(b => ({ ...b, price_per_unit: +e.target.value }))} /></td>
                      <td className="px-3 py-1.5 font-semibold" style={{ color: "var(--neon-green)" }}>
                        {fmt((editBuf.qty ?? item.qty) * (editBuf.price_per_unit ?? item.price_per_unit))}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={() => saveItem(item.id)} disabled={saving}
                            className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "var(--neon-green)", color: "#000" }}>
                            {saving ? "..." : "✓"}
                          </button>
                          <button onClick={() => setEditingItem(null)}
                            className="px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.8)" }}>{item.name}</td>
                      <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>{item.unit}</td>
                      <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.7)" }}>{item.qty}</td>
                      <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{fmt(item.price_per_unit)}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: "var(--neon-green)" }}>{fmt(item.total_price || item.qty * item.price_per_unit)}</td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingItem(item.id); setEditBuf({}); }}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <Icon name="Pencil" size={11} />
                          </button>
                          <button onClick={() => deleteItem(item.id)}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20" style={{ color: "rgba(255,80,80,0.5)" }}>
                            <Icon name="Trash2" size={11} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Добавить позицию */}
      {showAdd ? (
        <div className="rounded-xl p-4 mt-3" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {([
              { key: "section", label: "Раздел", placeholder: "Фундамент" },
              { key: "name", label: "Наименование", placeholder: "Бетон М300" },
              { key: "unit", label: "Ед. изм.", placeholder: "м³" },
            ] as const).map(f => (
              <div key={f.key}>
                <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>{f.label}</div>
                <input className={inpCls} style={inpSty} placeholder={f.placeholder}
                  value={addForm[f.key]} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            {([
              { key: "qty", label: "Количество" },
              { key: "price_per_unit", label: "Цена/ед., ₽" },
            ] as const).map(f => (
              <div key={f.key}>
                <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>{f.label}</div>
                <input type="number" className={inpCls} style={inpSty}
                  value={addForm[f.key]} onChange={e => setAddForm(p => ({ ...p, [f.key]: +e.target.value }))} />
              </div>
            ))}
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Сумма</div>
              <div className="px-2.5 py-1.5 text-xs font-bold" style={{ color: "var(--neon-green)" }}>
                {fmt(addForm.qty * addForm.price_per_unit)} ₽
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "var(--neon-cyan)", color: "#000" }}>
              {saving ? "Сохранение..." : "Добавить позицию"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-1.5 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.2)" }}>
          <Icon name="Plus" size={13} />
          Добавить позицию
        </button>
      )}
    </div>
  );
}

// ─── ProjectDetail ─────────────────────────────────────────────────────────────

function ProjectDetail({ project, token, onBack, onRefresh }: { project: Project; token: string; onBack: () => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<"info" | "files" | "spec" | "tech">("info");
  const [proj, setProj] = useState(project);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [selectedFileType, setSelectedFileType] = useState("render");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [showTechCards, setShowTechCards] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProject = useCallback(async () => {
    const r = await apiFetch(`${PROJECTS_URL}?action=get&project_id=${project.id}`, {}, token);
    if (r.project) setProj(r.project);
  }, [project.id, token]);

  const loadSpec = useCallback(async () => {
    setSpecLoading(true);
    const r = await apiFetch(`${PROJECTS_URL}?action=spec_get&project_id=${project.id}`, {}, token);
    setSpec(r.spec || null);
    setSpecLoading(false);
  }, [project.id, token]);

  useEffect(() => { if (tab === "files") loadProject(); }, [tab, loadProject]);
  useEffect(() => { if (tab === "spec") loadSpec(); }, [tab, loadSpec]);

  const createSpec = async () => {
    setSpecLoading(true);
    await apiFetch(`${PROJECTS_URL}?action=spec_create`, {
      method: "POST",
      body: JSON.stringify({ project_id: project.id, title: `Ведомость ОР — ${proj.name}`, items: [] }),
    }, token);
    await loadSpec();
  };

  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploading(true); setUploadMsg(""); setUploadProgress(0);
    try {
      const result = await uploadFileChunked(file, project.id, selectedFileType, token, setUploadProgress);
      if (!result) { setUploadMsg("Ошибка загрузки файла"); setUploading(false); return; }

      const r2 = await apiFetch(`${PROJECTS_URL}?action=confirm_upload`, {
        method: "POST",
        body: JSON.stringify({ project_id: project.id, file_name: file.name, file_type: selectedFileType, cdn_url: result.cdn_url }),
      }, token);
      if (r2.ok) { setUploadMsg("Файл загружен!"); loadProject(); onRefresh(); }
      else setUploadMsg(r2.error || "Ошибка подтверждения");
    } catch (e) { setUploadMsg("Ошибка загрузки: " + String(e)); }
    setUploading(false);
  };

  const deleteFile = async (fileId: number) => {
    if (!confirm("Удалить файл?")) return;
    await apiFetch(`${PROJECTS_URL}?action=delete_file`, {
      method: "POST", body: JSON.stringify({ file_id: fileId }),
    }, token);
    loadProject(); onRefresh();
  };

  const TABS = [
    { id: "info", label: "Информация", icon: "Info" },
    { id: "files", label: "Графика", icon: "Image", count: proj.files?.length },
    { id: "spec", label: "Ведомость ОР", icon: "FileSpreadsheet" },
    { id: "tech", label: "Тех. карты", icon: "BookOpen" },
  ] as const;

  const filesByType = FILE_TYPES.map(ft => ({
    ...ft,
    files: (proj.files || []).filter(f => f.file_type === ft.id),
  }));

  return (
    <div className="animate-fade-in">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <Icon name="ArrowLeft" size={16} />
        </button>
        <div>
          <div className="font-display font-bold text-2xl text-white">{proj.name}</div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {proj.type} · {proj.area} м² · {proj.floors} эт. · {proj.rooms} комн.
          </div>
        </div>
        <div className="ml-auto px-3 py-1 rounded-full text-xs font-semibold font-display"
          style={{ background: `${proj.tag_color}22`, color: proj.tag_color, border: `1px solid ${proj.tag_color}44` }}>
          {proj.tag || "—"}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: tab === t.id ? "var(--neon-orange)" : "transparent",
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
              boxShadow: tab === t.id ? "0 0 15px rgba(255,107,26,0.3)" : "none",
            }}>
            <Icon name={t.icon} size={14} />
            {t.label}
            {"count" in t && t.count ? (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: tab === t.id ? "rgba(255,255,255,0.25)" : "rgba(255,107,26,0.3)", color: tab === t.id ? "#fff" : "var(--neon-orange)", fontSize: 10 }}>
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Информация ── */}
      {tab === "info" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Характеристики</div>
            {[
              ["Тип", proj.type], ["Площадь", `${proj.area} м²`], ["Этажей", String(proj.floors)],
              ["Комнат", String(proj.rooms)], ["Стоимость от", `${fmt(proj.price)} ₽`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
                <span className="text-sm font-medium text-white">{v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Описание и особенности</div>
            <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{proj.description || "—"}</p>
            <div className="space-y-1.5">
              {(proj.features || "").split(",").filter(Boolean).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: proj.tag_color }} />
                  {f.trim()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Графика ── */}
      {tab === "files" && (
        <div>
          {/* Загрузчик */}
          <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузить файл</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {FILE_TYPES.map(ft => (
                <button key={ft.id} onClick={() => setSelectedFileType(ft.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: selectedFileType === ft.id ? "var(--neon-orange)" : "rgba(255,255,255,0.06)",
                    color: selectedFileType === ft.id ? "#fff" : "rgba(255,255,255,0.5)",
                  }}>
                  <Icon name={ft.icon} size={12} />
                  {ft.label}
                </button>
              ))}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name={uploading ? "Loader" : "Upload"} size={15} />
              {uploading ? `Загрузка... ${uploadProgress}%` : "Выбрать файл (фото, PDF)"}
            </button>
            {uploading && uploadProgress > 0 && (
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: "var(--neon-orange)" }} />
              </div>
            )}
            {uploadMsg && <div className="mt-2 text-sm" style={{ color: uploadMsg.includes("!") ? "var(--neon-green)" : "#ef4444" }}>{uploadMsg}</div>}
          </div>

          {/* Файлы по разделам */}
          {filesByType.filter(ft => ft.files.length > 0).map(ft => (
            <div key={ft.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Icon name={ft.icon} size={14} style={{ color: "var(--neon-cyan)" }} />
                <span className="text-sm font-semibold text-white">{ft.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)" }}>{ft.files.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ft.files.map(file => (
                  <div key={file.id} className="rounded-xl overflow-hidden group relative"
                    style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    {file.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={file.file_url} alt={file.file_name} className="w-full h-32 object-cover" />
                    ) : (
                      <a href={file.file_url} target="_blank" rel="noreferrer"
                        className="flex flex-col items-center justify-center h-32 gap-2"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        <Icon name="FileText" size={28} style={{ color: "var(--neon-orange)" }} />
                        <span className="text-xs text-center px-2" style={{ color: "rgba(255,255,255,0.5)" }}>{file.file_name}</span>
                      </a>
                    )}
                    <button onClick={() => deleteFile(file.id)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(239,68,68,0.8)", color: "#fff" }}>
                      <Icon name="X" size={11} />
                    </button>
                    <div className="px-2 py-1.5">
                      <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{file.file_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filesByType.every(ft => ft.files.length === 0) && (
            <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="text-4xl mb-3">🖼️</div>
              <div className="text-white font-display">Файлов пока нет</div>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузите рендеры, планы, фасады и разрезы</p>
            </div>
          )}
        </div>
      )}

      {/* ── Ведомость ОР ── */}
      {tab === "spec" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Ведомость объёмов работ</div>
              {spec && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>v{spec.version} · {spec.status === "approved" ? "Утверждена" : "Черновик"}</div>}
            </div>
            {!spec && !specLoading && (
              <button onClick={createSpec}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
                <Icon name="Plus" size={14} />
                Создать ведомость
              </button>
            )}
          </div>

          {specLoading ? (
            <div className="text-center py-8" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : spec ? (
            <SpecEditor spec={spec} token={token} onUpdate={loadSpec} />
          ) : (
            <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
              <div className="text-3xl mb-2">📋</div>
              Нажмите «Создать ведомость» чтобы начать
            </div>
          )}
        </div>
      )}

      {/* ── Тех. карты ── */}
      {tab === "tech" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Технологические карты</div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Выберите карты из библиотеки шаблонов</p>
            </div>
            <button onClick={() => setShowTechCards(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
              <Icon name="BookOpen" size={14} />
              Открыть библиотеку
            </button>
          </div>
          <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.25)" }}>
            <div className="text-4xl mb-3">📖</div>
            Нажмите «Открыть библиотеку» чтобы выбрать<br />технологические карты для проекта
          </div>
        </div>
      )}

      {showTechCards && (
        <TechCardsModal token={token} projectId={proj.id} onClose={() => setShowTechCards(false)} />
      )}
    </div>
  );
}

// ─── Main ArchitectCabinet ────────────────────────────────────────────────────

export default function ArchitectCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4,
    price: 5000000, tag: "Новинка", tag_color: "#FF6B1A", description: "", features: "", is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await apiFetch(`${PROJECTS_URL}?action=list`, {}, token);
    setProjects(r.projects || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4, price: 5000000, tag: "Новинка", tag_color: "#FF6B1A", description: "", features: "", is_active: true });
    setEditingId(null); setShowForm(true); setMsg("");
  };

  const openEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({ name: p.name, type: p.type, area: p.area, floors: p.floors, rooms: p.rooms, price: p.price, tag: p.tag, tag_color: p.tag_color, description: p.description, features: p.features, is_active: p.is_active });
    setEditingId(p.id); setShowForm(true); setMsg("");
  };

  const save = async () => {
    if (!form.name.trim()) { setMsg("Введите название проекта"); return; }
    setSaving(true); setMsg("");
    const action = editingId ? "update" : "create";
    const body = editingId ? { ...form, project_id: editingId } : form;
    const r = await apiFetch(`${PROJECTS_URL}?action=${action}`, { method: "POST", body: JSON.stringify(body) }, token);
    setSaving(false);
    if (r.ok) { setMsg("Сохранено!"); setTimeout(() => { setShowForm(false); load(); }, 800); }
    else setMsg(r.error || "Ошибка");
  };

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all";
  const inpSty = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        token={token}
        onBack={() => setSelectedProject(null)}
        onRefresh={load}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Архитектор</div>
          <h2 className="font-display text-2xl font-bold text-white">Мои проекты</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{user.full_name} · {projects.length} проектов</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "var(--neon-cyan)", color: "#0A0D14", boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
          <Icon name="Plus" size={15} />
          Новый проект
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-6 mb-6 animate-scale-in"
          style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.25)" }}>
          <h3 className="font-display font-semibold text-lg text-white mb-5">
            {editingId ? "Редактировать проект" : "Новый проект"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Название *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Эко Минимал" className={inp} style={inpSty} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className={inp} style={{ ...inpSty, background: "#1a1f2e" }}>
                {HOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: "Площадь (м²)", key: "area" }, { label: "Этажей", key: "floors" },
              { label: "Комнат", key: "rooms" }, { label: "Стоимость (₽)", key: "price" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                <input type="number" value={(form as Record<string, unknown>)[f.key] as number}
                  onChange={e => setForm(p => ({ ...p, [f.key]: +e.target.value }))}
                  className={inp} style={inpSty} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Метка</label>
              <input type="text" value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))}
                placeholder="Хит / Новинка / Премиум" className={inp} style={inpSty} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Цвет метки</label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, tag_color: c }))}
                    className="w-7 h-7 rounded-full transition-all hover:scale-110"
                    style={{ background: c, outline: form.tag_color === c ? `3px solid #fff` : "none", outlineOffset: 2 }} />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Описание</label>
              <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Современный одноэтажный дом в скандинавском стиле" className={inp} style={inpSty} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Особенности (через запятую)</label>
              <input type="text" value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))}
                placeholder="Панорамные окна, Открытая планировка, Эко-материалы" className={inp} style={inpSty} />
            </div>
          </div>

          {msg && (
            <div className="mt-3 text-sm px-3 py-2 rounded-xl"
              style={{ background: msg === "Сохранено!" ? "rgba(0,255,136,0.1)" : "rgba(239,68,68,0.1)", color: msg === "Сохранено!" ? "var(--neon-green)" : "#ef4444" }}>
              {msg}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "var(--neon-cyan)", color: "#0A0D14" }}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl text-sm transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
            {editingId && (
              <label className="flex items-center gap-2 ml-auto cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Активен</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Projects grid */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка проектов...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-5xl mb-4">🏗️</div>
          <div className="font-display text-xl text-white mb-2">Проектов пока нет</div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Нажмите «Новый проект» чтобы добавить первый</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const renderImg = p.files?.find(f => f.file_type === "render" || f.file_url.match(/\.(jpg|jpeg|png|webp)$/i));
            return (
              <div key={p.id}
                className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  opacity: p.is_active ? 1 : 0.5,
                  animation: `fadeInUp 0.4s ease-out ${i * 0.06}s both`,
                }}
                onClick={() => setSelectedProject(p)}>

                {/* Preview */}
                <div className="relative h-36 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                  {renderImg ? (
                    <img src={renderImg.file_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Building2" size={36} style={{ color: "rgba(255,255,255,0.08)" }} />
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(10,13,20,0.85) 100%)" }} />
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold font-display"
                    style={{ background: `${p.tag_color}dd`, color: "#0A0D14" }}>{p.tag || "—"}</div>
                  <button onClick={e => openEdit(p, e)}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: "rgba(10,13,20,0.6)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}>
                    <Icon name="Pencil" size={12} />
                  </button>
                  {p.files?.length > 0 && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                      style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>
                      <Icon name="Image" size={10} />
                      {p.files.length}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="font-display font-bold text-base text-white mb-0.5">{p.name}</div>
                  <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{p.type} · {p.area} м² · {p.floors} эт. · {p.rooms} комн.</div>
                  <div className="flex items-center justify-between">
                    <div className="font-display font-bold text-base" style={{ color: p.tag_color }}>
                      {(p.price / 1_000_000).toFixed(1)} млн ₽
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {p.specs?.length > 0 && <span style={{ color: "var(--neon-green)" }}>📋 ВОР</span>}
                      <Icon name="ChevronRight" size={14} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}