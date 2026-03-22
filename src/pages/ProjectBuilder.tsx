import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatWidget from "@/components/ChatWidget";

const AI_URL = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";
const CRM_URL = "https://functions.poehali.dev/ca6be6cc-ad08-4970-a85b-363894cb1a6f";

const STYLES = [
  { id: "современный", label: "Современный", icon: "🏢", desc: "Минимализм, стекло, бетон" },
  { id: "скандинавский", label: "Скандинавский", icon: "🌲", desc: "Светлые тона, дерево, уют" },
  { id: "классический", label: "Классический", icon: "🏛️", desc: "Симметрия, колонны, лепнина" },
  { id: "хай-тек", label: "Хай-тек", icon: "⚡", desc: "Металл, геометрия, умный дом" },
  { id: "прованс", label: "Прованс", icon: "🌸", desc: "Камень, арки, виноград" },
  { id: "лофт", label: "Лофт", icon: "🧱", desc: "Кирпич, открытые балки, металл" },
];

const HOUSE_TYPES = [
  { id: "кирпичный", label: "Кирпичный", icon: "🧱", priceMultiplier: 1.4 },
  { id: "каркасный", label: "Каркасный", icon: "🏗️", priceMultiplier: 0.85 },
  { id: "газобетон", label: "Газобетон", icon: "🟫", priceMultiplier: 1.1 },
  { id: "деревянный", label: "Деревянный", icon: "🪵", priceMultiplier: 1.0 },
  { id: "монолитный", label: "Монолитный", icon: "🏢", priceMultiplier: 1.6 },
  { id: "модульный", label: "Модульный", icon: "📦", priceMultiplier: 0.75 },
];

const FEATURES_LIST = [
  { id: "garage", label: "Гараж", icon: "🚗" },
  { id: "pool", label: "Бассейн", icon: "🏊" },
  { id: "sauna", label: "Баня/Сауна", icon: "🧖" },
  { id: "terrace", label: "Терраса", icon: "🏡" },
  { id: "smart", label: "Умный дом", icon: "🏠" },
  { id: "solar", label: "Солнечные панели", icon: "☀️" },
  { id: "fireplace", label: "Камин", icon: "🔥" },
  { id: "basement", label: "Подвал/Цокольный", icon: "🏚️" },
];

interface GeneratedProject {
  name: string;
  description: string;
  features: string;
  tag: string;
  render_url: string;
  suggested: { type: string; area: number; floors: number; rooms: number; price: number };
}

function formatPrice(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн ₽";
  return (n / 1_000).toFixed(0) + " тыс ₽";
}

