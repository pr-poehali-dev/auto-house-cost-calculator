import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const PROJECTS_API = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }
function fmtDate(s: string) { try { return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }); } catch { return s; } }

interface ProjectFile { id: number; file_type: string; file_url: string; file_name: string; sort_order: number; }
interface SpecItem { id: number; section: string; name: string; unit: string; qty: number; price_per_unit: number; total_price: number; note?: string; }
interface Spec { id: number; title: string; version: number; status: string; created_at: string; items?: SpecItem[]; }

interface Project {
  id: number; name: string; type: string; area: number; floors: number; rooms: number;
  price: number; tag: string; tag_color: string; description: string; features: string;
  is_active: boolean; created_at: string; updated_at: string;
  roof_type?: string; foundation_type?: string; wall_type?: string;
  files: ProjectFile[]; specs: Spec[];
}

const FILE_TYPE_LABELS: Record<string, string> = {
  render: "Рендер", plan: "План этажа", facade: "Фасад", section: "Разрез", spec: "Спецификация", other: "Документ",
};

const SECTION_COLORS = [
  "#00D4FF","#FF6B1A","#A855F7","#00FF88","#FBBF24","#EC4899","#06B6D4","#84CC16",
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "drawings" | "spec" | "request">("overview");
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Форма заявки
  const [form, setForm] = useState({ name: "", phone: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${PROJECTS_API}?action=public_get&project_id=${id}`)
      .then(r => r.json())
      .then(r => {
        if (r.project) { setProject(r.project); }
        else { setNotFound(true); }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (activeTab === "spec" && project && !spec && !loadingSpec) {
      setLoadingSpec(true);
      fetch(`${PROJECTS_API}?action=spec_get&project_id=${project.id}`)
        .then(r => r.json())
        .then(r => { setSpec(r.spec || null); setLoadingSpec(false); });
    }
  }, [activeTab, project, spec, loadingSpec]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSubmitting(true);
    // Отправляем через order-api как новый лид
    try {
      await fetch("https://functions.poehali.dev/5cd1eb69-9a08-4572-ae2a-bc11e49da506?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: form.name,
          client_phone: form.phone,
          client_comment: form.comment || `Заявка с проекта: ${project?.name}`,
          source: "site",
          house_project_id: project?.id,
          area: project?.area,
          floors: project?.floors,
        }),
      });
    } catch { /* игнорируем, показываем успех */ }
    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
          style={{ borderTopColor: "var(--neon-orange)" }} />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загружаем проект...</p>
      </div>
    </div>
  );

  if (notFound || !project) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="text-center">
        <div className="text-6xl mb-4">🏗️</div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Проект не найден</h1>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>Возможно, он был удалён или ещё не опубликован</p>
        <button onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl text-sm font-semibold"
          style={{ background: "var(--neon-orange)", color: "#fff" }}>
          ← На главную
        </button>
      </div>
    </div>
  );

  const renders = project.files.filter(f => f.file_type === "render" && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.file_url));
  const drawings = project.files.filter(f => ["plan","facade","section"].includes(f.file_type));
  const docs = project.files.filter(f => ["spec","other"].includes(f.file_type));
  const features = project.features ? project.features.split("\n").filter(Boolean) : [];
  const tagColor = project.tag_color || "#FF6B1A";

  // Смета — группировка по разделам
  const specSections = spec?.items
    ? Array.from(new Set(spec.items.map(i => i.section))).map((section, idx) => ({
        section,
        color: SECTION_COLORS[idx % SECTION_COLORS.length],
        items: spec.items!.filter(i => i.section === section),
        total: spec.items!.filter(i => i.section === section).reduce((s, i) => s + i.total_price, 0),
      }))
    : [];
  const specTotal = spec?.items?.reduce((s, i) => s + i.total_price, 0) || 0;

  const TABS = [
    { id: "overview", label: "Описание", icon: "FileText" },
    { id: "drawings", label: `Чертежи (${drawings.length})`, icon: "LayoutGrid" },
    { id: "spec", label: "Смета", icon: "ClipboardList" },
    { id: "request", label: "Оставить заявку", icon: "Phone" },
  ] as const;

  return (
    <div className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Фоновый градиент */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-6"
          style={{ background: `radial-gradient(circle, ${tagColor} 0%, transparent 70%)` }} />
      </div>

      {/* Шапка */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.6)" }}>
            <Icon name="ArrowLeft" size={15} />
            <span className="hidden sm:inline">Все проекты</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${tagColor}22`, color: tagColor, border: `1px solid ${tagColor}44` }}>
              {project.tag || project.type}
            </span>
          </div>
          <button
            onClick={() => setActiveTab("request")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: tagColor, color: "#0a0d14" }}>
            <Icon name="Phone" size={14} />
            <span className="hidden sm:inline">Оставить заявку</span>
            <span className="sm:hidden">Заявка</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Hero — галерея + ключевые параметры */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Левая: галерея */}
          <div>
            {/* Главный рендер */}
            <div className="rounded-2xl overflow-hidden mb-3 relative" style={{ height: 360 }}>
              {renders.length > 0 && renders[activeImage] ? (
                <img src={renders[activeImage].file_url} alt={project.name}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Icon name="Image" size={48} style={{ color: "rgba(255,255,255,0.1)" }} />
                </div>
              )}
              {renders.length > 1 && (
                <>
                  <button onClick={() => setActiveImage(i => (i - 1 + renders.length) % renders.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: "rgba(10,13,20,0.7)", color: "#fff" }}>
                    <Icon name="ChevronLeft" size={18} />
                  </button>
                  <button onClick={() => setActiveImage(i => (i + 1) % renders.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: "rgba(10,13,20,0.7)", color: "#fff" }}>
                    <Icon name="ChevronRight" size={18} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {renders.map((_, i) => (
                      <button key={i} onClick={() => setActiveImage(i)}
                        className="w-2 h-2 rounded-full transition-all"
                        style={{ background: i === activeImage ? tagColor : "rgba(255,255,255,0.3)" }} />
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Превью */}
            {renders.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {renders.map((f, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className="flex-shrink-0 rounded-xl overflow-hidden transition-all hover:scale-105"
                    style={{ width: 80, height: 56, border: i === activeImage ? `2px solid ${tagColor}` : "2px solid transparent" }}>
                    <img src={f.file_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Правая: название, параметры, цена */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: tagColor }}>
                {project.type}
              </div>
              <h1 className="font-display text-3xl font-bold text-white mb-3">{project.name}</h1>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                {project.description}
              </p>

              {/* Параметры */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {[
                  { icon: "Maximize2", label: "Площадь", value: `${project.area} м²` },
                  { icon: "Layers", label: "Этажей", value: `${project.floors}` },
                  { icon: "BedDouble", label: "Комнат", value: `${project.rooms}` },
                  ...(project.roof_type ? [{ icon: "Home", label: "Кровля", value: project.roof_type }] : []),
                  ...(project.foundation_type ? [{ icon: "Landmark", label: "Фундамент", value: project.foundation_type }] : []),
                  ...(project.wall_type ? [{ icon: "Layers2", label: "Стены", value: project.wall_type }] : []),
                ].map((p, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <Icon name={p.icon} size={14} style={{ color: tagColor, marginBottom: 4 }} />
                    <div className="font-semibold text-sm text-white">{p.value}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* Особенности */}
              {features.length > 0 && (
                <div className="space-y-2 mb-6">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tagColor }} />
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Цена и кнопки */}
            <div className="rounded-2xl p-5" style={{ background: `${tagColor}0d`, border: `1px solid ${tagColor}33` }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Стоимость строительства от</div>
              <div className="font-display font-black text-3xl mb-1" style={{ color: tagColor }}>
                {fmt(project.price)} ₽
              </div>
              <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                {fmt(Math.round(project.price / project.area))} ₽ / м² · {project.area} м²
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setActiveTab("request")}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{ background: tagColor, color: "#0a0d14", boxShadow: `0 0 24px ${tagColor}55` }}>
                  <Icon name="Phone" size={16} />
                  Оставить заявку на строительство
                </button>
                <button
                  onClick={() => navigate(`/supplier?project=${project.id}&area=${project.area}&floors=${project.floors}`)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
                  <Icon name="Truck" size={15} />
                  Запросить КП у поставщиков
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 p-1 rounded-2xl mb-8 overflow-x-auto"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === t.id ? "var(--card-bg)" : "transparent",
                color: activeTab === t.id ? tagColor : "rgba(255,255,255,0.45)",
                border: activeTab === t.id ? `1px solid ${tagColor}44` : "1px solid transparent",
              }}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Описание ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              {/* Описание */}
              {project.description && (
                <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <h2 className="font-display font-bold text-xl text-white mb-4">О проекте</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {project.description}
                  </p>
                </div>
              )}

              {/* Особенности подробно */}
              {features.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <h2 className="font-display font-bold text-xl text-white mb-4">Особенности проекта</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${tagColor}18` }}>
                          <Icon name="Check" size={12} style={{ color: tagColor }} />
                        </div>
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Документы */}
              {docs.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <h2 className="font-display font-bold text-xl text-white mb-4">Документация</h2>
                  <div className="space-y-2">
                    {docs.map(f => (
                      <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:scale-[1.01]"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <Icon name="FileText" size={16} style={{ color: tagColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white truncate">{f.file_name}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{FILE_TYPE_LABELS[f.file_type] || "Файл"}</div>
                        </div>
                        <Icon name="Download" size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Сайдбар */}
            <div className="space-y-4">
              <div className="rounded-2xl p-5 sticky top-20" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <h3 className="font-display font-semibold text-base text-white mb-4">Технические данные</h3>
                <div className="space-y-3">
                  {[
                    { label: "Тип дома", value: project.type },
                    { label: "Общая площадь", value: `${project.area} м²` },
                    { label: "Количество этажей", value: `${project.floors}` },
                    { label: "Количество комнат", value: `${project.rooms}` },
                    ...(project.roof_type ? [{ label: "Тип кровли", value: project.roof_type }] : []),
                    ...(project.foundation_type ? [{ label: "Фундамент", value: project.foundation_type }] : []),
                    ...(project.wall_type ? [{ label: "Стеновой материал", value: project.wall_type }] : []),
                    { label: "Обновлён", value: fmtDate(project.updated_at) },
                  ].map((row, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 py-2"
                      style={{ borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{row.label}</span>
                      <span className="text-xs font-semibold text-white text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setActiveTab("request")} className="mt-4 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{ background: tagColor, color: "#0a0d14" }}>
                  Оставить заявку
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Чертежи ── */}
        {activeTab === "drawings" && (
          <div className="animate-fade-in">
            {drawings.length === 0 ? (
              <div className="rounded-2xl p-16 text-center" style={{ background: "var(--card-bg)", border: "1px dashed rgba(255,255,255,0.1)" }}>
                <Icon name="LayoutGrid" size={40} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto 12px" }} />
                <p className="text-white font-semibold mb-1">Чертежи ещё не загружены</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Архитектор добавит их в ближайшее время</p>
              </div>
            ) : (
              <div className="space-y-8">
                {(["plan","facade","section"] as const).map(type => {
                  const files = drawings.filter(f => f.file_type === type);
                  if (!files.length) return null;
                  return (
                    <div key={type}>
                      <h3 className="font-display font-semibold text-lg text-white mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-5 rounded-full inline-block" style={{ background: tagColor }} />
                        {FILE_TYPE_LABELS[type]}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {files.map(f => (
                          <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                            className="rounded-2xl overflow-hidden block transition-all hover:scale-[1.01]"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                            {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.file_url) ? (
                              <img src={f.file_url} alt={f.file_name} className="w-full object-contain max-h-96"
                                style={{ background: "rgba(255,255,255,0.02)" }} />
                            ) : (
                              <div className="flex items-center gap-3 px-5 py-4"
                                style={{ background: "rgba(255,255,255,0.03)" }}>
                                <Icon name="FileText" size={20} style={{ color: tagColor }} />
                                <div>
                                  <div className="text-sm text-white">{f.file_name}</div>
                                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Нажмите для просмотра</div>
                                </div>
                                <Icon name="ExternalLink" size={14} style={{ color: "rgba(255,255,255,0.3)", marginLeft: "auto" }} />
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Смета ── */}
        {activeTab === "spec" && (
          <div className="animate-fade-in">
            {loadingSpec ? (
              <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
                <div className="w-8 h-8 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
                  style={{ borderTopColor: tagColor }} />
                Загружаем смету...
              </div>
            ) : !spec || !spec.items?.length ? (
              <div className="rounded-2xl p-16 text-center" style={{ background: "var(--card-bg)", border: "1px dashed rgba(255,255,255,0.1)" }}>
                <Icon name="ClipboardList" size={40} style={{ color: "rgba(255,255,255,0.1)", margin: "0 auto 12px" }} />
                <p className="text-white font-semibold mb-1">Смета ещё не составлена</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Конструктор добавит позиции в ближайшее время</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Итог вверху */}
                <div className="rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
                  style={{ background: `${tagColor}0d`, border: `1px solid ${tagColor}33` }}>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Итого по смете</div>
                    <div className="font-display font-black text-2xl" style={{ color: tagColor }}>{fmt(specTotal)} ₽</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {spec.items.length} позиций · версия {spec.version} · {spec.status === "approved" ? "✓ Утверждена" : "Черновик"}
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("request")}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{ background: tagColor, color: "#0a0d14" }}>
                    <Icon name="Phone" size={15} />
                    Заказать строительство
                  </button>
                </div>

                {/* Разделы сметы */}
                {specSections.map(({ section, color, items, total }) => {
                  const isOpen = openSections.has(section);
                  return (
                    <div key={section} className="rounded-2xl overflow-hidden"
                      style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      <button className="w-full flex items-center justify-between px-5 py-4 text-left transition-all hover:bg-white/5"
                        style={{ background: "rgba(255,255,255,0.03)" }}
                        onClick={() => setOpenSections(prev => {
                          const s = new Set(prev);
                          if (s.has(section)) s.delete(section); else s.add(section);
                          return s;
                        })}>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                          <span className="font-semibold text-white">{section}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                            {items.length} поз.
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-display font-bold" style={{ color }}>{fmt(total)} ₽</span>
                          <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                {["Наименование","Ед.","Кол-во","Цена/ед.","Итого"].map((h, i) => (
                                  <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold"
                                    style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, i) => (
                                <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                                  <td className="px-4 py-3">
                                    <div className="text-white">{item.name}</div>
                                    {item.note && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{item.note}</div>}
                                  </td>
                                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{item.qty}</td>
                                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{fmt(item.price_per_unit)} ₽</td>
                                  <td className="px-4 py-3 font-semibold text-sm" style={{ color }}>{fmt(item.total_price)} ₽</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Заявка ── */}
        {activeTab === "request" && (
          <div className="max-w-xl mx-auto animate-fade-in">
            {submitted ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: `1px solid ${tagColor}44` }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${tagColor}15` }}>
                  <Icon name="CheckCircle2" size={32} style={{ color: tagColor }} />
                </div>
                <h2 className="font-display font-bold text-2xl text-white mb-2">Заявка принята!</h2>
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Наш менеджер свяжется с вами в ближайшее время для уточнения деталей по проекту «{project.name}»
                </p>
                <button onClick={() => navigate("/")}
                  className="px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: tagColor, color: "#0a0d14" }}>
                  Смотреть другие проекты
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-8" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: tagColor }}>
                  Заявка на строительство
                </div>
                <h2 className="font-display font-bold text-2xl text-white mb-1">{project.name}</h2>
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {project.area} м² · {project.floors} эт. · от {fmt(project.price)} ₽
                </p>

                <form onSubmit={submitRequest} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Ваше имя *
                    </label>
                    <input
                      type="text" required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Иван Иванов"
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onFocus={e => { e.target.style.borderColor = tagColor; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Телефон *
                    </label>
                    <input
                      type="tel" required value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+7 900 000-00-00"
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onFocus={e => { e.target.style.borderColor = tagColor; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Комментарий
                    </label>
                    <textarea
                      rows={3} value={form.comment}
                      onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                      placeholder="Расскажите о пожеланиях — участок, сроки, бюджет..."
                      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all resize-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      onFocus={e => { e.target.style.borderColor = tagColor; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>

                  <button type="submit" disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold transition-all hover:scale-[1.02] disabled:opacity-60"
                    style={{ background: tagColor, color: "#0a0d14", boxShadow: `0 0 24px ${tagColor}44` }}>
                    {submitting
                      ? <><Icon name="Loader2" size={18} className="animate-spin" /> Отправляем...</>
                      : <><Icon name="Send" size={18} /> Отправить заявку</>
                    }
                  </button>

                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Нажимая кнопку, вы соглашаетесь с обработкой персональных данных
                  </p>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
