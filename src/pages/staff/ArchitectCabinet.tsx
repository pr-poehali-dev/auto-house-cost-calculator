import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";
const TTK_URL = "https://functions.poehali.dev/aa8514d2-9f4a-46fc-80af-a91de8aa4b62";
const AI_URL = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";
const CHUNK_SIZE = 512 * 1024; // 512КБ бинарных → ~700КБ base64, гарантированно в лимите платформы

async function uploadFileChunked(
  file: File,
  projectId: number,
  fileType: string,
  token: string,
  onProgress?: (pct: number) => void
): Promise<{ cdn_url: string; key: string } | null> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  // Генерируем уникальный ID сессии загрузки один раз
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let i = 0; i < totalChunks; i++) {
    const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const arrayBuf = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let b64 = "";
    for (let j = 0; j < bytes.length; j += 1024) {
      b64 += String.fromCharCode(...bytes.subarray(j, j + 1024));
    }
    b64 = btoa(b64);

    const r = await apiFetch(`${PROJECTS_URL}?action=upload_file`, {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        file_name: file.name,
        file_type: fileType,
        chunk: b64,
        chunk_index: i,
        total_chunks: totalChunks,
        upload_id: uploadId,
      }),
    }, token);

    if (!r.ok) return null;
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    if (r.done) return { cdn_url: r.cdn_url, key: r.key };
  }
  return null;
}

const HOUSE_TYPES = ["Кирпичный", "Каркасный", "Монолитный", "Деревянный", "Газобетон", "Модульный"];
const TAG_COLORS = ["#FF6B1A", "#00D4FF", "#00FF88", "#A855F7", "#FBBF24", "#EC4899"];
const FILE_TYPES = [
  { id: "render", label: "Рендер фасада", icon: "Image", accept: "image/*" },
  { id: "plan", label: "План", icon: "LayoutGrid", accept: "image/*,.pdf,.dwg,.dxf" },
  { id: "facade", label: "Фасад", icon: "Building2", accept: "image/*,.pdf,.dwg,.dxf" },
  { id: "section", label: "Разрез", icon: "Scissors", accept: "image/*,.pdf,.dwg,.dxf" },
  { id: "spec", label: "Спецификация", icon: "FileText", accept: "image/*,.pdf,.xlsx,.xls,.csv,.dwg" },
  { id: "project_full", label: "Весь проект", icon: "FolderArchive", accept: "image/*,.pdf,.xlsx,.xls,.csv,.dwg,.dxf,.zip,.rar,.7z" },
  { id: "other", label: "Прочее", icon: "File", accept: "image/*,.pdf,.xlsx,.xls,.csv,.dwg,.dxf,.zip,.rar,.7z" },
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
  roof_type: string; foundation_type: string; wall_type: string;
}

