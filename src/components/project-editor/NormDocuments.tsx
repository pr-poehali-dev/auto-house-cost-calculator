import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { AI_URL, apiFetch } from "@/pages/staff/materials-types";

const DOC_TYPES: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  sp:     { label: "СП (Свод правил)",      icon: "📘", color: "#3B82F6", desc: "СП 20.13330, СП 70.13330..." },
  gost:   { label: "ГОСТ",                  icon: "📗", color: "#10B981", desc: "ГОСТ Р, ГОСТ..." },
  snip:   { label: "СНиП",                  icon: "📙", color: "#F59E0B", desc: "СНиП 2.03.01, СНиП 3.04.01..." },
  pp:     { label: "Постановление Прав-ва",  icon: "📕", color: "#EF4444", desc: "ПП РФ №87, №1521..." },
  letter: { label: "Письмо/Разъяснение",    icon: "📄", color: "#8B5CF6", desc: "Письма Минстроя, Росстандарта" },
  norm:   { label: "Норма расхода",         icon: "📊", color: "#00D4FF", desc: "ГЭСН, ФЕР, МДС..." },
  other:  { label: "Прочее",               icon: "📎", color: "rgba(255,255,255,0.4)", desc: "Иные нормативы" },
};

interface NormDoc {
  id: number;
  title: string;
  doc_type: string;
  doc_number: string;
  content: string;
  file_url: string;
  file_name: string;
  created_at: string;
}

const CHUNK_SIZE = 400 * 1024;