export default function ProjectBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedProject | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);

  const [prefs, setPrefs] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    budget: 5000000,
    area: 120,
    floors: 2,
    rooms: 4,
    style: "современный",
    house_type: "кирпичный",
    wishes: "",
    extras: [] as string[],
  });

  const set = (k: string, v: unknown) => setPrefs(p => ({ ...p, [k]: v }));
  const toggleExtra = (id: string) =>
    setPrefs(p => ({ ...p, extras: p.extras.includes(id) ? p.extras.filter(x => x !== id) : [...p.extras, id] }));

  const generate = async () => {
    setLoading(true);
    setRenderLoading(true);
    try {
      const res = await fetch(`${AI_URL}?action=ai_generate_project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            ...prefs,
            wishes: [prefs.wishes, prefs.extras.map(e => FEATURES_LIST.find(f => f.id === e)?.label).join(", ")].filter(Boolean).join(". "),
          },
        }),
      }).then(r => r.json());
      if (res.ok) {
        setResult(res);
        setStep(4);
        // Автоматически создаём лид в CRM
        if (prefs.client_name && prefs.client_phone) {
          fetch(`${CRM_URL}?action=create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: prefs.client_name,
              phone: prefs.client_phone,
              email: prefs.client_email || null,
              source_id: 1,
              source_detail: "Конструктор проекта",
              stage: "new",
              area_desired: prefs.area,
              floors_desired: prefs.floors,
              rooms_desired: prefs.rooms,
              wall_material_pref: prefs.house_type,
              budget: prefs.budget,
            }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRenderLoading(false);
    }
  };

  const inp = "w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-orange) 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg transition-all hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="ArrowLeft" size={18} />
          </button>
          <div>
            <div className="font-display font-bold text-lg text-white">Конструктор проекта</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>AI создаст проект по вашим пожеланиям</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Step indicator */}
        {step < 4 && (
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={{
                    background: step === s ? "var(--neon-cyan)" : step > s ? "var(--neon-green)" : "rgba(255,255,255,0.07)",
                    color: step >= s ? "#000" : "rgba(255,255,255,0.4)",
                  }}>
                  {step > s ? "✓" : s}
                </div>
                <span className="text-xs hidden sm:block"
                  style={{ color: step === s ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                  {s === 1 ? "Параметры" : s === 2 ? "Стиль и тип" : "Контакты"}
                </span>
                {s < 3 && <div className="w-8 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />}
              </div>
            ))}
          </div>
        )}

        {/* ── Шаг 1: Параметры ── */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Шаг 1</div>
              <h2 className="font-display text-3xl font-bold text-white">Параметры дома</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Укажите основные характеристики</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Бюджет</span>
                  <span className="font-display font-bold text-lg" style={{ color: "var(--neon-cyan)" }}>{formatPrice(prefs.budget)}</span>
                </div>
                <input type="range" min={1000000} max={50000000} step={500000} value={prefs.budget}
                  onChange={e => set("budget", +e.target.value)} style={{ accentColor: "var(--neon-cyan)" }} />
                <div className="flex justify-between mt-1 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>1 млн</span><span>50 млн</span>
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Площадь</span>
                  <span className="font-display font-bold text-lg" style={{ color: "var(--neon-orange)" }}>{prefs.area} м²</span>
                </div>
                <input type="range" min={40} max={500} step={10} value={prefs.area}
                  onChange={e => set("area", +e.target.value)} style={{ accentColor: "var(--neon-orange)" }} />
                <div className="flex justify-between mt-1 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>40 м²</span><span>500 м²</span>
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>Этажей</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map(f => (
                    <button key={f} onClick={() => set("floors", f)}
                      className="flex-1 py-3 rounded-xl font-display font-bold text-xl transition-all"
                      style={{
                        background: prefs.floors === f ? "var(--neon-cyan)" : "rgba(255,255,255,0.05)",
                        color: prefs.floors === f ? "#000" : "rgba(255,255,255,0.5)",
                      }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>Комнат</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(r => (
                    <button key={r} onClick={() => set("rooms", r)}
                      className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: prefs.rooms === r ? "var(--neon-orange)" : "rgba(255,255,255,0.05)",
                        color: prefs.rooms === r ? "#000" : "rgba(255,255,255,0.5)",
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>Дополнительные опции</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FEATURES_LIST.map(f => (
                  <button key={f.id} onClick={() => toggleExtra(f.id)}
                    className="flex items-center gap-2 p-3 rounded-xl text-sm transition-all"
                    style={{
                      background: prefs.extras.includes(f.id) ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: prefs.extras.includes(f.id) ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                      color: prefs.extras.includes(f.id) ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)",
                    }}>
                    <span>{f.icon}</span><span className="text-xs">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-4 rounded-xl font-display font-semibold text-lg tracking-wide transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 25px rgba(0,212,255,0.3)" }}>
              Далее →
            </button>
          </div>
        )}

        {/* ── Шаг 2: Стиль и тип ── */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Шаг 2</div>
              <h2 className="font-display text-3xl font-bold text-white">Стиль и конструкция</h2>
            </div>

            <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>Архитектурный стиль</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => set("style", s.id)}
                    className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                    style={{
                      background: prefs.style === s.id ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: prefs.style === s.id ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <div className="font-semibold text-sm text-white">{s.label}</div>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>Тип строения</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {HOUSE_TYPES.map(h => (
                  <button key={h.id} onClick={() => set("house_type", h.id)}
                    className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                    style={{
                      background: prefs.house_type === h.id ? "rgba(255,107,26,0.12)" : "rgba(255,255,255,0.04)",
                      border: prefs.house_type === h.id ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    <div className="text-2xl mb-2">{h.icon}</div>
                    <div className="font-semibold text-sm text-white">{h.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <label className="block text-sm font-medium mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Особые пожелания</label>
              <textarea value={prefs.wishes} onChange={e => set("wishes", e.target.value)} rows={3}
                placeholder="Панорамные окна, открытая кухня, спортивный зал, детская игровая..."
                className={inp} style={{ ...inpStyle, resize: "none" }} />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl font-semibold text-base transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                ← Назад
              </button>
              <button onClick={() => setStep(3)} className="flex-[3] py-4 rounded-xl font-display font-semibold text-lg transition-all hover:scale-[1.01]"
                style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000" }}>
                Далее →
              </button>
            </div>
          </div>
        )}

        {/* ── Шаг 3: Контакты + генерация ── */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Шаг 3</div>
              <h2 className="font-display text-3xl font-bold text-white">Контактные данные</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Необязательно — результат покажем сразу на экране</p>
            </div>

            <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              {[
                { key: "client_name", label: "Ваше имя", placeholder: "Иван Петров", type: "text" },
                { key: "client_phone", label: "Телефон", placeholder: "+7 900 000-00-00", type: "tel" },
                { key: "client_email", label: "Email", placeholder: "ivan@mail.ru", type: "email" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={(prefs as Record<string, unknown>)[f.key] as string}
                    onChange={e => set(f.key, e.target.value)}
                    className={inp} style={inpStyle} />
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.2)" }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--neon-cyan)" }}>Ваш запрос</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Бюджет", val: formatPrice(prefs.budget) },
                  { label: "Площадь", val: `${prefs.area} м²` },
                  { label: "Этажей", val: prefs.floors },
                  { label: "Комнат", val: prefs.rooms },
                  { label: "Стиль", val: prefs.style },
                  { label: "Тип", val: prefs.house_type },
                ].map((p, i) => (
                  <div key={i}>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{p.label}</div>
                    <div className="font-semibold text-white capitalize">{p.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl font-semibold text-base transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                ← Назад
              </button>
              <button onClick={generate} disabled={loading}
                className="flex-[3] py-4 rounded-xl font-display font-semibold text-lg tracking-wide transition-all hover:scale-[1.01] disabled:opacity-70 flex items-center justify-center gap-3"
                style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 30px rgba(255,107,26,0.4)" }}>
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 rounded-full animate-spin" style={{ borderTopColor: "#fff" }} />
                    Генерация проекта...
                  </>
                ) : (
                  <>🤖 Создать проект с AI</>
                )}
              </button>
            </div>
            {loading && (
              <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                AI создаёт описание и рендер дома — обычно 15-30 секунд
              </div>
            )}
          </div>
        )}

        {/* ── Результат ── */}
        {step === 4 && result && (
          <div className="animate-fade-in space-y-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-green)" }}>Готово!</div>
              <h2 className="font-display text-3xl font-bold text-white">Ваш проект создан</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Рендер */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                {renderLoading ? (
                  <div className="h-72 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-center">
                      <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: "var(--neon-orange)" }} />
                      <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Генерация рендера...</div>
                    </div>
                  </div>
                ) : result.render_url ? (
                  <img src={result.render_url} alt={result.name} className="w-full object-cover" style={{ height: 288 }} />
                ) : (
                  <div className="h-72 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-center">
                      <div className="text-5xl mb-2">🏠</div>
                      <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Рендер будет доступен после добавления OPENAI_API_KEY</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Описание */}
              <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,255,136,0.2)" }}>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold font-display"
                    style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.3)" }}>
                    {result.tag}
                  </span>
                </div>
                <h3 className="font-display font-black text-2xl text-white">{result.name}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{result.description}</p>
                {result.features && (
                  <div className="space-y-1.5">
                    {result.features.split(",").map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--neon-green)" }} />
                        {f.trim()}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {[
                    { label: "Площадь", val: `${result.suggested.area} м²` },
                    { label: "Этажей", val: result.suggested.floors },
                    { label: "Тип", val: result.suggested.type },
                    { label: "Бюджет от", val: formatPrice(result.suggested.price) },
                  ].map((p, i) => (
                    <div key={i} className="rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{p.label}</div>
                      <div className="font-semibold text-sm text-white">{p.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => { setStep(1); setResult(null); }}
                className="py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10 flex items-center justify-center gap-2"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                <Icon name="RotateCcw" size={15} /> Создать другой
              </button>
              <button onClick={() => navigate("/")}
                className="py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
                <Icon name="Calculator" size={15} /> Рассчитать стоимость
              </button>
              <button onClick={() => navigate("/")}
                className="py-3.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 20px rgba(255,107,26,0.3)" }}>
                <Icon name="Phone" size={15} /> Связаться с нами
              </button>
            </div>

            <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(255,107,26,0.06)", border: "1px solid rgba(255,107,26,0.15)" }}>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Проект передан нашим архитекторам для проработки.
                Мы свяжемся с вами в течение рабочего дня.
              </div>
            </div>
          </div>
        )}
      </main>

      <ChatWidget role="visitor" />
    </div>
  );
}