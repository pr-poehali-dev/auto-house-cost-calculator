import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import {
  COMPANY_URL,
  INP,
  INP_STYLE,
  LABEL_STYLE,
  apiFetch,
  focusOrange,
  blurOrange,
  fileToBase64,
  Company,
} from "./shared";
import TemplatesTab from "./TemplatesTab";

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

export default CompanyForm;