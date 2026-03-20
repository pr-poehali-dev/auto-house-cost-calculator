import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const TTK_URL = "https://functions.poehali.dev/aa8514d2-9f4a-46fc-80af-a91de8aa4b62";
const CHUNK = 3 * 1024 * 1024;

interface TechCard {
  id: number;
  title: string;
  category: string;
  work_type: string;
  description: string;
  tags: string[];
  materials: { name: string; unit: string; qty_per_unit: number; note: string }[];
  resources: { name: string; type: string; qty: number; unit: string }[];
  storage_conditions: string;
  acceptance_conditions: string;
  content: { step: number; name: string; desc: string; duration: string }[];
  file_url: string;
  file_name: string;
  parse_status: string;
  created_at: string;
}

function apiFetch(url: string, opts: RequestInit = {}, token: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": token,
      ...(opts.headers || {}),
    },
  }).then(r => r.json());
}

const CATEGORIES = ["Кровля","Стены","Фундамент","Полы","Отделка","Электрика","Сантехника","Инженерия","Окна и двери","Прочее"];

export default function TechCardsDB({ token }: { token: string }) {
  const [cards, setCards] = useState<TechCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Все");
  const [selected, setSelected] = useState<TechCard | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle"|"uploading"|"parsing"|"done"|"error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [parsed, setParsed] = useState<Partial<TechCard> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`${TTK_URL}?action=list`, {}, token)
      .then(r => { setCards(r.cards || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const cats = ["Все", ...Array.from(new Set(cards.map(c => c.category)))];
  const filtered = cards.filter(c => {
    const matchCat = filterCat === "Все" || c.category === filterCat;
    const q = search.toLowerCase();
    const matchSearch = !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadStatus("uploading");
    setUploadMsg("Загружаю файл...");
    setParsed(null);

    try {
      const pre = await apiFetch(`${TTK_URL}?action=presigned`, {
        method: "POST",
        body: JSON.stringify({ file_name: file.name }),
      }, token);

      if (!pre.presigned_url) {
        setUploadStatus("error");
        setUploadMsg(pre.error || "Ошибка получения ссылки");
        setUploading(false);
        return;
      }

      await fetch(pre.presigned_url, { method: "PUT", body: file });

      setUploadStatus("parsing");
      setUploadMsg("AI распознаёт технологическую карту...");

      const r = await apiFetch(`${TTK_URL}?action=upload_parse`, {
        method: "POST",
        body: JSON.stringify({ s3_key: pre.s3_key, file_name: file.name }),
      }, token);

      if (r.ok && r.parsed) {
        setParsed({ ...r.parsed, file_url: r.file_url, file_name: r.file_name, parse_status: "ai", source_text: r.source_text });
        setUploadStatus("done");
        setUploadMsg("Распознано! Проверьте и сохраните карту.");
      } else {
        setUploadStatus("error");
        setUploadMsg(r.error || "Не удалось распознать файл");
      }
    } catch (e) {
      setUploadStatus("error");
      setUploadMsg(String(e));
    }
    setUploading(false);
  };

  const saveCard = async () => {
    if (!parsed) return;
    setSaving(true);
    const r = await apiFetch(`${TTK_URL}?action=save`, {
      method: "POST",
      body: JSON.stringify(parsed),
    }, token);
    setSaving(false);
    if (r.ok) {
      setShowUpload(false);
      setParsed(null);
      setUploadStatus("idle");
      load();
    }
  };

  const deleteCard = async (id: number) => {
    if (!confirm("Удалить карту?")) return;
    await fetch(`${TTK_URL}?action=delete&id=${id}`, {
      method: "DELETE",
      headers: { "X-Auth-Token": token },
    });
    setSelected(null);
    load();
  };

  const statusColor = (s: string) => s === "ai" ? "#22c55e" : s === "ocr" ? "#3b82f6" : "rgba(255,255,255,0.3)";
  const statusLabel = (s: string) => s === "ai" ? "AI" : s === "ocr" ? "OCR" : "Вручную";

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#FBBF24" }}>Справочник</div>
          <h2 className="font-display text-2xl font-bold text-white">Технологические карты</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Загрузите ТТК — AI извлечёт материалы, ресурсы и условия</p>
        </div>
        <button onClick={() => { setShowUpload(true); setUploadStatus("idle"); setParsed(null); setUploadMsg(""); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "#FBBF24", color: "#000" }}>
          <Icon name="Upload" size={16} /> Загрузить ТТК
        </button>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-lg text-white">Загрузка технологической карты</h3>
              <button onClick={() => setShowUpload(false)} style={{ color: "rgba(255,255,255,0.4)" }}><Icon name="X" size={20} /></button>
            </div>

            {uploadStatus === "idle" && (
              <div
                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
                style={{ borderColor: "rgba(251,191,36,0.3)" }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
              >
                <Icon name="FileUp" size={40} className="mx-auto mb-3" style={{ color: "#FBBF24" }} />
                <div className="text-white font-semibold mb-1">Перетащите файл или нажмите</div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>PDF, TXT — текстовые и сканы</div>
                <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
              </div>
            )}

            {(uploadStatus === "uploading" || uploadStatus === "parsing") && (
              <div className="text-center py-10">
                <div className="w-12 h-12 border-2 border-white/10 rounded-full mx-auto mb-4 animate-spin"
                  style={{ borderTopColor: "#FBBF24" }} />
                <div className="text-white font-semibold">{uploadMsg}</div>
                {uploadStatus === "parsing" && (
                  <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Обычно занимает 15–40 секунд</div>
                )}
              </div>
            )}

            {uploadStatus === "error" && (
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <div className="flex items-center gap-2 text-red-400 font-semibold mb-1"><Icon name="AlertCircle" size={16} /> Ошибка</div>
                <div className="text-sm text-red-300">{uploadMsg}</div>
                <button onClick={() => { setUploadStatus("idle"); setUploadMsg(""); }} className="mt-3 text-sm underline text-red-400">Попробовать снова</button>
              </div>
            )}

            {uploadStatus === "done" && parsed && (
              <div>
                <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <Icon name="CheckCircle" size={16} style={{ color: "#22c55e" }} />
                  <span className="text-sm" style={{ color: "#22c55e" }}>{uploadMsg}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Название</label>
                    <input value={parsed.title || ""} onChange={e => setParsed(p => ({ ...p, title: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Категория</label>
                      <select value={parsed.category || ""} onChange={e => setParsed(p => ({ ...p, category: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Тип работы</label>
                      <input value={parsed.work_type || ""} onChange={e => setParsed(p => ({ ...p, work_type: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Описание</label>
                    <textarea value={parsed.description || ""} onChange={e => setParsed(p => ({ ...p, description: e.target.value }))}
                      rows={2} className="w-full rounded-lg px-3 py-2 text-sm text-white resize-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Теги (через запятую)</label>
                    <input value={(parsed.tags || []).join(", ")} onChange={e => setParsed(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>

                  {/* Материалы */}
                  {(parsed.materials || []).length > 0 && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Материалы ({parsed.materials!.length} позиций)
                      </label>
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table className="w-full text-xs">
                          <thead><tr style={{ background: "rgba(255,255,255,0.04)" }}>
                            <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Материал</th>
                            <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Ед.</th>
                            <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Норма</th>
                          </tr></thead>
                          <tbody>{parsed.materials!.map((m, i) => (
                            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                              <td className="px-3 py-2 text-white">{m.name}</td>
                              <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.unit}</td>
                              <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.qty_per_unit}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Ресурсы */}
                  {(parsed.resources || []).length > 0 && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Ресурсы ({parsed.resources!.length} позиций)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {parsed.resources!.map((r, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                            {r.name} — {r.qty} {r.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsed.storage_conditions && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Условия хранения</label>
                      <div className="text-sm rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)" }}>{parsed.storage_conditions}</div>
                    </div>
                  )}
                  {parsed.acceptance_conditions && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Условия приёмки</label>
                      <div className="text-sm rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)" }}>{parsed.acceptance_conditions}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-5">
                  <button onClick={saveCard} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: "#FBBF24", color: "#000", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "Сохраняю..." : "Сохранить в справочник"}
                  </button>
                  <button onClick={() => { setShowUpload(false); setParsed(null); setUploadStatus("idle"); }}
                    className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>{selected.category}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>{selected.work_type}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `rgba(34,197,94,0.1)`, color: statusColor(selected.parse_status) }}>{statusLabel(selected.parse_status)}</span>
                </div>
                <h3 className="font-display font-bold text-xl text-white">{selected.title}</h3>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{selected.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => deleteCard(selected.id)} className="p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  <Icon name="Trash2" size={16} />
                </button>
                <button onClick={() => setSelected(null)} style={{ color: "rgba(255,255,255,0.4)" }}><Icon name="X" size={20} /></button>
              </div>
            </div>

            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {selected.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>#{t}</span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">
              {/* Материалы */}
              {selected.materials.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Package" size={15} style={{ color: "#FBBF24" }} />
                    <span className="text-sm font-semibold text-white">Материалы</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    <table className="w-full text-xs">
                      <thead><tr style={{ background: "rgba(255,255,255,0.04)" }}>
                        <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Наименование</th>
                        <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Ед.</th>
                        <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Норма расхода</th>
                        <th className="text-left px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>Примечание</th>
                      </tr></thead>
                      <tbody>{selected.materials.map((m, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <td className="px-3 py-2 text-white">{m.name}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.unit}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.5)" }}>{m.qty_per_unit}</td>
                          <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.4)" }}>{m.note}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ресурсы */}
              {selected.resources.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Wrench" size={15} style={{ color: "#FBBF24" }} />
                    <span className="text-sm font-semibold text-white">Ресурсы</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.resources.map((r, i) => (
                      <div key={i} className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-sm text-white">{r.name}</span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.qty} {r.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Этапы */}
              {selected.content.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="ListOrdered" size={15} style={{ color: "#FBBF24" }} />
                    <span className="text-sm font-semibold text-white">Этапы работ</span>
                  </div>
                  <div className="space-y-2">
                    {selected.content.map((step, i) => (
                      <div key={i} className="flex gap-3 rounded-lg p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>{step.step}</div>
                        <div>
                          <div className="text-sm font-semibold text-white">{step.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</div>
                          {step.duration && <div className="text-xs mt-1" style={{ color: "rgba(251,191,36,0.7)" }}>{step.duration}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Условия */}
              <div className="grid grid-cols-1 gap-3">
                {selected.storage_conditions && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="Archive" size={13} style={{ color: "#3b82f6" }} />
                      <span className="text-xs font-semibold" style={{ color: "#3b82f6" }}>Условия хранения</span>
                    </div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{selected.storage_conditions}</p>
                  </div>
                )}
                {selected.acceptance_conditions && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name="ClipboardCheck" size={13} style={{ color: "#22c55e" }} />
                      <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>Условия приёмки</span>
                    </div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{selected.acceptance_conditions}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по картам..."
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: filterCat === c ? "#FBBF24" : "rgba(255,255,255,0.05)", color: filterCat === c ? "#000" : "rgba(255,255,255,0.5)" }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: "#FBBF24" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Icon name="FileSearch" size={40} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {cards.length === 0 ? "Справочник пуст — загрузите первую ТТК" : "Ничего не найдено"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setSelected(c)} className="text-left rounded-2xl p-4 transition-all hover:scale-[1.01]"
              style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>{c.category}</span>
                <span className="text-xs" style={{ color: statusColor(c.parse_status) }}>{statusLabel(c.parse_status)}</span>
              </div>
              <div className="font-semibold text-white text-sm mb-1 line-clamp-2">{c.title}</div>
              <div className="text-xs mb-3 line-clamp-2" style={{ color: "rgba(255,255,255,0.4)" }}>{c.description}</div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {c.materials.length > 0 && <span className="flex items-center gap-1"><Icon name="Package" size={11} />{c.materials.length} мат.</span>}
                {c.resources.length > 0 && <span className="flex items-center gap-1"><Icon name="Wrench" size={11} />{c.resources.length} рес.</span>}
                {c.content.length > 0 && <span className="flex items-center gap-1"><Icon name="ListOrdered" size={11} />{c.content.length} эт.</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}