interface MatchedTTK {
  id: number; title: string; category: string; work_type: string;
  description: string; tags: string[];
  materials: { name: string; unit: string; qty_per_unit: number; note: string }[];
  resources: { name: string; type: string; qty: number; unit: string }[];
  storage_conditions: string; acceptance_conditions: string;
  content: { step: number; name: string; desc: string; duration: string }[];
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

interface TechCardResource {
  type: "material" | "tool" | "labor";
  name: string;
  unit: string;
  qty_per_unit: number;
  note?: string;
}

interface TechCard {
  id: number; title: string; category: string; description: string;
  content: Array<{ step: number; name: string; desc: string; duration: string }>;
  resources?: TechCardResource[];
}

// ─── TechCards modal ─────────────────────────────────────────────────────────

function TechCardsModal({ token, projectId, onClose }: { token: string; projectId: number; onClose: () => void }) {
  const [cards, setCards] = useState<TechCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCard, setOpenCard] = useState<number | null>(null);
  const [openTab, setOpenTab] = useState<Record<number, "steps"|"resources">>({});
  const [attached, setAttached] = useState<Set<number>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [fillingId, setFillingId] = useState<number | null>(null);
  const [fillingAll, setFillingAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCards = () => {
    setLoading(true);
    apiFetch(`${PROJECTS_URL}?action=tech_cards`, {}, token)
      .then(r => { setCards(r.tech_cards || []); setLoading(false); });
  };

  useEffect(() => { loadCards(); }, [token]);

  const fillResources = async (cardId: number) => {
    setFillingId(cardId);
    const res = await apiFetch(`${PROJECTS_URL}?action=tech_card_fill_resources`, {
      method: "POST", body: JSON.stringify({ id: cardId }),
    }, token);
    setFillingId(null);
    if (res.ok) {
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, resources: res.resources } : c));
      setOpenTab(prev => ({ ...prev, [cardId]: "resources" }));
    }
  };

  const fillAllResources = async () => {
    setFillingAll(true);
    const empty = cards.filter(c => !c.resources?.length);
    for (const card of empty) {
      const res = await apiFetch(`${PROJECTS_URL}?action=tech_card_fill_resources`, {
        method: "POST", body: JSON.stringify({ id: card.id }),
      }, token);
      if (res.ok) setCards(prev => prev.map(c => c.id === card.id ? { ...c, resources: res.resources } : c));
    }
    setFillingAll(false);
  };

  const attach = async (cardId: number) => {
    await apiFetch(`${PROJECTS_URL}?action=tech_card_attach`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, tech_card_id: cardId }),
    }, token);
    setAttached(prev => new Set([...prev, cardId]));
  };

  const handleUpload = (file: File) => {
    setUploading(true); setUploadMsg("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      const res = await apiFetch(`${PROJECTS_URL}?action=tech_card_upload`, {
        method: "POST",
        body: JSON.stringify({ file_base64: b64, file_name: file.name }),
      }, token);
      setUploading(false);
      if (res.ok) {
        setUploadMsg(`✓ Добавлена карта «${res.title}» (${res.steps_count} шагов)`);
        setLoading(true);
        loadCards();
      } else {
        setUploadMsg(res.error || "Ошибка загрузки файла");
      }
    };
    reader.readAsDataURL(file);
  };

  const categories = [...new Set(cards.map(c => c.category))];
  const catColors: Record<string, string> = {
    "Фундамент": "#00D4FF", "Стены": "#FF6B1A", "Кровля": "#A855F7",
    "Полы": "#FBBF24", "Окна и двери": "#00FF88", "Отделка": "#EC4899",
    "Инженерия": "#06B6D4", "Земляные работы": "#84CC16", "Прочее": "#9CA3AF",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--dark-bg)", border: "1px solid rgba(168,85,247,0.3)" }}>

        {/* Шапка */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#A855F7" }}>Библиотека</div>
            <h3 className="font-display font-bold text-xl text-white">Технологические карты</h3>
          </div>
          <div className="flex items-center gap-2">
            {cards.some(c => !c.resources?.length) && (
              <button onClick={fillAllResources} disabled={fillingAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
                <Icon name={fillingAll ? "Loader" : "Sparkles"} size={13} />
                {fillingAll ? "Анализ..." : "AI: заполнить ресурсы"}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls" className="hidden"
              onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "rgba(168,85,247,0.15)", color: "#a78bfa", border: "1px solid rgba(168,85,247,0.3)" }}>
              <Icon name={uploading ? "Loader" : "Upload"} size={14} />
              {uploading ? "Обработка..." : "Загрузить PDF / Excel"}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Статус загрузки */}
        {uploadMsg && (
          <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2"
            style={{ background: uploadMsg.startsWith("✓") ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.08)", color: uploadMsg.startsWith("✓") ? "var(--neon-green)" : "#ef4444", border: `1px solid ${uploadMsg.startsWith("✓") ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}` }}>
            <Icon name={uploadMsg.startsWith("✓") ? "CheckCircle" : "AlertCircle"} size={14} />
            {uploadMsg}
          </div>
        )}

        {/* Список карт */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {loading ? (
            <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : cards.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-3">📋</div>
              <div className="text-sm mb-2 text-white">Библиотека пуста</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузите PDF или Excel с технологической картой</div>
            </div>
          ) : categories.map(cat => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: catColors[cat] || "#9CA3AF" }} />
                <span className="text-sm font-semibold text-white">{cat}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>({cards.filter(c => c.category === cat).length})</span>
              </div>
              <div className="space-y-2">
                {cards.filter(c => c.category === cat).map(card => {
                  const tab = openTab[card.id] || "steps";
                  const hasResources = (card.resources?.length || 0) > 0;
                  return (
                    <div key={card.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      {/* Заголовок карты */}
                      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5"
                        onClick={() => setOpenCard(openCard === card.id ? null : card.id)}
                        style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{card.title}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {card.description && <span className="truncate max-w-xs">{card.description}</span>}
                            {card.content?.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(168,85,247,0.12)", color: "#a78bfa", fontSize: "10px" }}>
                                {card.content.length} шагов
                              </span>
                            )}
                            {hasResources && (
                              <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(0,255,136,0.1)", color: "var(--neon-green)", fontSize: "10px" }}>
                                {card.resources!.length} ресурсов
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); attach(card.id); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            style={{ background: attached.has(card.id) ? "rgba(0,255,136,0.15)" : "rgba(168,85,247,0.2)", color: attached.has(card.id) ? "var(--neon-green)" : "#A855F7", border: `1px solid ${attached.has(card.id) ? "rgba(0,255,136,0.3)" : "rgba(168,85,247,0.3)"}` }}>
                            {attached.has(card.id) ? "Добавлено ✓" : "В проект"}
                          </button>
                          <Icon name={openCard === card.id ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                        </div>
                      </div>

                      {/* Раскрытое содержимое */}
                      {openCard === card.id && (
                        <div style={{ background: "rgba(168,85,247,0.03)" }}>
                          {/* Переключатель вкладок */}
                          <div className="flex items-center gap-1 px-4 pt-3 pb-0">
                            <button onClick={() => setOpenTab(p => ({ ...p, [card.id]: "steps" }))}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: tab === "steps" ? "rgba(168,85,247,0.2)" : "transparent", color: tab === "steps" ? "#a78bfa" : "rgba(255,255,255,0.35)", border: tab === "steps" ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent" }}>
                              Шаги ({card.content?.length || 0})
                            </button>
                            <button onClick={() => setOpenTab(p => ({ ...p, [card.id]: "resources" }))}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{ background: tab === "resources" ? "rgba(0,255,136,0.12)" : "transparent", color: tab === "resources" ? "var(--neon-green)" : "rgba(255,255,255,0.35)", border: tab === "resources" ? "1px solid rgba(0,255,136,0.25)" : "1px solid transparent" }}>
                              Ресурсы {hasResources ? `(${card.resources!.length})` : ""}
                            </button>
                            {!hasResources && (
                              <button onClick={e => { e.stopPropagation(); fillResources(card.id); }} disabled={fillingId === card.id}
                                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
                                style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.2)" }}>
                                <Icon name={fillingId === card.id ? "Loader" : "Sparkles"} size={11} />
                                {fillingId === card.id ? "Анализ AI..." : "Заполнить AI"}
                              </button>
                            )}
                          </div>

                          {/* Шаги */}
                          {tab === "steps" && (
                            <div className="px-4 py-3 space-y-3">
                              {card.content?.length > 0 ? card.content.map((step) => (
                                <div key={step.step} className="flex gap-3">
                                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                                    style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>{step.step}</div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-white">{step.name}</div>
                                    {step.desc && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{step.desc}</div>}
                                    {step.duration && <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#A855F7" }}><Icon name="Clock" size={10} /> {step.duration}</div>}
                                  </div>
                                </div>
                              )) : <div className="text-xs py-2" style={{ color: "rgba(255,255,255,0.3)" }}>Шаги не указаны</div>}
                            </div>
                          )}

                          {/* Ресурсы */}
                          {tab === "resources" && (
                            <div className="px-4 py-3">
                              {hasResources ? (
                                <>
                                  {(["material","tool","labor"] as const).map(type => {
                                    const group = card.resources!.filter(r => r.type === type);
                                    if (!group.length) return null;
                                    const labels = { material: "Материалы", tool: "Инструмент и механизмы", labor: "Трудозатраты" };
                                    const colors = { material: "var(--neon-cyan)", tool: "#FBBF24", labor: "#FF6B1A" };
                                    return (
                                      <div key={type} className="mb-4">
                                        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors[type] }}>{labels[type]}</div>
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                              {["Наименование","Ед.","На ед.","Примечание"].map((h,i) => (
                                                <th key={i} className="text-left py-1.5 pr-3 font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {group.map((r, i) => (
                                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                <td className="py-1.5 pr-3 text-white">{r.name}</td>
                                                <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.5)" }}>{r.unit}</td>
                                                <td className="py-1.5 pr-3 font-mono font-semibold" style={{ color: colors[type] }}>{r.qty_per_unit}</td>
                                                <td className="py-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{r.note || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })}
                                </>
                              ) : (
                                <div className="text-center py-6">
                                  <div className="text-sm mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Ресурсы не заполнены</div>
                                  <button onClick={() => fillResources(card.id)} disabled={fillingId === card.id}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mx-auto transition-all hover:scale-105 disabled:opacity-60"
                                    style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
                                    <Icon name={fillingId === card.id ? "Loader" : "Sparkles"} size={14} />
                                    {fillingId === card.id ? "AI анализирует..." : "Заполнить через AI"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Подсказка */}
        <div className="px-5 py-3 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)" }}>
          Поддерживаются форматы: PDF, Excel (.xlsx, .xls) · AI автоматически извлекает структуру карты и ресурсы
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

// ─── TechTab — автоподбор ТТК по параметрам проекта ──────────────────────────

const CATEGORY_ICON: Record<string, string> = {
  "Кровля": "Home", "Фундамент": "Layers", "Стены": "Square", "Инженерия": "Wrench",
  "Электрика": "Zap", "Полы": "LayoutGrid", "Отделка": "Palette", "Окна и двери": "RectangleHorizontal",
};

function TechTab({ proj, token, onOpenLibrary }: { proj: Project; token: string; onOpenLibrary: () => void }) {
  const [cards, setCards] = useState<MatchedTTK[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedSection, setExpandedSection] = useState<"materials" | "resources" | "steps" | "conditions" | null>(null);
  const hasParams = !!(proj.roof_type || proj.foundation_type || proj.wall_type);

  const match = useCallback(async () => {
    setLoading(true); setCards([]); setReply("");
    const r = await apiFetch(`${TTK_URL}?action=match_project`, {
      method: "POST",
      body: JSON.stringify({
        params: {
          roof_type: proj.roof_type, wall_type: proj.wall_type,
          foundation_type: proj.foundation_type, area: proj.area,
          house_type: proj.type, floors: proj.floors,
        }
      }),
    }, token);
    setCards(r.cards || []);
    setReply(r.reply || "");
    setLoading(false);
  }, [proj, token]);

  useEffect(() => { if (hasParams) match(); }, [match, hasParams]);

  if (!hasParams) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--card-bg)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <Icon name="BookOpen" size={40} style={{ color: "rgba(168,85,247,0.4)", margin: "0 auto 12px" }} />
        <div className="font-semibold text-white mb-2">Укажите параметры строительства</div>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Добавьте тип кровли, фундамента и стен в настройках проекта — AI автоматически подберёт нужные технологические карты
        </p>
        <button onClick={onOpenLibrary}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
          <Icon name="Library" size={14} /> Открыть библиотеку вручную
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Параметры проекта */}
      <div className="flex flex-wrap gap-2 mb-4">
        {proj.roof_type && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)" }}><Icon name="Home" size={11} /> {proj.roof_type}</span>}
        {proj.foundation_type && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}><Icon name="Layers" size={11} /> {proj.foundation_type}</span>}
        {proj.wall_type && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}><Icon name="Square" size={11} /> {proj.wall_type}</span>}
        <button onClick={match} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ml-auto transition-all"
          style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
          <Icon name={loading ? "Loader" : "RefreshCw"} size={11} />
          {loading ? "Подбираю..." : "Обновить"}
        </button>
      </div>

      {/* AI-комментарий */}
      {reply && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-2" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
          <Icon name="Sparkles" size={14} style={{ color: "#A855F7", marginTop: 2, flexShrink: 0 }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{reply}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: "#A855F7" }} />
        </div>
      )}

      {!loading && cards.length === 0 && (
        <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>
          <Icon name="SearchX" size={32} style={{ margin: "0 auto 8px" }} />
          <div className="text-sm">Подходящих карт не найдено. <button onClick={onOpenLibrary} className="underline" style={{ color: "#A855F7" }}>Открыть библиотеку</button></div>
        </div>
      )}

      <div className="space-y-3">
        {cards.map(card => (
          <div key={card.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header */}
            <button className="w-full text-left px-5 py-4 flex items-center gap-3" onClick={() => setExpanded(expanded === card.id ? null : card.id)}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.15)" }}>
                <Icon name={CATEGORY_ICON[card.category] || "FileText"} size={16} style={{ color: "#A855F7" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-white">{card.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>{card.category}</span>
                </div>
                <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{card.description}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {card.materials.length > 0 && <span className="flex items-center gap-1"><Icon name="Package" size={11} />{card.materials.length}</span>}
                {card.content.length > 0 && <span className="flex items-center gap-1"><Icon name="ListOrdered" size={11} />{card.content.length}</span>}
                <Icon name={expanded === card.id ? "ChevronUp" : "ChevronDown"} size={14} />
              </div>
            </button>

            {/* Detail */}
            {expanded === card.id && (
              <div className="border-t px-5 pb-5 pt-4 space-y-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {/* Sub-tabs */}
                <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
                  {(["materials","resources","steps","conditions"] as const).map(s => (
                    <button key={s} onClick={() => setExpandedSection(expandedSection === s ? null : s)}
                      className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                      style={{ background: expandedSection === s ? "rgba(168,85,247,0.3)" : "transparent", color: expandedSection === s ? "#A855F7" : "rgba(255,255,255,0.4)" }}>
                      {s === "materials" ? `Материалы (${card.materials.length})` : s === "resources" ? `Ресурсы (${card.resources.length})` : s === "steps" ? `Этапы (${card.content.length})` : "Приёмка"}
                    </button>
                  ))}
                </div>

                {expandedSection === "materials" && card.materials.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                    <table className="w-full text-xs">
                      <thead><tr style={{ background: "rgba(255,255,255,0.04)" }}>
                        {["Материал","Ед.","Норма расхода","Примечание"].map(h => <th key={h} className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>{h}</th>)}
                      </tr></thead>
                      <tbody>{card.materials.map((m, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <td className="px-3 py-2 text-white font-medium">{m.name}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.unit}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.qty_per_unit > 0 ? m.qty_per_unit : "—"}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.35)" }}>{m.note}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}

                {expandedSection === "resources" && card.resources.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {card.resources.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div>
                          <div className="text-xs text-white">{r.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{r.type}</div>
                        </div>
                        <div className="text-xs font-semibold" style={{ color: "#A855F7" }}>{r.qty} {r.unit}</div>
                      </div>
                    ))}
                  </div>
                )}

                {expandedSection === "steps" && card.content.length > 0 && (
                  <div className="space-y-2">
                    {card.content.map((step, i) => (
                      <div key={i} className="flex gap-3 rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>{step.step}</div>
                        <div>
                          <div className="text-sm font-semibold text-white">{step.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</div>
                          {step.duration && <div className="text-xs mt-1" style={{ color: "#FBBF24" }}>{step.duration}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {expandedSection === "conditions" && (
                  <div className="space-y-3">
                    {card.storage_conditions && (
                      <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                        <div className="text-xs font-semibold mb-1" style={{ color: "#3b82f6" }}>Условия хранения</div>
                        <p className="text-sm whitespace-pre-line" style={{ color: "rgba(255,255,255,0.7)" }}>{card.storage_conditions}</p>
                      </div>
                    )}
                    {card.acceptance_conditions && (
                      <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                        <div className="text-xs font-semibold mb-1" style={{ color: "#22c55e" }}>Требования к приёмке</div>
                        <p className="text-sm whitespace-pre-line" style={{ color: "rgba(255,255,255,0.7)" }}>{card.acceptance_conditions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {cards.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={onOpenLibrary}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Icon name="Library" size={14} /> Открыть полную библиотеку
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AiAssistantTab ──────────────────────────────────────────────────────────

interface AiAnalysis {
  status: string;
  next_steps: string[];
  description: string;
  features: string;
  tag_suggestion: string;
}

interface ChatMsg { role: "user" | "assistant"; content: string; }

function AiAssistantTab({ proj, token, onApply }: {
  proj: Project; token: string;
  onApply: (patch: Partial<{ description: string; features: string; tag: string }>) => void;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [filesAnalysis, setFilesAnalysis] = useState<string | null>(null);
  const [filesAnalysisLoading, setFilesAnalysisLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const analyze = async () => {
    setLoading(true); setAnalysis(null);
    const r = await apiFetch(`${AI_URL}?action=architect_analyze`, {
      method: "POST",
      body: JSON.stringify({
        project: {
          name: proj.name, type: proj.type, area: proj.area, floors: proj.floors,
          rooms: proj.rooms, price: proj.price, tag: proj.tag,
          roof_type: proj.roof_type, foundation_type: proj.foundation_type, wall_type: proj.wall_type,
          description: proj.description, features: proj.features,
          renders_count: (proj.files || []).filter(f => f.file_type === "render").length,
          spec_items_count: 0,
        }
      })
    }, token);
    setLoading(false);
    if (r.ok) setAnalysis(r as AiAnalysis);
  };

  useEffect(() => { analyze(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const applyField = async (field: "description" | "features" | "tag", value: string) => {
    setApplying(field);
    await apiFetch(`${PROJECTS_URL}?action=update`, {
      method: "POST",
      body: JSON.stringify({ project_id: proj.id, [field]: value }),
    }, token);
    setApplying(null);
    setApplied(prev => new Set([...prev, field]));
    onApply({ [field]: value });
  };

  const analyzeFiles = async () => {
    const files = proj.files || [];
    if (files.length === 0) return;
    setFilesAnalysisLoading(true); setFilesAnalysis(null);
    const filesList = files.map(f => `• ${f.file_name} (${f.file_type})`).join("\n");
    const context = `Проект "${proj.name}", ${proj.type}, ${proj.area}м², ${proj.floors} эт. Загруженные файлы:\n${filesList}`;
    const r = await apiFetch(`${AI_URL}?action=chat`, {
      method: "POST",
      body: JSON.stringify({
        messages: [
          { role: "user", content: context },
          { role: "user", content: "Ты — опытный архитектор. На основе списка загруженных файлов проекта определи: какие чертежи уже есть, каких не хватает (план этажей, разрезы, фасады, узлы), и дай краткие рекомендации по спецификации материалов. Ответь структурированно." }
        ],
        role: "architect"
      }),
    }, token);
    setFilesAnalysisLoading(false);
    if (r.reply) setFilesAnalysis(r.reply);
  };

  const sendChat = async () => {
    const msg = input.trim();
    if (!msg || chatLoading) return;
    const context = `Контекст проекта: "${proj.name}", ${proj.type}, ${proj.area}м², ${proj.floors} эт., ${proj.rooms} комн., ${(proj.price/1000000).toFixed(1)}млн₽. Стены: ${proj.wall_type || "не указаны"}. Кровля: ${proj.roof_type || "не указана"}.`;
    const newChat: ChatMsg[] = [...chat, { role: "user", content: msg }];
    setChat(newChat); setInput(""); setChatLoading(true);
    const messagesForApi = [
      { role: "user" as const, content: context },
      ...newChat,
    ];
    const r = await apiFetch(`${AI_URL}?action=chat`, {
      method: "POST",
      body: JSON.stringify({ messages: messagesForApi, role: "architect" }),
    }, token);
    setChatLoading(false);
    if (r.reply) setChat(prev => [...prev, { role: "assistant", content: r.reply }]);
  };

  return (
    <div className="space-y-5">
      {/* Анализ проекта */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,212,255,0.25)" }}>
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(168,85,247,0.08))" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,212,255,0.15)" }}>
              <Icon name="Sparkles" size={18} style={{ color: "var(--neon-cyan)" }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI-анализ проекта</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Автоматический разбор и план действий</p>
            </div>
          </div>
          <button onClick={analyze} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
            <Icon name={loading ? "Loader2" : "RefreshCw"} size={12} className={loading ? "animate-spin" : ""} />
            {loading ? "Анализирую..." : "Обновить"}
          </button>
        </div>

        {loading && (
          <div className="px-5 py-8 text-center">
            <div className="w-8 h-8 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
              style={{ borderTopColor: "var(--neon-cyan)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Анализирую проект «{proj.name}»...
            </p>
          </div>
        )}

        {analysis && !loading && (
          <div className="p-5 space-y-4">
            {/* Статус */}
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl"
              style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}>
              <Icon name="Info" size={14} style={{ color: "var(--neon-cyan)", flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{analysis.status}</p>
            </div>

            {/* Следующие шаги */}
            {analysis.next_steps?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Следующие шаги
                </p>
                <div className="space-y-2">
                  {analysis.next_steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: "rgba(0,212,255,0.15)", color: "var(--neon-cyan)" }}>{i + 1}</div>
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Описание */}
            {analysis.description && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Сгенерированное описание
                  </span>
                  <button
                    onClick={() => applyField("description", analysis.description)}
                    disabled={applying === "description" || applied.has("description")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: applied.has("description") ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.12)", color: applied.has("description") ? "var(--neon-green)" : "var(--neon-cyan)" }}>
                    {applying === "description"
                      ? <><Icon name="Loader2" size={11} className="animate-spin" /> Применяю...</>
                      : applied.has("description")
                      ? <><Icon name="Check" size={11} /> Применено</>
                      : <><Icon name="Download" size={11} /> Применить</>
                    }
                  </button>
                </div>
                <div className="px-4 py-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {analysis.description}
                </div>
              </div>
            )}

            {/* Особенности */}
            {analysis.features && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="px-4 py-2.5 flex items-center justify-between"
                  style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Сгенерированные особенности
                  </span>
                  <button
                    onClick={() => applyField("features", analysis.features)}
                    disabled={applying === "features" || applied.has("features")}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: applied.has("features") ? "rgba(0,255,136,0.15)" : "rgba(0,212,255,0.12)", color: applied.has("features") ? "var(--neon-green)" : "var(--neon-cyan)" }}>
                    {applying === "features"
                      ? <><Icon name="Loader2" size={11} className="animate-spin" /> Применяю...</>
                      : applied.has("features")
                      ? <><Icon name="Check" size={11} /> Применено</>
                      : <><Icon name="Download" size={11} /> Применить</>
                    }
                  </button>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {analysis.features.split("\n").filter(Boolean).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--neon-cyan)" }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Анализ чертежей и спецификаций */}
      {(proj.files || []).length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,255,136,0.2)" }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,212,255,0.05))" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,255,136,0.12)" }}>
                <Icon name="FileSearch" size={18} style={{ color: "var(--neon-green)" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Анализ чертежей и спецификаций</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  AI проверит загруженные файлы и выявит недостающее
                </p>
              </div>
            </div>
            <button onClick={analyzeFiles} disabled={filesAnalysisLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
              <Icon name={filesAnalysisLoading ? "Loader2" : "ScanSearch"} size={12} className={filesAnalysisLoading ? "animate-spin" : ""} />
              {filesAnalysisLoading ? "Читаю..." : "Прочитать"}
            </button>
          </div>
          {filesAnalysisLoading && (
            <div className="px-5 py-8 text-center">
              <div className="w-8 h-8 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
                style={{ borderTopColor: "var(--neon-green)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                Анализирую {(proj.files || []).length} файл(ов)...
              </p>
            </div>
          )}
          {filesAnalysis && !filesAnalysisLoading && (
            <div className="p-5">
              <div className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: "rgba(255,255,255,0.75)" }}>
                {filesAnalysis}
              </div>
              <button
                onClick={() => {
                  setChat(prev => [...prev, { role: "user", content: `Результат анализа чертежей:\n${filesAnalysis}` }]);
                  setInput("Что нужно доработать в первую очередь?");
                }}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                style={{ background: "rgba(168,85,247,0.1)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.2)" }}>
                <Icon name="MessageCircle" size={12} />
                Обсудить в чате
              </button>
            </div>
          )}
          {!filesAnalysis && !filesAnalysisLoading && (
            <div className="px-5 py-5 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              Загружено {(proj.files || []).length} файл(ов) — нажмите «Прочитать», чтобы AI проверил чертежи и спецификации
            </div>
          )}
        </div>
      )}

      {/* Чат с AI */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ background: "rgba(168,85,247,0.08)", borderBottom: "1px solid rgba(168,85,247,0.15)" }}>
          <Icon name="MessageCircle" size={15} style={{ color: "#A855F7" }} />
          <span className="text-sm font-semibold text-white">Чат с AI-ассистентом</span>
        </div>

        <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
          {chat.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Задайте вопрос по проекту</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {["Как улучшить описание?", "Каких чертежей не хватает?", "Что указать в спецификации?"].map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="px-3 py-1.5 rounded-lg text-xs transition-all hover:scale-105"
                    style={{ background: "rgba(168,85,247,0.1)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.2)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={{
                  background: m.role === "user" ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.85)",
                  borderBottomRightRadius: m.role === "user" ? 4 : undefined,
                  borderBottomLeftRadius: m.role === "assistant" ? 4 : undefined,
                }}>
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
                <Icon name="Loader2" size={14} className="animate-spin" style={{ color: "#A855F7" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Спросите что-нибудь о проекте..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.25)" }}
            />
            <button onClick={sendChat} disabled={chatLoading || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-40"
              style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>
              <Icon name="Send" size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProjectDetail ─────────────────────────────────────────────────────────────

function ProjectDetail({ project, token, onBack, onRefresh }: { project: Project; token: string; onBack: () => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<"ai" | "info" | "files" | "spec" | "tech">("ai");
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
    { id: "ai", label: "AI-ассистент", icon: "Sparkles" },
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
        {TABS.map(t => {
          const isAi = t.id === "ai";
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: isActive ? (isAi ? "var(--neon-cyan)" : "var(--neon-orange)") : "transparent",
                color: isActive ? (isAi ? "#0a0d14" : "#fff") : "rgba(255,255,255,0.5)",
                boxShadow: isActive ? (isAi ? "0 0 15px rgba(0,212,255,0.35)" : "0 0 15px rgba(255,107,26,0.3)") : "none",
              }}>
              <Icon name={t.icon} size={14} />
              {t.label}
              {isAi && !isActive && (
                <span className="ml-1 w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--neon-cyan)" }} />
              )}
              {"count" in t && t.count ? (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: isActive ? "rgba(255,255,255,0.25)" : "rgba(255,107,26,0.3)", color: isActive ? "#fff" : "var(--neon-orange)", fontSize: 10 }}>
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
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
                    background: selectedFileType === ft.id ? (ft.id === "project_full" ? "var(--neon-cyan)" : "var(--neon-orange)") : "rgba(255,255,255,0.06)",
                    color: selectedFileType === ft.id ? "#fff" : "rgba(255,255,255,0.5)",
                    border: ft.id === "project_full" && selectedFileType !== ft.id ? "1px dashed rgba(0,212,255,0.3)" : "1px solid transparent",
                  }}>
                  <Icon name={ft.icon} size={12} />
                  {ft.label}
                </button>
              ))}
            </div>

            {/* Подсказка форматов */}
            {(() => {
              const ft = FILE_TYPES.find(f => f.id === selectedFileType);
              const formats = ft?.accept.split(",").map(s => s.trim().replace("image/*","JPG/PNG").replace(".",".").toUpperCase()).join(" · ");
              const isProject = selectedFileType === "project_full";
              return (
                <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }}>
                  {isProject ? (
                    <span>📦 Архив всего проекта — ZIP, RAR или отдельный файл любого формата</span>
                  ) : (
                    <span>Допустимые форматы: <span style={{ color: "rgba(255,255,255,0.55)" }}>{formats}</span></span>
                  )}
                </div>
              );
            })()}

            <input ref={fileRef} type="file"
              accept={FILE_TYPES.find(f => f.id === selectedFileType)?.accept ?? "image/*"}
              className="hidden"
              onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={selectedFileType === "project_full"
                ? { background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.3)" }
                : { background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name={uploading ? "Loader" : (selectedFileType === "project_full" ? "FolderArchive" : "Upload")} size={15} />
              {uploading
                ? `Загрузка... ${uploadProgress}%`
                : selectedFileType === "project_full"
                  ? "Загрузить весь проект"
                  : selectedFileType === "render"
                    ? "Выбрать изображение"
                    : "Выбрать файл"}
            </button>
            {uploading && uploadProgress > 0 && (
              <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: selectedFileType === "project_full" ? "var(--neon-cyan)" : "var(--neon-orange)" }} />
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
                    {file.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                      <img src={file.file_url} alt={file.file_name} className="w-full h-32 object-cover" />
                    ) : (
                      <a href={file.file_url} target="_blank" rel="noreferrer"
                        className="flex flex-col items-center justify-center h-32 gap-2"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        {file.file_url.match(/\.pdf$/i) && <Icon name="FileText" size={28} style={{ color: "#ef4444" }} />}
                        {file.file_url.match(/\.(xlsx|xls|csv)$/i) && <Icon name="FileSpreadsheet" size={28} style={{ color: "#22c55e" }} />}
                        {file.file_url.match(/\.(dwg|dxf)$/i) && <Icon name="Pencil" size={28} style={{ color: "var(--neon-cyan)" }} />}
                        {file.file_url.match(/\.(zip|rar|7z)$/i) && <Icon name="FolderArchive" size={28} style={{ color: "var(--neon-cyan)" }} />}
                        {!file.file_url.match(/\.(pdf|xlsx|xls|csv|dwg|dxf|zip|rar|7z)$/i) && <Icon name="File" size={28} style={{ color: "var(--neon-orange)" }} />}
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

      {/* ── AI-ассистент ── */}
      {tab === "ai" && (
        <AiAssistantTab
          proj={proj}
          token={token}
          onApply={patch => setProj(p => ({ ...p, ...patch }))}
        />
      )}

      {/* ── Тех. карты ── */}
      {tab === "tech" && (
        <TechTab proj={proj} token={token} onOpenLibrary={() => setShowTechCards(true)} />
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
    roof_type: "", foundation_type: "", wall_type: "",
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
    setForm({ name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4, price: 5000000, tag: "Новинка", tag_color: "#FF6B1A", description: "", features: "", is_active: true, roof_type: "", foundation_type: "", wall_type: "" });
    setEditingId(null); setShowForm(true); setMsg("");
  };

  const openEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({ name: p.name, type: p.type, area: p.area, floors: p.floors, rooms: p.rooms, price: p.price, tag: p.tag, tag_color: p.tag_color, description: p.description, features: p.features, is_active: p.is_active, roof_type: p.roof_type || "", foundation_type: p.foundation_type || "", wall_type: p.wall_type || "" });
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
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип кровли</label>
              <select value={form.roof_type} onChange={e => setForm(p => ({ ...p, roof_type: e.target.value }))}
                className={inp} style={{ ...inpSty, background: "#1a1f2e" }}>
                <option value="">— не выбрано —</option>
                {["Металлочерепица","Профнастил","Мягкая черепица","Керамическая черепица","Фальцевая кровля","Ондулин","Плоская кровля"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип фундамента</label>
              <select value={form.foundation_type} onChange={e => setForm(p => ({ ...p, foundation_type: e.target.value }))}
                className={inp} style={{ ...inpSty, background: "#1a1f2e" }}>
                <option value="">— не выбрано —</option>
                {["Ленточный монолитный","Плитный (УШП)","Свайно-ростверковый","Столбчатый","Свайный (винтовые сваи)"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип стен</label>
              <select value={form.wall_type} onChange={e => setForm(p => ({ ...p, wall_type: e.target.value }))}
                className={inp} style={{ ...inpSty, background: "#1a1f2e" }}>
                <option value="">— не выбрано —</option>
                {["Кирпич","Газобетон","Каркасные стены","СИП-панели","Монолитный бетон","Брус","Бревно"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
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
            <label className="flex items-center gap-2 ml-auto cursor-pointer select-none">
              <div
                onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: form.is_active ? "var(--neon-green)" : "rgba(255,255,255,0.15)", cursor: "pointer" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                  style={{ left: form.is_active ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
              </div>
              <span className="text-sm font-medium" style={{ color: form.is_active ? "var(--neon-green)" : "rgba(255,255,255,0.4)" }}>
                {form.is_active ? "Опубликован на сайте" : "Черновик (не виден)"}
              </span>
            </label>
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