export default function NormDocuments({ token }: { token: string }) {
  const [norms, setNorms] = useState<NormDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [form, setForm] = useState({ title: "", doc_type: "sp", doc_number: "", content: "" });
  const [filterType, setFilterType] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => { loadNorms(); }, []);

  const loadNorms = async () => {
    setLoading(true);
    const r = await apiFetch(`${AI_URL}?action=norms_list`, {}, token);
    if (r.norms) setNorms(r.norms);
    setLoading(false);
  };

  const saveText = async () => {
    if (!form.title.trim() && !form.content.trim()) return;
    const r = await apiFetch(`${AI_URL}?action=norm_add`, {
      method: "POST",
      body: JSON.stringify(form),
    }, token);
    if (r.ok) {
      setShowForm(false);
      setForm({ title: "", doc_type: "sp", doc_number: "", content: "" });
      loadNorms();
    }
  };

  const uploadFile = async (file: File) => {
    if (!form.title.trim()) {
      alert("Укажите название документа перед загрузкой файла");
      return;
    }
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
        setUploadProgress(`Загружаю... ${pct}%`);

        const r = await apiFetch(`${AI_URL}?action=norm_upload_chunk`, {
          method: "POST",
          body: JSON.stringify({
            chunk: chunk_b64, chunk_index: i, total_chunks: totalChunks,
            upload_id: uploadSessId, file_name: file.name,
            title: form.title, doc_type: form.doc_type, doc_number: form.doc_number,
          }),
        }, token);

        if (!r.ok && r.error) { setUploadProgress("Ошибка загрузки"); setUploading(false); return; }
        if (r.upload_id && !uploadSessId) uploadSessId = String(r.upload_id);
        if (!r.done) continue;

        setUploadProgress("");
        setUploading(false);
        setShowForm(false);
        setForm({ title: "", doc_type: "sp", doc_number: "", content: "" });
        setPendingFile(null);
        loadNorms();
        return;
      }
    } catch (e) {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const deleteNorm = async (id: number) => {
    if (!confirm("Удалить норматив?")) return;
    await apiFetch(`${AI_URL}?action=norm_delete`, {
      method: "POST",
      body: JSON.stringify({ norm_id: id }),
    }, token);
    setNorms(prev => prev.filter(n => n.id !== id));
  };

  const byType = (t: string) => norms.filter(n => t === "all" || n.doc_type === t);
  const types = ["all", ...Array.from(new Set(norms.map(n => n.doc_type)))];

  return (
    <div>
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#A855F7" }}>База знаний AI</div>
          <h3 className="font-semibold text-white">Нормативные документы</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            СП, ГОСТ, СНиП, ПП РФ — AI учитывает их при анализе документации
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
          <Icon name="Plus" size={16} />
          Добавить
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="mb-5 p-4 rounded-2xl space-y-3" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <div className="text-sm font-semibold text-white mb-2">Новый норматив</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Название *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="СП 20.13330.2017 Нагрузки и воздействия"
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Номер документа</label>
              <input value={form.doc_number} onChange={e => setForm(p => ({ ...p, doc_number: e.target.value }))}
                placeholder="СП 20.13330.2017"
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Тип документа</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(DOC_TYPES).map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, doc_type: k }))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: form.doc_type === k ? `${v.color}20` : "rgba(255,255,255,0.04)",
                    color: form.doc_type === k ? v.color : "rgba(255,255,255,0.5)",
                    border: `1px solid ${form.doc_type === k ? `${v.color}40` : "rgba(255,255,255,0.07)"}`,
                  }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>
              Ключевые выдержки / нормы расхода (вставьте текст из документа)
            </label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              rows={5} placeholder="Вставьте сюда ключевые пункты, нормы, таблицы из документа...&#10;&#10;Например:&#10;п. 6.1 — Нагрузка от снегового покрова...&#10;Таблица 1 — Нормативное значение..."
              className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none resize-none font-mono"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Загрузка PDF */}
          <div>
            <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>
              Или загрузите PDF-файл (текст извлечётся автоматически)
            </label>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.csv" className="hidden"
                onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); }} />
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name="Upload" size={14} />
                {pendingFile ? pendingFile.name : "Выбрать файл"}
              </button>
              {pendingFile && (
                <button onClick={() => uploadFile(pendingFile)} disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>
                  <Icon name={uploading ? "Loader" : "Upload"} size={14}
                    style={{ animation: uploading ? "spin 1s linear infinite" : "none" }} />
                  {uploadProgress || "Загрузить PDF"}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={saveText} disabled={!form.title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
              style={{ background: "#A855F7", color: "#fff" }}>
              <Icon name="Save" size={14} /> Сохранить текст
            </button>
            <button onClick={() => { setShowForm(false); setForm({ title: "", doc_type: "sp", doc_number: "", content: "" }); setPendingFile(null); }}
              className="px-4 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Пояснение */}
      <div className="mb-4 p-3 rounded-xl flex items-start gap-3" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
        <Icon name="Lightbulb" size={16} style={{ color: "#A855F7", flexShrink: 0, marginTop: 1 }} />
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Добавленные нормативы автоматически используются AI при анализе страниц документации.
          Чем больше нормативов — тем точнее AI определяет разделы и объёмы работ.
        </div>
      </div>

      {/* Фильтр по типам */}
      {norms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {types.map(t => {
            const info = t === "all" ? { label: "Все", icon: "📚", color: "rgba(255,255,255,0.5)" } : DOC_TYPES[t] || { label: t, icon: "📎", color: "rgba(255,255,255,0.4)" };
            const count = t === "all" ? norms.length : norms.filter(n => n.doc_type === t).length;
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterType === t ? `${info.color}20` : "rgba(255,255,255,0.04)",
                  color: filterType === t ? info.color : "rgba(255,255,255,0.4)",
                  border: `1px solid ${filterType === t ? `${info.color}40` : "rgba(255,255,255,0.07)"}`,
                }}>
                <span>{info.icon}</span> {info.label} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Список нормативов */}
      {loading ? (
        <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : byType(filterType).length > 0 ? (
        <div className="space-y-2">
          {byType(filterType).map(norm => {
            const dt = DOC_TYPES[norm.doc_type] || DOC_TYPES.other;
            const expanded = expandedId === norm.id;
            return (
              <div key={norm.id} className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpandedId(expanded ? null : norm.id)}>
                  <span className="text-lg flex-shrink-0">{dt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{norm.title}</span>
                      {norm.doc_number && (
                        <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: `${dt.color}15`, color: dt.color }}>
                          {norm.doc_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <span>{dt.label}</span>
                      {norm.file_url && <span style={{ color: "var(--neon-cyan)" }}>PDF</span>}
                      {norm.content && <span>{norm.content.length} симв.</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); deleteNorm(norm.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      style={{ color: "#ef4444" }}>
                      <Icon name="Trash2" size={13} />
                    </button>
                    {norm.file_url && (
                      <a href={norm.file_url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10"
                        style={{ color: "rgba(255,255,255,0.4)" }}>
                        <Icon name="Download" size={13} />
                      </a>
                    )}
                    <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </div>
                </div>
                {expanded && norm.content && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="p-3 rounded-xl text-xs font-mono leading-relaxed"
                      style={{ background: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.5)", maxHeight: 200, overflowY: "auto" }}>
                      {norm.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center rounded-2xl" style={{ border: "2px dashed rgba(168,85,247,0.15)" }}>
          <div className="text-3xl mb-3">📚</div>
          <div className="text-sm font-medium text-white mb-1">База нормативов пуста</div>
          <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Добавьте СП, ГОСТ, СНиП — AI будет учитывать их при анализе документов
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["СП 70.13330.2022", "ГОСТ Р 21.1101", "СНиП 2.03.01-84", "ПП РФ №87"].map(n => (
              <span key={n} className="text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(168,85,247,0.08)", color: "rgba(168,85,247,0.6)" }}>{n}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
