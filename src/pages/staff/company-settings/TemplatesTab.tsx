import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  COMPANY_URL,
  INP,
  INP_STYLE,
  LABEL_STYLE,
  TPL_TYPE_LABELS,
  TPL_TYPE_COLORS,
  apiFetch,
  focusOrange,
  blurOrange,
  fileToBase64,
  ContractTemplate,
} from "./shared";

// ─── TemplatesTab ─────────────────────────────────────────────────────────────
function TemplatesTab({
  companyId,
  token,
}: {
  companyId: number;
  token: string;
}) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: "",
    type: "construction",
    content_text: "",
    file_name: "",
    file_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=templates&company_id=${companyId}`,
        {},
        token
      );
      setTemplates(res.templates || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [companyId, token]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleUploadFile = async (file: File) => {
    setUploadingFile(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await apiFetch(
        `${COMPANY_URL}?action=upload_template_file`,
        {
          method: "POST",
          body: JSON.stringify({ file_name: file.name, file_base64: base64 }),
        },
        token
      );
      if (res.cdn_url) {
        setNewTpl((p) => ({ ...p, file_name: file.name, file_url: res.cdn_url }));
      }
    } catch {
      setError("Ошибка загрузки файла");
    }
    setUploadingFile(false);
  };

  const handleSave = async () => {
    if (!newTpl.name.trim()) {
      setError("Введите название шаблона");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=save_template`,
        {
          method: "POST",
          body: JSON.stringify({ ...newTpl, company_id: companyId }),
        },
        token
      );
      if (res.ok) {
        setShowForm(false);
        setNewTpl({ name: "", type: "construction", content_text: "", file_name: "", file_url: "" });
        loadTemplates();
      } else {
        setError(res.error || "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(
        `${COMPANY_URL}?action=delete_template&id=${id}`,
        { method: "DELETE" },
        token
      );
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // ignore
    }
    setDeletingId(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
          Шаблоны договоров
        </span>
        <button
          onClick={() => {
            setShowForm(true);
            setError("");
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.3)",
            color: "#FBBF24",
          }}
        >
          <Icon name="Plus" size={15} />
          Добавить шаблон
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Icon name="Loader2" size={24} className="animate-spin" style={{ color: "#FBBF24" }} />
        </div>
      ) : templates.length === 0 && !showForm ? (
        <div
          className="rounded-xl py-10 flex flex-col items-center gap-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <Icon name="FileText" size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Шаблоны договоров не добавлены
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl p-4 flex items-center gap-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-2 h-10 rounded-full flex-shrink-0"
                style={{ background: TPL_TYPE_COLORS[tpl.type] || "#FBBF24" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{tpl.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {TPL_TYPE_LABELS[tpl.type] || tpl.type}
                  {tpl.file_name && ` · ${tpl.file_name}`}
                </p>
              </div>
              {tpl.file_url && (
                <a
                  href={tpl.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-white/10 transition-all"
                  title="Скачать"
                >
                  <Icon name="Download" size={15} style={{ color: "rgba(255,255,255,0.5)" }} />
                </a>
              )}
              <button
                onClick={() => handleDelete(tpl.id)}
                disabled={deletingId === tpl.id}
                className="p-2 rounded-lg hover:bg-red-500/10 transition-all"
                title="Удалить"
              >
                {deletingId === tpl.id ? (
                  <Icon name="Loader2" size={15} className="animate-spin" style={{ color: "#ef4444" }} />
                ) : (
                  <Icon name="Trash2" size={15} style={{ color: "rgba(239,68,68,0.6)" }} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div
          className="rounded-2xl p-5 flex flex-col gap-4 mt-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(251,191,36,0.2)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: "#FBBF24" }}>
              Новый шаблон
            </span>
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
            >
              <Icon name="X" size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
                Название *
              </label>
              <input
                className={INP}
                style={{ ...INP_STYLE }}
                placeholder="Договор подряда №..."
                value={newTpl.name}
                onChange={(e) => setNewTpl((p) => ({ ...p, name: e.target.value }))}
                onFocus={focusOrange}
                onBlur={blurOrange}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
                Тип
              </label>
              <select
                className={INP}
                style={{ ...INP_STYLE }}
                value={newTpl.type}
                onChange={(e) => setNewTpl((p) => ({ ...p, type: e.target.value }))}
                onFocus={focusOrange}
                onBlur={blurOrange}
              >
                {Object.entries(TPL_TYPE_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Текст шаблона
            </label>
            <textarea
              rows={5}
              className={INP + " resize-none"}
              style={{ ...INP_STYLE }}
              placeholder="Текст договора с переменными {{client_name}}, {{amount}} и т.д."
              value={newTpl.content_text}
              onChange={(e) => setNewTpl((p) => ({ ...p, content_text: e.target.value }))}
              onFocus={focusOrange}
              onBlur={blurOrange}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Файл шаблона (docx, pdf)
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingFile}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {uploadingFile ? (
                  <Icon name="Loader2" size={15} className="animate-spin" />
                ) : (
                  <Icon name="Paperclip" size={15} />
                )}
                Прикрепить файл
              </button>
              {newTpl.file_name && (
                <span className="text-xs" style={{ color: "rgba(0,212,255,0.8)" }}>
                  {newTpl.file_name}
                </span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".docx,.doc,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile(f);
              }}
            />
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                color: "#111",
              }}
            >
              {saving ? (
                <Icon name="Loader2" size={15} className="animate-spin" />
              ) : (
                <Icon name="Save" size={15} />
              )}
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatesTab;
