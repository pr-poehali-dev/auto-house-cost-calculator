import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const COMPANY_URL = "https://functions.poehali.dev/0796a927-18d1-46be-bd26-3bbcfe93738d";

interface CompanySettingsProps {
  token: string;
}

interface CompanySettingsData {
  company_name?: string;
  full_name?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legal_address?: string;
  actual_address?: string;
  phone?: string;
  email?: string;
  website?: string;
  director_name?: string;
  director_title?: string;
  bank_name?: string;
  bik?: string;
  account_number?: string;
  corr_account?: string;
  logo_url?: string;
  stamp_url?: string;
  signature_url?: string;
}

interface ContractTemplate {
  id: number;
  name: string;
  type: string;
  content_text?: string;
  file_name?: string;
  file_url?: string;
  created_at?: string;
}

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...(opts.headers || {}),
    },
  }).then((r) => r.json());
}

const INP =
  "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all";
const INP_STYLE = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};
const LABEL_STYLE = {
  color: "rgba(255,255,255,0.4)",
};

const TPL_TYPE_LABELS: Record<string, string> = {
  construction: "Строительство",
  supply: "Поставка",
  service: "Услуги",
};
const TPL_TYPE_COLORS: Record<string, string> = {
  construction: "#FBBF24",
  supply: "#00D4FF",
  service: "#00FF88",
};

