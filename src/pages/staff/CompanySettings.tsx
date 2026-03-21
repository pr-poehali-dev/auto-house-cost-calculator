import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Constants ────────────────────────────────────────────────────────────────
const COMPANY_URL =
  "https://functions.poehali.dev/0796a927-18d1-46be-bd26-3bbcfe93738d";

const INP =
  "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all";
const INP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};
const LABEL_STYLE: React.CSSProperties = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function focusOrange(
  e: React.FocusEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) {
  e.target.style.borderColor = "#FBBF24";
}
function blurOrange(
  e: React.FocusEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) {
  e.target.style.borderColor = "rgba(255,255,255,0.1)";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Company {
  id: number;
  is_default: boolean;
  company_name: string;
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
  company_map_url?: string;
  updated_at?: string;
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

interface CompanySettingsProps {
  token: string;
}

// ─── UploadZone ───────────────────────────────────────────────────────────────
function UploadZone({
  label,
  currentUrl,
  action,
  token,
  companyId,
  onUploaded,
}: {
  label: string;
  currentUrl?: string;
  action: string;
  token: string;
  companyId: number;
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
        {
          method: "POST",
          body: JSON.stringify({ file_name: file.name, company_id: companyId }),
        },
        token
      );
      if (res.error) {
        setError(res.error);
        setUploading(false);
        return;
      }
      await fetch(res.presigned_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      });
      setPreview(res.cdn_url);
      onUploaded(res.cdn_url);
    } catch {
      setError("Ошибка загрузки");
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-2">
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
          style={{
            color: "#FBBF24",
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.2)",
          }}
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
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

// ─── UploadZoneMap ────────────────────────────────────────────────────────────
function UploadZoneMap({
  currentUrl,
  token,
  companyId,
  onUploaded,
}: {
  currentUrl?: string;
  token: string;
  companyId: number;
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
        `${COMPANY_URL}?action=upload_map`,
        {
          method: "POST",
          body: JSON.stringify({ file_name: file.name, company_id: companyId }),
        },
        token
      );
      if (res.error) {
        setError(res.error);
        setUploading(false);
        return;
      }
      await fetch(res.presigned_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/octet-stream" },
      });
      setPreview(res.cdn_url);
      onUploaded(res.cdn_url);
    } catch {
      setError("Ошибка загрузки");
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
        Карта / Схема проезда
      </label>
      <div
        className="rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-yellow-400/40 relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "2px dashed rgba(255,255,255,0.12)",
          minHeight: 180,
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt="Карта предприятия"
            className="w-full object-cover"
            style={{ maxHeight: 180 }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8">
            <Icon name="Map" size={32} style={{ color: "rgba(255,255,255,0.2)" }} />
            <span
              className="text-xs text-center px-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Нажмите, чтобы загрузить карту / схему проезда
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
          style={{
            color: "#FBBF24",
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.2)",
          }}
        >
          Заменить карту
        </button>
      )}
      {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

// ─── CreateCompanyModal ───────────────────────────────────────────────────────
function CreateCompanyModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (company: Company) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Введите название организации");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=create_company`,
        { method: "POST", body: JSON.stringify({ company_name: name.trim() }) },
        token
      );
      if (res.error) {
        setError(res.error);
      } else if (res.ok) {
        onCreated(res.company);
      }
    } catch {
      setError("Ошибка сети");
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rounded-2xl p-6 flex flex-col gap-5 w-full max-w-sm"
        style={{
          background: "var(--card-bg, #1a1f2e)",
          border: "1px solid var(--card-border, rgba(255,255,255,0.1))",
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Новая организация</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
          >
            <Icon name="X" size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
            Название организации *
          </label>
          <input
            className={INP}
            style={INP_STYLE}
            placeholder="ООО «Пример»"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={focusOrange}
            onBlur={blurOrange}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              color: "#111",
            }}
          >
            {loading ? (
              <Icon name="Loader2" size={16} className="animate-spin" />
            ) : (
              <Icon name="Plus" size={16} />
            )}
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CompanyCard (sidebar) ────────────────────────────────────────────────────
function CompanyCard({
  company,
  isActive,
  onClick,
}: {
  company: Company;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3 cursor-pointer transition-all flex flex-col gap-1.5"
      style={{
        background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)",
        border: isActive
          ? "1.5px solid #FBBF24"
          : "1.5px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-sm font-semibold leading-tight"
          style={{ color: isActive ? "#FBBF24" : "rgba(255,255,255,0.85)" }}
        >
          {company.company_name}
        </span>
        {company.is_default && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            style={{
              background: "rgba(251,191,36,0.15)",
              color: "#FBBF24",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            По умолчанию
          </span>
        )}
      </div>
      {company.inn && (
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          ИНН: {company.inn}
        </span>
      )}
    </div>
  );
}

// ─── RequisitesTab ────────────────────────────────────────────────────────────
function RequisitesTab({
  form,
  onChange,
}: {
  form: Company;
  onChange: (field: keyof Company, value: string) => void;
}) {
  const f = (field: keyof Company) => ({
    value: (form[field] as string) || "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => onChange(field, e.target.value),
    onFocus: focusOrange,
    onBlur: blurOrange,
    className: INP,
    style: { ...INP_STYLE },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Основные */}
      <section className="flex flex-col gap-4">
        <h4
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#FBBF24" }}
        >
          Основные сведения
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Краткое название *
            </label>
            <input placeholder="ООО «Пример»" {...f("company_name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Полное наименование
            </label>
            <input
              placeholder="Общество с ограниченной ответственностью «Пример»"
              {...f("full_name")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              ИНН
            </label>
            <input placeholder="7712345678" {...f("inn")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              КПП
            </label>
            <input placeholder="771201001" {...f("kpp")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              ОГРН
            </label>
            <input placeholder="1027712345678" {...f("ogrn")} />
          </div>
        </div>
      </section>

      {/* Адреса */}
      <section className="flex flex-col gap-4">
        <h4
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#00D4FF" }}
        >
          Адреса
        </h4>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Юридический адрес
            </label>
            <textarea
              rows={2}
              placeholder="115035, г. Москва, ул. Примерная, д. 1"
              className={INP + " resize-none"}
              style={{ ...INP_STYLE }}
              value={(form.legal_address as string) || ""}
              onChange={(e) => onChange("legal_address", e.target.value)}
              onFocus={focusOrange}
              onBlur={blurOrange}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Фактический адрес
            </label>
            <textarea
              rows={2}
              placeholder="115035, г. Москва, ул. Примерная, д. 1"
              className={INP + " resize-none"}
              style={{ ...INP_STYLE }}
              value={(form.actual_address as string) || ""}
              onChange={(e) => onChange("actual_address", e.target.value)}
              onFocus={focusOrange}
              onBlur={blurOrange}
            />
          </div>
        </div>
      </section>

      {/* Контакты */}
      <section className="flex flex-col gap-4">
        <h4
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#00D4FF" }}
        >
          Контакты
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Телефон
            </label>
            <input placeholder="+7 (495) 123-45-67" {...f("phone")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Email
            </label>
            <input placeholder="info@example.ru" {...f("email")} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Сайт
            </label>
            <input placeholder="https://example.ru" {...f("website")} />
          </div>
        </div>
      </section>

      {/* Руководитель */}
      <section className="flex flex-col gap-4">
        <h4
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#00D4FF" }}
        >
          Руководитель
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Должность
            </label>
            <input placeholder="Генеральный директор" {...f("director_title")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              ФИО руководителя
            </label>
            <input placeholder="Иванов Иван Иванович" {...f("director_name")} />
          </div>
        </div>
      </section>

      {/* Банковские реквизиты */}
      <section className="flex flex-col gap-4">
        <h4
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#00D4FF" }}
        >
          Банковские реквизиты
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Наименование банка
            </label>
            <input placeholder="ПАО «Сбербанк»" {...f("bank_name")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              БИК
            </label>
            <input placeholder="044525225" {...f("bik")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Расчётный счёт
            </label>
            <input placeholder="40702810338000123456" {...f("account_number")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest" style={LABEL_STYLE}>
              Корр. счёт
            </label>
            <input placeholder="30101810400000000225" {...f("corr_account")} />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── LogoTab ──────────────────────────────────────────────────────────────────
function LogoTab({
  form,
  token,
  onUploaded,
}: {
  form: Company;
  token: string;
  onUploaded: (field: keyof Company, url: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UploadZone
          label="Логотип"
          currentUrl={form.logo_url}
          action="upload_logo"
          token={token}
          companyId={form.id}
          onUploaded={(url) => onUploaded("logo_url", url)}
        />
        <UploadZone
          label="Печать"
          currentUrl={form.stamp_url}
          action="upload_stamp"
          token={token}
          companyId={form.id}
          onUploaded={(url) => onUploaded("stamp_url", url)}
        />
        <UploadZone
          label="Подпись"
          currentUrl={form.signature_url}
          action="upload_signature"
          token={token}
          companyId={form.id}
          onUploaded={(url) => onUploaded("signature_url", url)}
        />
      </div>
      <UploadZoneMap
        currentUrl={form.company_map_url}
        token={token}
        companyId={form.id}
        onUploaded={(url) => onUploaded("company_map_url", url)}
      />
    </div>
  );
}

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

// ─── CompanyForm (right panel) ────────────────────────────────────────────────
function CompanyForm({
  company,
  token,
  onSaved,
  onSetDefault,
}: {
  company: Company;
  token: string;
  onSaved: (updated: Company) => void;
  onSetDefault: (id: number) => void;
}) {
  const [tab, setTab] = useState<"requisites" | "logo" | "templates">("requisites");
  const [form, setForm] = useState<Company>(company);
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const contractFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(company);
    setTab("requisites");
    setSaveSuccess(false);
    setSaveError("");
    setParseError("");
  }, [company.id]);

  const handleChange = (field: keyof Company, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleUploaded = (field: keyof Company, url: string) => {
    setForm((prev) => ({ ...prev, [field]: url }));
    onSaved({ ...form, [field]: url });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=save_company`,
        { method: "POST", body: JSON.stringify({ ...form, id: company.id }) },
        token
      );
      if (res.ok) {
        setSaveSuccess(true);
        onSaved(res.company || form);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(res.error || "Ошибка сохранения");
      }
    } catch {
      setSaveError("Ошибка сети");
    }
    setSaving(false);
  };

  const handleSetDefault = async () => {
    setSettingDefault(true);
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=set_default`,
        { method: "POST", body: JSON.stringify({ id: company.id }) },
        token
      );
      if (res.ok) {
        onSetDefault(company.id);
      }
    } catch {
      // ignore
    }
    setSettingDefault(false);
  };

  const handleParseContract = async (file: File) => {
    setParsing(true);
    setParseError("");
    try {
      const base64 = await fileToBase64(file);
      const res = await apiFetch(
        `${COMPANY_URL}?action=parse_contract`,
        {
          method: "POST",
          body: JSON.stringify({ file_name: file.name, file_base64: base64 }),
        },
        token
      );
      if (res.requisites) {
        const r = res.requisites as Partial<Company>;
        setForm((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(r).filter(([, v]) => v !== undefined && v !== null && v !== "")
          ),
        }));
        setTab("requisites");
      } else if (res.error) {
        setParseError(res.error);
      }
    } catch {
      setParseError("Ошибка при разборе договора");
    }
    setParsing(false);
  };

  const TABS = [
    { id: "requisites" as const, label: "Реквизиты", icon: "Building2" },
    { id: "logo" as const, label: "Логотип и печать", icon: "Image" },
    { id: "templates" as const, label: "Шаблоны договоров", icon: "FileText" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-white leading-tight">
                {form.company_name || "Организация"}
              </h2>
              {form.is_default && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: "rgba(251,191,36,0.15)",
                    color: "#FBBF24",
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}
                >
                  По умолчанию
                </span>
              )}
            </div>
            {form.inn && (
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                ИНН: {form.inn}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Parse contract */}
            <button
              onClick={() => contractFileRef.current?.click()}
              disabled={parsing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.25)",
                color: "#00D4FF",
              }}
              title="Загрузить договор и автоматически заполнить реквизиты"
            >
              {parsing ? (
                <Icon name="Loader2" size={15} className="animate-spin" />
              ) : (
                <Icon name="FileSearch" size={15} />
              )}
              Заполнить из договора
            </button>
            <input
              ref={contractFileRef}
              type="file"
              className="hidden"
              accept=".docx,.doc,.pdf,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleParseContract(f);
                e.target.value = "";
              }}
            />

            {/* Set default */}
            {!form.is_default && (
              <button
                onClick={handleSetDefault}
                disabled={settingDefault}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {settingDefault ? (
                  <Icon name="Loader2" size={15} className="animate-spin" />
                ) : (
                  <Icon name="Star" size={15} />
                )}
                Сделать основной
              </button>
            )}
          </div>
        </div>

        {parseError && (
          <p
            className="text-xs mt-3 rounded-lg px-3 py-2"
            style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
          >
            {parseError}
          </p>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background:
                  tab === t.id ? "rgba(251,191,36,0.12)" : "transparent",
                color:
                  tab === t.id ? "#FBBF24" : "rgba(255,255,255,0.45)",
                border:
                  tab === t.id
                    ? "1px solid rgba(251,191,36,0.25)"
                    : "1px solid transparent",
              }}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "requisites" && (
          <RequisitesTab form={form} onChange={handleChange} />
        )}
        {tab === "logo" && (
          <LogoTab form={form} token={token} onUploaded={handleUploaded} />
        )}
        {tab === "templates" && (
          <TemplatesTab companyId={company.id} token={token} />
        )}
      </div>

      {/* Footer (save) */}
      {(tab === "requisites" || tab === "logo") && (
        <div
          className="px-6 py-4 flex-shrink-0 flex items-center gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
              color: "#111",
            }}
          >
            {saving ? (
              <Icon name="Loader2" size={16} className="animate-spin" />
            ) : (
              <Icon name="Save" size={16} />
            )}
            Сохранить
          </button>

          {saveSuccess && (
            <span
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "#00FF88" }}
            >
              <Icon name="CheckCircle2" size={16} />
              Сохранено
            </span>
          )}
          {saveError && (
            <span className="text-sm" style={{ color: "#ef4444" }}>
              {saveError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CompanySettings({ token }: CompanySettingsProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${COMPANY_URL}?action=companies`, {}, token);
      const list: Company[] = res.companies || [];
      setCompanies(list);
      if (list.length > 0 && selectedId === null) {
        const def = list.find((c) => c.is_default) || list[0];
        setSelectedId(def.id);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const selectedCompany = companies.find((c) => c.id === selectedId) || null;

  const handleCreated = (company: Company) => {
    setCompanies((prev) => [...prev, company]);
    setSelectedId(company.id);
    setShowCreate(false);
  };

  const handleSaved = (updated: Company) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  };

  const handleSetDefault = (id: number) => {
    setCompanies((prev) =>
      prev.map((c) => ({ ...c, is_default: c.id === id }))
    );
  };

  return (
    <div
      className="flex flex-col h-full min-h-screen"
      style={{ background: "var(--bg, #0f1117)" }}
    >
      {/* Page title */}
      <div
        className="px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(251,191,36,0.12)" }}
          >
            <Icon name="Building2" size={16} style={{ color: "#FBBF24" }} />
          </div>
          <h1 className="text-xl font-bold text-white">Организации</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {loading ? (
              <div className="flex flex-col gap-2 mt-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 animate-pulse"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      height: 68,
                      border: "1.5px solid rgba(255,255,255,0.06)",
                    }}
                  />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Icon name="Building2" size={32} style={{ color: "rgba(255,255,255,0.12)" }} />
                <p
                  className="text-xs text-center"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Организации не добавлены
                </p>
              </div>
            ) : (
              companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  isActive={company.id === selectedId}
                  onClick={() => setSelectedId(company.id)}
                />
              ))
            )}
          </div>

          {/* Add button */}
          <div
            className="p-4 flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#FBBF24",
              }}
            >
              <Icon name="Plus" size={16} />
              Добавить организацию
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Icon name="Loader2" size={28} className="animate-spin" style={{ color: "#FBBF24" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Загрузка...
                </p>
              </div>
            </div>
          ) : selectedCompany ? (
            <CompanyForm
              key={selectedCompany.id}
              company={selectedCompany}
              token={token}
              onSaved={handleSaved}
              onSetDefault={handleSetDefault}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Icon name="Building2" size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Выберите организацию
                </p>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  или добавьте новую
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateCompanyModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
