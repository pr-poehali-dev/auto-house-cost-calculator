import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { StaffUser } from "./staff-types";

const MARKETER_API = "https://functions.poehali.dev/94910f45-ee39-491a-bb78-78888d514d8f";

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}), ...(opts.headers || {}) },
  }).then(r => r.json());
}

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }

interface ExtractedProject {
  name: string; type: string; area: number | null; floors: number | null;
  rooms: number | null; price: number | null; description: string; features: string;
  roof_type: string; foundation_type: string; wall_type: string;
  tag: string; competitor_notes: string; source_url: string;
}

interface ImportedProject {
  id: number; name: string; type: string; area: number;
  floors: number; price: number; is_active: boolean; created_at: string;
}

const INP = "w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all";
const INP_S = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
const CARD_S = { background: "var(--card-bg)", border: "1px solid var(--card-border)" };
const LBL = { color: "rgba(255,255,255,0.4)" };

export default function MarketerCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [tab, setTab] = useState<"analyzer" | "catalog">("analyzer");

  // Analyzer state
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedProject | null>(null);
  const [editedData, setEditedData] = useState<ExtractedProject | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Catalog state
  const [projects, setProjects] = useState<ImportedProject[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    const res = await apiFetch(`${MARKETER_API}?action=competitor_list`, {}, token);
    setProjects(res.projects || []);
    setLoadingCatalog(false);
  }, [token]);

  useEffect(() => {
    if (tab === "catalog") loadCatalog();
  }, [tab, loadCatalog]);

  const analyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true); setAnalyzeError(""); setExtracted(null); setEditedData(null); setImportMsg("");
    const res = await apiFetch(`${MARKETER_API}?action=analyze_url`, { method: "POST", body: JSON.stringify({ url: url.trim() }) }, token);
    setAnalyzing(false);
    if (res.error) { setAnalyzeError(res.error); return; }
    setExtracted(res.data);
    setEditedData({ ...res.data });
  };

  const importProject = async () => {
    if (!editedData) return;
    setImporting(true); setImportMsg("");
    const res = await apiFetch(`${MARKETER_API}?action=import_project`, { method: "POST", body: JSON.stringify({ data: editedData }) }, token);
    setImporting(false);
    if (res.ok) {
      setImportMsg(`Проект сохранён (ID: ${res.project_id}). Он скрыт — опубликуйте его в «Каталоге».`);
      setExtracted(null); setEditedData(null); setUrl("");
    } else {
      setImportMsg(res.error || "Ошибка импорта");
    }
  };

  const publish = async (id: number) => {
    setPublishing(id);
    await apiFetch(`${MARKETER_API}?action=publish_project`, { method: "POST", body: JSON.stringify({ project_id: id }) }, token);
    setPublishing(null);
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, is_active: true } : pr));
  };

  const updateField = (key: keyof ExtractedProject, value: string | number) => {
    setEditedData(p => p ? { ...p, [key]: value } : p);
  };

  const TABS = [
    { id: "analyzer", label: "Анализатор конкурентов", icon: "Search" },
    { id: "catalog", label: "Импортированные проекты", icon: "LayoutGrid" },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#34D399" }}>Маркетолог</div>
          <h2 className="font-display text-2xl font-bold text-white">Анализ конкурентов</h2>
          <p className="text-sm mt-0.5" style={LBL}>Добро пожаловать, {user.full_name}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>
          <Icon name="TrendingUp" size={22} style={{ color: "#34D399" }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t.id ? "#34D399" : "transparent", color: tab === t.id ? "#0a0d14" : "rgba(255,255,255,0.5)" }}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Analyzer tab ── */}
      {tab === "analyzer" && (
        <div className="space-y-5">
          {/* Инструкция */}
          <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(0,212,255,0.05))", border: "1px solid rgba(52,211,153,0.2)" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(52,211,153,0.15)" }}>
                <Icon name="Lightbulb" size={18} style={{ color: "#34D399" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Как это работает</p>
                <p className="text-sm" style={LBL}>
                  Вставьте ссылку на страницу проекта конкурента (например, со «Строим дом.рф», domru.ru, или любого другого сайта).
                  AI проанализирует страницу, извлечёт все характеристики — площадь, этажи, цену, описание — и предложит добавить проект в ваш каталог.
                </p>
              </div>
            </div>
          </div>

          {/* Поле URL */}
          <div className="rounded-2xl p-5" style={CARD_S}>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={LBL}>
              Ссылка на проект конкурента
            </label>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl flex-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(52,211,153,0.25)" }}>
                <Icon name="Link" size={15} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && analyze()}
                  placeholder="https://www.domostroy.ru/catalog/project/123"
                  className="bg-transparent outline-none text-sm text-white flex-1"
                />
                {url && (
                  <button onClick={() => { setUrl(""); setExtracted(null); setEditedData(null); setAnalyzeError(""); setImportMsg(""); }}
                    style={{ color: "rgba(255,255,255,0.25)" }}>
                    <Icon name="X" size={13} />
                  </button>
                )}
              </div>
              <button onClick={analyze} disabled={analyzing || !url.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: analyzing ? "rgba(52,211,153,0.2)" : "#34D399", color: "#0a0d14", minWidth: 130 }}>
                {analyzing
                  ? <><Icon name="Loader2" size={15} className="animate-spin" /> Анализирую...</>
                  : <><Icon name="Sparkles" size={15} /> Анализировать</>
                }
              </button>
            </div>
            {analyzeError && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Icon name="AlertCircle" size={14} />
                {analyzeError}
              </div>
            )}
            {importMsg && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: importMsg.includes("Ошибка") ? "rgba(239,68,68,0.08)" : "rgba(52,211,153,0.08)", color: importMsg.includes("Ошибка") ? "#ef4444" : "#34D399", border: `1px solid ${importMsg.includes("Ошибка") ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                <Icon name={importMsg.includes("Ошибка") ? "AlertCircle" : "CheckCircle2"} size={14} />
                {importMsg}
              </div>
            )}
          </div>

          {/* Результат анализа */}
          {editedData && extracted && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(52,211,153,0.3)" }}>
              {/* Шапка результата */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: "rgba(52,211,153,0.08)", borderBottom: "1px solid rgba(52,211,153,0.15)" }}>
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle2" size={16} style={{ color: "#34D399" }} />
                  <span className="text-sm font-semibold text-white">AI извлёк данные — проверьте и отредактируйте</span>
                </div>
                <a href={extracted.source_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <Icon name="ExternalLink" size={12} />
                  Источник
                </a>
              </div>

              <div className="p-5 space-y-5">
                {/* Заметки конкурента */}
                {extracted.competitor_notes && (
                  <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#FBBF24" }}>
                      Заметки AI о конкуренте
                    </p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{extracted.competitor_notes}</p>
                  </div>
                )}

                {/* Основные поля */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Название проекта</label>
                    <input className={INP} style={INP_S} value={editedData.name || ""}
                      onChange={e => updateField("name", e.target.value)} placeholder="Название" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Тип</label>
                    <select className={INP} style={{ ...INP_S, background: "#1a1f2e" }} value={editedData.type || ""}
                      onChange={e => updateField("type", e.target.value)}>
                      {["Кирпичный","Каркасный","Монолитный","Деревянный","Газобетон","Модульный"].map(t => (
                        <option key={t} value={t} style={{ background: "#1a1f2e" }}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {[
                    { label: "Площадь, м²", key: "area" as const },
                    { label: "Этажей", key: "floors" as const },
                    { label: "Комнат", key: "rooms" as const },
                    { label: "Цена, ₽", key: "price" as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>{f.label}</label>
                      <input type="number" className={INP} style={INP_S} value={editedData[f.key] ?? ""}
                        onChange={e => updateField(f.key, +e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Тип кровли</label>
                    <input className={INP} style={INP_S} value={editedData.roof_type || ""}
                      onChange={e => updateField("roof_type", e.target.value)} placeholder="Двускатная" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Фундамент</label>
                    <input className={INP} style={INP_S} value={editedData.foundation_type || ""}
                      onChange={e => updateField("foundation_type", e.target.value)} placeholder="Ленточный" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Стены</label>
                    <input className={INP} style={INP_S} value={editedData.wall_type || ""}
                      onChange={e => updateField("wall_type", e.target.value)} placeholder="Газобетон 400мм" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Описание</label>
                  <textarea rows={3} className={INP + " resize-none"} style={INP_S} value={editedData.description || ""}
                    onChange={e => updateField("description", e.target.value)} placeholder="Краткое описание проекта..." />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={LBL}>Особенности (каждая с новой строки)</label>
                  <textarea rows={4} className={INP + " resize-none"} style={INP_S} value={editedData.features || ""}
                    onChange={e => updateField("features", e.target.value)} placeholder={"Тёплый пол\nПанорамные окна\nДвойное остекление"} />
                </div>

                {/* Цена конкурента vs наша */}
                {extracted.price && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="px-4 py-3 rounded-xl text-center" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
                      <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Цена конкурента</p>
                      <p className="font-display font-bold text-lg" style={{ color: "#ef4444" }}>
                        {fmt(extracted.price)} ₽
                      </p>
                    </div>
                    <div className="px-4 py-3 rounded-xl text-center" style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)" }}>
                      <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Наша цена (после редактирования)</p>
                      <p className="font-display font-bold text-lg" style={{ color: "#34D399" }}>
                        {editedData.price ? fmt(editedData.price) + " ₽" : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Кнопки действия */}
                <div className="flex gap-3 pt-2">
                  <button onClick={importProject} disabled={importing}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: "#34D399", color: "#0a0d14" }}>
                    {importing
                      ? <><Icon name="Loader2" size={15} className="animate-spin" /> Сохраняю...</>
                      : <><Icon name="Download" size={15} /> Сохранить в каталог</>
                    }
                  </button>
                  <button onClick={() => { setExtracted(null); setEditedData(null); setUrl(""); }}
                    className="px-6 py-3 rounded-xl text-sm transition-all hover:bg-white/10"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Примеры сайтов */}
          {!extracted && !analyzing && (
            <div className="rounded-2xl p-5" style={CARD_S}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={LBL}>Примеры сайтов для анализа</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { name: "Строим дом.рф", url: "https://xn--80aafncmgfbcjkmpe3a2a.xn--p1ai" },
                  { name: "Domstroi.ru", url: "https://domstroi.ru" },
                  { name: "Домокомплект", url: "https://domokomekt.ru" },
                ].map(s => (
                  <button key={s.url} onClick={() => setUrl(s.url)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                    <Icon name="Globe" size={13} style={{ color: "#34D399", flexShrink: 0 }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Catalog tab ── */}
      {tab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={LBL}>{projects.length} проектов импортировано</p>
            <button onClick={loadCatalog} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="RefreshCw" size={12} /> Обновить
            </button>
          </div>

          {loadingCatalog ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl p-14 text-center" style={{ ...CARD_S, border: "1px dashed rgba(255,255,255,0.1)" }}>
              <Icon name="Search" size={36} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 12px" }} />
              <p className="text-white font-semibold mb-1">Нет импортированных проектов</p>
              <p className="text-sm" style={LBL}>Проанализируйте сайт конкурента на вкладке «Анализатор»</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p, i) => (
                <div key={p.id} className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
                  style={{ ...CARD_S, animation: `fadeInUp 0.3s ease-out ${i * 0.04}s both`, opacity: p.is_active ? 1 : 0.75 }}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: p.is_active ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)", color: p.is_active ? "#34D399" : "rgba(255,255,255,0.4)" }}>
                      {p.is_active ? "Опубликован" : "Черновик"}
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(p.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <p className="font-display font-bold text-base text-white mb-1 truncate">{p.name}</p>
                  <p className="text-xs mb-3" style={LBL}>{p.type} · {p.area} м² · {p.floors} эт.</p>
                  <p className="font-display font-bold" style={{ color: "#34D399" }}>
                    {p.price ? fmt(p.price) + " ₽" : "—"}
                  </p>
                  {!p.is_active && (
                    <button onClick={() => publish(p.id)} disabled={publishing === p.id}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.25)" }}>
                      {publishing === p.id
                        ? <><Icon name="Loader2" size={12} className="animate-spin" /> Публикую...</>
                        : <><Icon name="Globe" size={12} /> Опубликовать в каталоге</>
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