function focusOrange(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--neon-orange)";
}
function blurOrange(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,0.1)";
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({
  label,
  field,
  currentUrl,
  action,
  token,
  onUploaded,
}: {
  label: string;
  field: string;
  currentUrl?: string;
  action: string;
  token: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setPreview(currentUrl || "");
  }, [currentUrl]);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=${action}`,
        { method: "POST", body: JSON.stringify({ file_name: file.name }) },
        token
      );
      if (res.error) { setError(res.error); setUploading(false); return; }
      await fetch(res.presigned_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      });
      setPreview(res.cdn_url);
      onUploaded(res.cdn_url);
    } catch (e) {
      setError("Ошибка загрузки");
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
        {label}
      </label>
      <div
        className="rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-yellow-400/50 relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "2px dashed rgba(255,255,255,0.12)",
          minHeight: 140,
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="max-h-28 max-w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <Icon name="Upload" size={28} style={{ color: "rgba(255,255,255,0.25)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
              Нажмите для загрузки
            </span>
          </div>
        )}
        {uploading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(17,21,32,0.85)" }}
          >
            <Icon name="Loader2" size={24} className="animate-spin" style={{ color: "#FBBF24" }} />
          </div>
        )}
      </div>
      {preview && (
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{ color: "#FBBF24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}
        >
          Заменить
        </button>
      )}
      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CompanySettings({ token }: CompanySettingsProps) {
  const [tab, setTab] = useState<"details" | "images" | "templates">("details");
  const [form, setForm] = useState<CompanySettingsData>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [showAddTpl, setShowAddTpl] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: "",
    type: "construction",
    content_text: "",
    file_name: "",
    file_url: "",
  });
  const tplFileRef = useRef<HTMLInputElement>(null);
  const [tplUploading, setTplUploading] = useState(false);

  // load settings
  useEffect(() => {
    apiFetch(`${COMPANY_URL}?action=settings`).then((r) => {
      if (r.settings) setForm(r.settings);
    });
  }, []);

  // load templates
  useEffect(() => {
    if (tab === "templates") {
      setTplLoading(true);
      apiFetch(`${COMPANY_URL}?action=templates`).then((r) => {
        setTemplates(r.templates || []);
        setTplLoading(false);
      });
    }
  }, [tab]);

  const set = (k: keyof CompanySettingsData, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg("");
    const res = await apiFetch(
      `${COMPANY_URL}?action=save_settings`,
      { method: "POST", body: JSON.stringify(form) },
      token
    );
    setSaving(false);
    setSaveMsg(res.error ? `Ошибка: ${res.error}` : "Сохранено успешно");
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const deleteTemplate = async (id: number) => {
    await apiFetch(
      `${COMPANY_URL}?action=delete_template&id=${id}`,
      { method: "DELETE" },
      token
    );
    setTemplates((p) => p.filter((t) => t.id !== id));
  };

  const uploadTplFile = async (file: File) => {
    setTplUploading(true);
    const res = await apiFetch(
      `${COMPANY_URL}?action=template_presigned`,
      { method: "POST", body: JSON.stringify({ file_name: file.name }) },
      token
    );
    if (!res.error) {
      await fetch(res.presigned_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      });
      setNewTpl((p) => ({ ...p, file_name: file.name, file_url: res.cdn_url }));
    }
    setTplUploading(false);
  };

  const saveTpl = async () => {
    if (!newTpl.name || !newTpl.type) return;
    const res = await apiFetch(
      `${COMPANY_URL}?action=save_template`,
      { method: "POST", body: JSON.stringify(newTpl) },
      token
    );
    if (!res.error) {
      setShowAddTpl(false);
      setNewTpl({ name: "", type: "construction", content_text: "", file_name: "", file_url: "" });
      // reload
      apiFetch(`${COMPANY_URL}?action=templates`).then((r) =>
        setTemplates(r.templates || [])
      );
    }
  };

  const TABS = [
    { id: "details", label: "Реквизиты", icon: "Building2" },
    { id: "images", label: "Логотип и печать", icon: "Image" },
    { id: "templates", label: "Шаблоны договоров", icon: "FileText" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Настройки организации</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Реквизиты, логотип, шаблоны договоров
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === t.id ? "var(--card-bg)" : "transparent",
              color: tab === t.id ? "#FBBF24" : "rgba(255,255,255,0.5)",
              border: tab === t.id ? "1px solid var(--card-border)" : "1px solid transparent",
            }}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Реквизиты ── */}
      {tab === "details" && (
        <div
          className="rounded-2xl p-6 space-y-6"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          {/* Наименование */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Наименование
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Краткое название</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.company_name || ""}
                  onChange={(e) => set("company_name", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="ООО СтройКалькулятор"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Полное наименование</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.full_name || ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder='Общество с ограниченной ответственностью "СтройКалькулятор"'
                />
              </div>
            </div>
          </div>

          {/* Регистрационные данные */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Регистрационные данные
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>ИНН</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.inn || ""}
                  onChange={(e) => set("inn", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="7700000000"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>КПП</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.kpp || ""}
                  onChange={(e) => set("kpp", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="770001001"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>ОГРН</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.ogrn || ""}
                  onChange={(e) => set("ogrn", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="1027700000000"
                />
              </div>
            </div>
          </div>

          {/* Адреса */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Адреса
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Юридический адрес</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.legal_address || ""}
                  onChange={(e) => set("legal_address", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="125009, г. Москва, ул. Тверская, д. 1"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Фактический адрес</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.actual_address || ""}
                  onChange={(e) => set("actual_address", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="125009, г. Москва, ул. Тверская, д. 1"
                />
              </div>
            </div>
          </div>

          {/* Контакты */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Контакты
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Телефон</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.phone || ""}
                  onChange={(e) => set("phone", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="+7 (495) 000-00-00"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Email</label>
                <input
                  className={INP} style={INP_STYLE}
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => set("email", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="info@company.ru"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Сайт</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.website || ""}
                  onChange={(e) => set("website", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="https://company.ru"
                />
              </div>
            </div>
          </div>

          {/* Руководитель */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Руководитель
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>ФИО руководителя</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.director_name || ""}
                  onChange={(e) => set("director_name", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Должность</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.director_title || "Генеральный директор"}
                  onChange={(e) => set("director_title", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                />
              </div>
            </div>
          </div>

          {/* Банковские реквизиты */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LABEL_STYLE}>
              Банковские реквизиты
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Банк</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.bank_name || ""}
                  onChange={(e) => set("bank_name", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="ПАО Сбербанк"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>БИК</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.bik || ""}
                  onChange={(e) => set("bik", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="044525225"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Расчётный счёт</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.account_number || ""}
                  onChange={(e) => set("account_number", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="40702810000000000000"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Корр. счёт</label>
                <input
                  className={INP} style={INP_STYLE}
                  value={form.corr_account || ""}
                  onChange={(e) => set("corr_account", e.target.value)}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="30101810400000000225"
                />
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#FBBF24", color: "#0a0d14" }}
            >
              {saving ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="Save" size={16} />
              )}
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            {saveMsg && (
              <span
                className="text-sm"
                style={{ color: saveMsg.startsWith("Ошибка") ? "#ef4444" : "#00FF88" }}
              >
                {saveMsg.startsWith("Ошибка") ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="AlertCircle" size={14} /> {saveMsg}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Icon name="CheckCircle2" size={14} /> {saveMsg}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Логотип и печать ── */}
      {tab === "images" && (
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={LABEL_STYLE}>
            Изображения для документов
          </p>
          <div className="grid grid-cols-3 gap-6">
            <UploadZone
              label="Логотип"
              field="logo_url"
              currentUrl={form.logo_url}
              action="upload_logo"
              token={token}
              onUploaded={(url) => setForm((p) => ({ ...p, logo_url: url }))}
            />
            <UploadZone
              label="Печать"
              field="stamp_url"
              currentUrl={form.stamp_url}
              action="upload_stamp"
              token={token}
              onUploaded={(url) => setForm((p) => ({ ...p, stamp_url: url }))}
            />
            <UploadZone
              label="Подпись руководителя"
              field="signature_url"
              currentUrl={form.signature_url}
              action="upload_signature"
              token={token}
              onUploaded={(url) => setForm((p) => ({ ...p, signature_url: url }))}
            />
          </div>
          <div
            className="mt-6 rounded-xl p-4 flex gap-3"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}
          >
            <Icon name="Info" size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#FBBF24" }} />
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Изображения используются при автоматическом формировании договоров, КП и других документов.
              Рекомендуется загружать изображения на прозрачном фоне (PNG) с разрешением не менее 300×300 пикселей.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab: Шаблоны договоров ── */}
      {tab === "templates" && (
        <div className="space-y-4">
          {/* Add button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddTpl((p) => !p)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "#FBBF24", color: "#0a0d14" }}
            >
              <Icon name={showAddTpl ? "X" : "Plus"} size={16} />
              {showAddTpl ? "Отмена" : "Добавить шаблон"}
            </button>
          </div>

          {/* Add form */}
          {showAddTpl && (
            <div
              className="rounded-2xl p-6 space-y-4 animate-fade-in"
              style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.25)" }}
            >
              <p className="text-sm font-semibold text-white">Новый шаблон</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Название шаблона</label>
                  <input
                    className={INP} style={INP_STYLE}
                    value={newTpl.name}
                    onChange={(e) => setNewTpl((p) => ({ ...p, name: e.target.value }))}
                    onFocus={focusOrange} onBlur={blurOrange}
                    placeholder="Договор строительного подряда"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={LABEL_STYLE}>Тип договора</label>
                  <select
                    className={INP} style={INP_STYLE}
                    value={newTpl.type}
                    onChange={(e) => setNewTpl((p) => ({ ...p, type: e.target.value }))}
                    onFocus={focusOrange} onBlur={blurOrange}
                  >
                    <option value="construction">Строительство</option>
                    <option value="supply">Поставка</option>
                    <option value="service">Услуги</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={LABEL_STYLE}>
                  Текст шаблона (используйте {"{{"} client_name {"}}"},  {"{{"} company_name {"}}"}, {"{{"} budget {"}}"} и др.)
                </label>
                <textarea
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all resize-y"
                  style={{ ...INP_STYLE, minHeight: 160 }}
                  value={newTpl.content_text}
                  onChange={(e) => setNewTpl((p) => ({ ...p, content_text: e.target.value }))}
                  onFocus={focusOrange} onBlur={blurOrange}
                  placeholder="Текст договора. Вставьте содержимое из Word..."
                />
              </div>
              <div>
                <label className="block text-xs mb-2" style={LABEL_STYLE}>Файл шаблона (необязательно)</label>
                {newTpl.file_url ? (
                  <div className="flex items-center gap-2">
                    <Icon name="FileCheck" size={14} style={{ color: "#00FF88" }} />
                    <span className="text-xs text-white">{newTpl.file_name}</span>
                    <button
                      onClick={() => setNewTpl((p) => ({ ...p, file_name: "", file_url: "" }))}
                      className="ml-1"
                    >
                      <Icon name="X" size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => tplFileRef.current?.click()}
                    disabled={tplUploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all hover:opacity-80 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                  >
                    {tplUploading ? (
                      <Icon name="Loader2" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="Upload" size={14} />
                    )}
                    {tplUploading ? "Загрузка..." : "Загрузить файл"}
                  </button>
                )}
                <input
                  ref={tplFileRef}
                  type="file"
                  className="hidden"
                  accept=".docx,.doc,.pdf"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTplFile(f); }}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddTpl(false)}
                  className="px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
                >
                  Отмена
                </button>
                <button
                  onClick={saveTpl}
                  disabled={!newTpl.name}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#FBBF24", color: "#0a0d14" }}
                >
                  <Icon name="Save" size={14} />
                  Сохранить шаблон
                </button>
              </div>
            </div>
          )}

          {/* Templates list */}
          {tplLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader2" size={28} className="animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          ) : templates.length === 0 ? (
            <div
              className="rounded-2xl p-10 flex flex-col items-center gap-3"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
            >
              <Icon name="FileText" size={36} style={{ color: "rgba(255,255,255,0.1)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Шаблонов пока нет. Добавьте первый шаблон договора.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.1)" }}
                  >
                    <Icon name="FileText" size={18} style={{ color: "#FBBF24" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{t.name}</span>
                      <span
                        className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                        style={{
                          background: `${TPL_TYPE_COLORS[t.type] || "#888"}22`,
                          color: TPL_TYPE_COLORS[t.type] || "#888",
                        }}
                      >
                        {TPL_TYPE_LABELS[t.type] || t.type}
                      </span>
                    </div>
                    {t.file_url && (
                      <a
                        href={t.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs mt-0.5 flex items-center gap-1 hover:opacity-80 transition-opacity"
                        style={{ color: "#00D4FF" }}
                      >
                        <Icon name="Download" size={11} />
                        {t.file_name || "Скачать файл"}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    className="p-2 rounded-lg transition-all hover:opacity-80 flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                    title="Удалить шаблон"
                  >
                    <Icon name="Trash2" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
