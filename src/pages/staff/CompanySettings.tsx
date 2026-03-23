import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import {
  COMPANY_URL,
  INP,
  INP_STYLE,
  LABEL_STYLE,
  apiFetch,
  focusOrange,
  blurOrange,
  Company,
} from "./company-settings/shared";
import CompanyForm from "./company-settings/CompanyForm";

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

// ─── CompanySettings (main) ──────────────────────────────────────────────────
interface CompanySettingsProps {
  token: string;
}

export default function CompanySettings({ token }: CompanySettingsProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `${COMPANY_URL}?action=companies`,
        {},
        token
      );
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
