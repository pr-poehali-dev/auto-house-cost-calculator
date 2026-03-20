import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/b313eb2b-033b-49ed-a7e1-33dd33b4938b";
const MATERIALS_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";
const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";
const SUPPLIER_API = "https://functions.poehali.dev/0864e1a5-8fce-4370-a525-80d6700b50ee";
const SUPPLY_OPS = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";

const TOKEN_KEY = "staff_token";

interface StaffUser {
  id: number;
  login: string;
  full_name: string;
  role_code: string;
}

interface Material {
  id: number;
  category: string;
  name: string;
  unit: string;
  price_per_unit: number;
  qty_formula: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

interface HouseProject {
  id: number;
  name: string;
  type: string;
  area: number;
  floors: number;
  rooms: number;
  price: number;
  tag: string;
  tag_color: string;
  description: string;
  features: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  architect: "Архитектор",
  constructor: "Конструктор",
  engineer: "Инженер",
  lawyer: "Юрист",
  supply: "Снабженец",
};

const ROLE_COLORS: Record<string, string> = {
  architect: "#00D4FF",
  constructor: "#FF6B1A",
  engineer: "#00FF88",
  lawyer: "#A855F7",
  supply: "#FBBF24",
};

const ROLE_ICONS: Record<string, string> = {
  architect: "Pencil",
  constructor: "Wrench",
  engineer: "Settings",
  lawyer: "Scale",
  supply: "ShoppingCart",
};

function authFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...(opts.headers || {}),
    },
  }).then(r => r.json());
}

// ─── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: StaffUser, token: string) => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ login, password }) });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem(TOKEN_KEY, res.token);
    onLogin(res.staff, res.token);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-orange) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 40px rgba(255,107,26,0.4)" }}>
            СК
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Личный кабинет</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Вход для сотрудников</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5"
          style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Логин
            </label>
            <input
              type="text" value={login} onChange={e => setLogin(e.target.value)}
              placeholder="architect1"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => e.target.style.borderColor = "var(--neon-orange)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
              Пароль
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              onFocus={e => e.target.style.borderColor = "var(--neon-orange)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              При первом входе придуманный вами пароль станет постоянным
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-[1.02] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 25px rgba(255,107,26,0.35)" }}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard shell ───────────────────────────────────────────────────────────
function DashboardShell({ user, token, onLogout, children }: {
  user: StaffUser; token: string; onLogout: () => void; children: React.ReactNode
}) {
  const color = ROLE_COLORS[user.role_code] || "#fff";
  const icon = ROLE_ICONS[user.role_code] || "User";

  return (
    <div className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-xs"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff" }}>
              СК
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-semibold text-sm text-white">СтройКалькулятор</span>
              <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>Кабинет сотрудника</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: `${color}18`, border: `1px solid ${color}44` }}>
              <Icon name={icon} size={13} style={{ color }} />
              <span className="text-xs font-semibold" style={{ color }}>{ROLE_LABELS[user.role_code]}</span>
            </div>
            <div className="text-sm text-white hidden sm:block">{user.full_name}</div>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="LogOut" size={13} />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative">
        {children}
      </main>
    </div>
  );
}

// ─── Architect cabinet ─────────────────────────────────────────────────────────
function ArchitectCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [projects, setProjects] = useState<HouseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4, price: 5000000, tag: "", tag_color: "#FF6B1A", description: "", features: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(PROJECTS_URL, {}, token);
    setProjects(res.projects || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (p: HouseProject) => {
    setForm({ name: p.name, type: p.type, area: p.area, floors: p.floors, rooms: p.rooms, price: p.price, tag: p.tag, tag_color: p.tag_color, description: p.description, features: p.features, is_active: p.is_active });
    setEditingId(p.id);
    setShowForm(true);
  };

  const openNew = () => {
    setForm({ name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4, price: 5000000, tag: "", tag_color: "#FF6B1A", description: "", features: "", is_active: true });
    setEditingId(null);
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const url = editingId ? `${PROJECTS_URL}/${editingId}` : PROJECTS_URL;
    const method = editingId ? "PUT" : "POST";
    const res = await authFetch(url, { method, body: JSON.stringify(form) }, token);
    setSaving(false);
    if (res.ok) { setMsg("Сохранено!"); setShowForm(false); load(); }
    else setMsg(res.error || "Ошибка");
  };

  const HOUSE_TYPES = ["Кирпичный", "Каркасный", "Монолитный", "Деревянный", "Газобетон", "Модульный"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Архитектор</div>
          <h2 className="font-display text-2xl font-bold text-white">Проекты домов</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Добро пожаловать, {user.full_name}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "var(--neon-cyan)", color: "#0A0D14", boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
          <Icon name="Plus" size={15} />
          Новый проект
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-6 mb-6 animate-scale-in"
          style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.3)" }}>
          <h3 className="font-display font-semibold text-lg text-white mb-5">
            {editingId ? "Редактировать проект" : "Новый проект"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Название", key: "name", type: "text", placeholder: "Эко Минимал" },
              { label: "Описание", key: "description", type: "text", placeholder: "Краткое описание" },
              { label: "Метка (тег)", key: "tag", type: "text", placeholder: "Хит / Новинка" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string, unknown>)[f.key] as string}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {HOUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {[
              { label: "Площадь (м²)", key: "area", type: "number" },
              { label: "Этажей", key: "floors", type: "number" },
              { label: "Комнат", key: "rooms", type: "number" },
              { label: "Цена (₽)", key: "price", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                <input type={f.type} value={(form as Record<string, unknown>)[f.key] as number}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: +e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Особенности (через запятую)</label>
              <input type="text" value={form.features}
                onChange={e => setForm(p => ({ ...p, features: e.target.value }))}
                placeholder="Камин, Терраса, Панорамные окна"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          </div>
          {msg && <div className="mt-3 text-sm" style={{ color: msg === "Сохранено!" ? "var(--neon-green)" : "#ef4444" }}>{msg}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "var(--neon-cyan)", color: "#0A0D14" }}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Projects list */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-5xl mb-3">🏗️</div>
          <div className="font-display text-lg text-white">Проектов пока нет</div>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Нажмите «Новый проект» чтобы добавить первый</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <div key={p.id} className="rounded-2xl p-5 transition-all hover:scale-[1.01]"
              style={{ background: "var(--card-bg)", border: `1px solid ${p.is_active ? "var(--card-border)" : "rgba(255,255,255,0.04)"}`, opacity: p.is_active ? 1 : 0.5, animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${p.tag_color}22`, color: p.tag_color, border: `1px solid ${p.tag_color}44` }}>
                  {p.tag || "—"}
                </div>
                <div className="flex gap-1">
                  {!p.is_active && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Скрыт</span>}
                  <button onClick={() => openEdit(p)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/15"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                    <Icon name="Pencil" size={13} />
                  </button>
                </div>
              </div>
              <div className="font-display font-bold text-lg text-white mb-1">{p.name}</div>
              <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{p.type} · {p.area} м² · {p.floors} эт.</div>
              <div className="font-display font-bold text-base" style={{ color: p.tag_color }}>
                {(p.price / 1_000_000).toFixed(1)} млн ₽
              </div>
              <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                {p.updated_at ? new Date(p.updated_at).toLocaleDateString("ru-RU") : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Constructor cabinet ───────────────────────────────────────────────────────
function ConstructorCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", name: "", unit: "", price_per_unit: 0, qty_formula: "", sort_order: 0, is_active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filterCat, setFilterCat] = useState("Все");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(MATERIALS_URL, {}, token);
    setMaterials(res.items || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const categories = ["Все", ...Array.from(new Set(materials.map(m => m.category)))];
  const filtered = filterCat === "Все" ? materials : materials.filter(m => m.category === filterCat);

  const openEdit = (m: Material) => {
    setForm({ category: m.category, name: m.name, unit: m.unit, price_per_unit: m.price_per_unit, qty_formula: m.qty_formula, sort_order: m.sort_order, is_active: m.is_active });
    setEditingId(m.id); setShowForm(true);
  };

  const openNew = () => {
    setForm({ category: "", name: "", unit: "м²", price_per_unit: 0, qty_formula: "a * 1", sort_order: 0, is_active: true });
    setEditingId(null); setShowForm(true);
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const url = editingId ? `${MATERIALS_URL}/${editingId}` : MATERIALS_URL;
    const method = editingId ? "PUT" : "POST";
    const res = await authFetch(url, { method, body: JSON.stringify(form) }, token);
    setSaving(false);
    if (res.ok) { setMsg("Сохранено!"); setShowForm(false); load(); }
    else setMsg(res.error || "Ошибка");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-orange)" }}>Конструктор</div>
          <h2 className="font-display text-2xl font-bold text-white">Материалы и работы</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Добро пожаловать, {user.full_name}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "var(--neon-orange)", color: "#fff", boxShadow: "0 0 20px rgba(255,107,26,0.3)" }}>
          <Icon name="Plus" size={15} />
          Добавить позицию
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-6 mb-6 animate-scale-in"
          style={{ background: "var(--card-bg)", border: "1px solid rgba(255,107,26,0.3)" }}>
          <h3 className="font-display font-semibold text-lg text-white mb-5">
            {editingId ? "Редактировать позицию" : "Новая позиция"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: "Раздел", key: "category", placeholder: "Фундамент" },
              { label: "Наименование", key: "name", placeholder: "Бетон М300" },
              { label: "Единица", key: "unit", placeholder: "м³" },
              { label: "Цена за ед. (₽)", key: "price_per_unit", type: "number" },
              { label: "Формула количества", key: "qty_formula", placeholder: "a * 0.25" },
              { label: "Порядок", key: "sort_order", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                <input type={f.type || "text"}
                  value={(form as Record<string, unknown>)[f.key] as string | number}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === "number" ? +e.target.value : e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="mat_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            <label htmlFor="mat_active" className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Активна (участвует в расчёте)</label>
          </div>
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
            В формуле: <code style={{ color: "var(--neon-cyan)" }}>a</code> = площадь, <code style={{ color: "var(--neon-cyan)" }}>fl</code> = этажи
          </p>
          {msg && <div className="mt-3 text-sm" style={{ color: msg === "Сохранено!" ? "var(--neon-green)" : "#ef4444" }}>{msg}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "var(--neon-orange)", color: "#fff" }}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filterCat === c ? "var(--neon-orange)" : "rgba(255,255,255,0.06)",
              color: filterCat === c ? "#fff" : "rgba(255,255,255,0.5)",
              border: filterCat === c ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Раздел", "Наименование", "Ед.", "Цена/ед., ₽", "Формула", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent", opacity: m.is_active ? 1 : 0.45 }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{m.category}</td>
                  <td className="px-4 py-3 text-white">{m.name}</td>
                  <td className="px-4 py-3 text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{m.unit}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--neon-orange)" }}>{m.price_per_unit.toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--neon-cyan)" }}>{m.qty_formula}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(m)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/15"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      <Icon name="Pencil" size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Нет позиций</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Supply cabinet ────────────────────────────────────────────────────────────
interface RFQRow { id: number; title: string; construction_address: string; area: number; floors: number; house_type: string; items: {name:string;unit:string;qty:number}[]; deadline: string|null; status: string; proposals_count: number; }
interface ProposalRow { id: number; supplier_id: number; company_name: string; phone: string; email: string; total_amount: number; delivery_days: number; comment: string; status: string; submitted_at: string; }
interface SupplierRow { id: number; company_name: string; contact_name: string; email: string; phone: string; categories: string; region: string; is_verified: boolean; }
interface InvoiceRow { id: number; invoice_number: string; amount: number; status: string; created_at: string; rfq_title: string; company_name: string; }

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }

function SupplyCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [tab, setTab] = useState<"rfqs"|"suppliers"|"prices"|"invoices">("rfqs");
  // RFQ
  const [rfqs, setRfqs] = useState<RFQRow[]>([]);
  const [selectedRfq, setSelectedRfq] = useState<(RFQRow & { proposals?: ProposalRow[] }) | null>(null);
  const [showRfqForm, setShowRfqForm] = useState(false);
  const [rfqForm, setRfqForm] = useState({ title: "", construction_address: "", area: 100, floors: 2, house_type: "Кирпичный", deadline: "", items: [] as {name:string;unit:string;qty:number}[] });
  const [notifyStatus, setNotifyStatus] = useState("");
  // Suppliers
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  // Prices
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [filterCat, setFilterCat] = useState("Все");
  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [generatingInv, setGeneratingInv] = useState<number | null>(null);
  const [invMsg, setInvMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const supFetch = useCallback((url: string, opts: RequestInit = {}) =>
    fetch(url, { ...opts, headers: { "Content-Type": "application/json", "X-Auth-Token": token, ...(opts.headers||{}) } }).then(r => r.json()), [token]);

  const loadRfqs = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_list`);
    setRfqs(res.rfqs || []); setLoading(false);
  }, [supFetch]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLIER_API}?action=suppliers_list`);
    setSuppliers(res.suppliers || []); setLoading(false);
  }, [supFetch]);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(MATERIALS_URL, {}, token);
    setMaterials(res.items || []); setLoading(false);
  }, [token]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLY_OPS}?action=invoices_list`);
    setInvoices(res.invoices || []); setLoading(false);
  }, [supFetch]);

  useEffect(() => {
    if (tab === "rfqs") loadRfqs();
    else if (tab === "suppliers") loadSuppliers();
    else if (tab === "prices") loadMaterials();
    else if (tab === "invoices") loadInvoices();
  }, [tab, loadRfqs, loadSuppliers, loadMaterials, loadInvoices]);

  const openRfq = async (rfq: RFQRow) => {
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_get`, { method: "POST", body: JSON.stringify({ rfq_id: rfq.id }) });
    setSelectedRfq(res.rfq || null);
  };

  const createRfq = async () => {
    setSaving(true);
    const items = (materials || []).slice(0, 20).map(m => ({ name: m.name, unit: m.unit, qty: rfqForm.area }));
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_create`, { method: "POST", body: JSON.stringify({ ...rfqForm, items }) });
    setSaving(false);
    if (res.ok) { setShowRfqForm(false); loadRfqs(); }
  };

  const notifySuppliers = async (rfq_id: number) => {
    setNotifyStatus("Рассылка...");
    const res = await supFetch(`${SUPPLIER_API}?action=notify`, { method: "POST", body: JSON.stringify({ rfq_id, channels: ["email","sms"] }) });
    setNotifyStatus(res.ok ? `Отправлено email: ${res.results?.sent_email}, SMS: ${res.results?.sent_sms}` : res.error || "Ошибка");
  };

  const awardProposal = async (rfq_id: number, proposal_id: number) => {
    await supFetch(`${SUPPLIER_API}?action=rfq_award`, { method: "POST", body: JSON.stringify({ rfq_id, proposal_id }) });
    openRfq(selectedRfq!);
  };

  const generateInvoice = async (proposal_id: number) => {
    setGeneratingInv(proposal_id); setInvMsg("");
    const res = await supFetch(`${SUPPLY_OPS}?action=generate_invoice`, { method: "POST", body: JSON.stringify({ proposal_id }) });
    setGeneratingInv(null);
    if (res.ok) {
      setInvMsg(`Счёт ${res.invoice_number} создан`);
      if (res.pdf_base64) {
        const link = document.createElement("a");
        link.href = "data:application/pdf;base64," + res.pdf_base64;
        link.download = `${res.invoice_number}.pdf`;
        link.click();
      }
    } else setInvMsg(res.error || "Ошибка генерации");
  };

  const verifySupplier = async (id: number, verified: boolean) => {
    await supFetch(`${SUPPLIER_API}?action=verify_supplier`, { method: "POST", body: JSON.stringify({ supplier_id: id, is_verified: verified }) });
    loadSuppliers();
  };

  const savePrice = async (id: number) => {
    setSaving(true);
    const res = await authFetch(`${MATERIALS_URL}/${id}`, { method: "PUT", body: JSON.stringify({ price_per_unit: +newPrice }) }, token);
    setSaving(false);
    if (res.ok) { setEditingPriceId(null); setNewPrice(""); loadMaterials(); }
  };

  const TABS = [
    { id: "rfqs", label: "Запросы КП", icon: "FileText" },
    { id: "suppliers", label: "Поставщики", icon: "Building2" },
    { id: "prices", label: "Цены", icon: "Tag" },
    { id: "invoices", label: "Счета", icon: "Receipt" },
  ] as const;

  const matCategories = ["Все", ...Array.from(new Set(materials.map(m => m.category)))];
  const filteredMats = filterCat === "Все" ? materials : materials.filter(m => m.category === filterCat);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#FBBF24" }}>Снабженец</div>
          <h2 className="font-display text-2xl font-bold text-white">Снабжение и закупки</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Добро пожаловать, {user.full_name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t.id ? "#FBBF24" : "transparent", color: tab === t.id ? "#000" : "rgba(255,255,255,0.5)" }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── RFQ tab ── */}
      {tab === "rfqs" && (
        <div>
          {selectedRfq ? (
            <div className="animate-fade-in">
              <button onClick={() => setSelectedRfq(null)} className="flex items-center gap-2 mb-4 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                <Icon name="ChevronLeft" size={15} /> К списку
              </button>
              <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.25)" }}>
                <div className="font-display font-bold text-xl text-white mb-1">{selectedRfq.title}</div>
                <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>📍 {selectedRfq.construction_address} · {selectedRfq.area} м² · {selectedRfq.floors} эт.</div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => notifySuppliers(selectedRfq.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{ background: "#FBBF24", color: "#000" }}>
                    <Icon name="Send" size={14} /> Разослать уведомления
                  </button>
                  {notifyStatus && <span className="text-xs self-center" style={{ color: "rgba(255,255,255,0.5)" }}>{notifyStatus}</span>}
                </div>
              </div>
              {invMsg && <div className="mb-4 px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(0,255,136,0.1)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.2)" }}>{invMsg}</div>}
              <h3 className="font-display font-semibold text-lg text-white mb-3">
                Предложения поставщиков — отсортированы по цене
              </h3>
              {(!selectedRfq.proposals || selectedRfq.proposals.length === 0) ? (
                <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <div className="text-4xl mb-2">⏳</div>
                  <div className="text-white">Предложений пока нет</div>
                  <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Разошлите уведомления поставщикам</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedRfq.proposals.map((p, i) => (
                    <div key={p.id} className="rounded-2xl p-5"
                      style={{
                        background: i === 0 ? "rgba(251,191,36,0.08)" : "var(--card-bg)",
                        border: i === 0 ? "1px solid rgba(251,191,36,0.4)" : "1px solid var(--card-border)",
                      }}>
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          {i === 0 && <div className="text-xs font-semibold mb-1" style={{ color: "#FBBF24" }}>🏆 Лучшая цена</div>}
                          <div className="font-display font-bold text-lg text-white">{p.company_name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>📞 {p.phone} · ✉️ {p.email}</div>
                          {p.comment && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>💬 {p.comment}</div>}
                          {p.delivery_days && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>🚚 Срок поставки: {p.delivery_days} дн.</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-display font-black text-2xl" style={{ color: i === 0 ? "#FBBF24" : "rgba(255,255,255,0.7)" }}>
                            {fmt(p.total_amount)} ₽
                          </div>
                          <div className="flex gap-2 mt-2 justify-end flex-wrap">
                            {p.status !== "winner" && selectedRfq.status !== "awarded" && (
                              <button onClick={() => awardProposal(selectedRfq.id, p.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                                style={{ background: "#FBBF24", color: "#000" }}>
                                Выбрать победителя
                              </button>
                            )}
                            {p.status === "winner" && (
                              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)" }}>✓ Победитель</span>
                            )}
                            <button onClick={() => generateInvoice(p.id)} disabled={generatingInv === p.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
                              style={{ background: "rgba(0,212,255,0.15)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.3)" }}>
                              <Icon name="FileDown" size={12} />
                              {generatingInv === p.id ? "Генерация..." : "Выставить счёт PDF"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{rfqs.length} запросов</span>
                <button onClick={() => setShowRfqForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: "#FBBF24", color: "#000" }}>
                  <Icon name="Plus" size={14} /> Новый запрос КП
                </button>
              </div>
              {showRfqForm && (
                <div className="rounded-2xl p-6 mb-5 animate-scale-in" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.3)" }}>
                  <h3 className="font-display font-semibold text-lg text-white mb-4">Создать запрос КП</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {label:"Название объекта",key:"title",placeholder:"Жилой дом, ул. Ленина 12"},
                      {label:"Адрес строительства",key:"construction_address",placeholder:"г. Москва, ул. Ленина, 12"},
                      {label:"Срок подачи КП",key:"deadline",type:"date"},
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                        <input type={f.type||"text"} value={(rfqForm as Record<string,unknown>)[f.key] as string} placeholder={f.placeholder}
                          onChange={e => setRfqForm(p => ({...p,[f.key]:e.target.value}))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      </div>
                    ))}
                    {[{label:"Площадь (м²)",key:"area"},{label:"Этажей",key:"floors"}].map(f => (
                      <div key={f.key}>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                        <input type="number" value={(rfqForm as Record<string,unknown>)[f.key] as number}
                          onChange={e => setRfqForm(p => ({...p,[f.key]:+e.target.value}))}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>Список материалов из сметы будет добавлен автоматически</p>
                  <div className="flex gap-3 mt-4">
                    <button onClick={createRfq} disabled={saving}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                      style={{ background: "#FBBF24", color: "#000" }}>
                      {saving ? "Создание..." : "Создать и разослать"}
                    </button>
                    <button onClick={() => setShowRfqForm(false)}
                      className="px-6 py-2.5 rounded-xl text-sm"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
              {loading ? <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div> : (
                <div className="space-y-3">
                  {rfqs.map((rfq, i) => (
                    <div key={rfq.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.005]"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i*0.04}s both` }}
                      onClick={() => openRfq(rfq)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display font-bold text-lg text-white">{rfq.title}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: rfq.status==="open"?"rgba(0,255,136,0.15)":rfq.status==="awarded"?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.07)", color: rfq.status==="open"?"var(--neon-green)":rfq.status==="awarded"?"#FBBF24":"rgba(255,255,255,0.4)" }}>
                              {rfq.status==="open"?"Открыт":rfq.status==="awarded"?"Завершён":"Закрыт"}
                            </span>
                          </div>
                          <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>📍 {rfq.construction_address} · {rfq.area} м² · {rfq.floors} эт.</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-bold text-xl" style={{ color: "#FBBF24" }}>{rfq.proposals_count || 0}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>предложений</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {rfqs.length === 0 && <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <div className="text-5xl mb-2">📋</div><div className="text-white">Создайте первый запрос КП</div>
                  </div>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Suppliers tab ── */}
      {tab === "suppliers" && (
        <div>
          <div className="mb-4 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{suppliers.length} поставщиков зарегистрировано</div>
          {loading ? <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div> : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Компания","Контакт","Категории","Регион","Статус",""].map((h,i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2?"rgba(255,255,255,0.015)":"transparent" }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{s.company_name}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{s.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{s.contact_name}<br/>{s.phone}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.categories||"").split(",").filter(Boolean).map(c => (
                            <span key={c} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>{c.trim()}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{s.region||"—"}</td>
                      <td className="px-4 py-3">
                        {s.is_verified
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)" }}>✓ Верифицирован</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}>На проверке</span>}
                      </td>
                      <td className="px-4 py-3">
                        {!s.is_verified
                          ? <button onClick={() => verifySupplier(s.id, true)} className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: "var(--neon-green)", color: "#000" }}>Верифицировать</button>
                          : <button onClick={() => verifySupplier(s.id, false)} className="px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>Отозвать</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {suppliers.length === 0 && <div className="text-center py-10" style={{ color: "rgba(255,255,255,0.3)" }}>Поставщики ещё не зарегистрировались</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Prices tab ── */}
      {tab === "prices" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {matCategories.map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: filterCat===c?"#FBBF24":"rgba(255,255,255,0.06)", color: filterCat===c?"#000":"rgba(255,255,255,0.5)", border: filterCat===c?"none":"1px solid rgba(255,255,255,0.08)" }}>
                {c}
              </button>
            ))}
          </div>
          {loading ? <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div> : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Наименование","Ед.","Текущая цена","Новая цена",""].map((h,i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMats.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2?"rgba(255,255,255,0.015)":"transparent" }}>
                      <td className="px-4 py-3"><div className="text-white">{m.name}</div><div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.category}</div></td>
                      <td className="px-4 py-3 text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{m.unit}</td>
                      <td className="px-4 py-3 font-display font-bold" style={{ color: "#FBBF24" }}>{m.price_per_unit.toLocaleString("ru-RU")} ₽</td>
                      <td className="px-4 py-3">
                        {editingPriceId === m.id
                          ? <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} autoFocus
                              className="w-28 px-2 py-1.5 rounded-lg text-sm text-white outline-none"
                              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid #FBBF24" }} />
                          : <button onClick={() => { setEditingPriceId(m.id); setNewPrice(String(m.price_per_unit)); }}
                              className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/10"
                              style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>Изменить</button>}
                      </td>
                      <td className="px-4 py-3">
                        {editingPriceId === m.id && (
                          <div className="flex gap-1.5">
                            <button onClick={() => savePrice(m.id)} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ background: "#FBBF24", color: "#000" }}>✓</button>
                            <button onClick={() => setEditingPriceId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Invoices tab ── */}
      {tab === "invoices" && (
        <div>
          {loading ? <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div> : (
            invoices.length === 0
              ? <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <div className="text-5xl mb-2">🧾</div><div className="text-white">Счётов пока нет</div>
                  <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Счета создаются из запросов КП</div>
                </div>
              : <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                        {["Номер счёта","Объект","Поставщик","Сумма","Статус","Дата"].map((h,i) => (
                          <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv, i) => (
                        <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2?"rgba(255,255,255,0.015)":"transparent" }}>
                          <td className="px-4 py-3 font-mono text-sm" style={{ color: "var(--neon-cyan)" }}>{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-white">{inv.rfq_title}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{inv.company_name}</td>
                          <td className="px-4 py-3 font-display font-bold" style={{ color: "#FBBF24" }}>{fmt(inv.amount)} ₽</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: inv.status==="paid"?"rgba(0,255,136,0.12)":"rgba(255,255,255,0.07)", color: inv.status==="paid"?"var(--neon-green)":"rgba(255,255,255,0.5)" }}>
                              {inv.status==="paid"?"✅ Оплачен":inv.status==="sent"?"📬 Отправлен":"📝 Черновик"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{new Date(inv.created_at).toLocaleDateString("ru-RU")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Readonly cabinet (Engineer / Lawyer) ─────────────────────────────────────
function ReadonlyCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [projects, setProjects] = useState<HouseProject[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"projects" | "materials">("projects");

  useEffect(() => {
    Promise.all([
      authFetch(PROJECTS_URL, {}, token),
      authFetch(MATERIALS_URL, {}, token),
    ]).then(([p, m]) => {
      setProjects(p.projects || []);
      setMaterials(m.items || []);
      setLoading(false);
    });
  }, [token]);

  const matCategories = Array.from(new Set(materials.map(m => m.category)));
  const color = ROLE_COLORS[user.role_code] || "#fff";
  const roleLabel = ROLE_LABELS[user.role_code] || user.role_code;

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color }}>
          {roleLabel}
        </div>
        <h2 className="font-display text-2xl font-bold text-white">Просмотр данных</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Добро пожаловать, {user.full_name}</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(["projects", "materials"] as const).map(v => (
          <button key={v} onClick={() => setActiveView(v)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeView === v ? color : "rgba(255,255,255,0.06)",
              color: activeView === v ? "#000" : "rgba(255,255,255,0.5)",
              border: activeView === v ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}>
            {v === "projects" ? "Проекты" : "Материалы"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : activeView === "projects" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <div key={p.id} className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}>
              <div className="font-display font-bold text-lg text-white mb-1">{p.name}</div>
              <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>{p.type} · {p.area} м² · {p.floors} эт. · {p.rooms} комн.</div>
              <div className="font-display font-bold text-base" style={{ color }}>
                {(p.price / 1_000_000).toFixed(1)} млн ₽
              </div>
              {p.description && <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>{p.description}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {matCategories.map(cat => (
            <div key={cat} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <div className="px-5 py-3" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--card-border)" }}>
                <span className="font-display font-semibold text-sm text-white">{cat}</span>
                <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>{materials.filter(m => m.category === cat).length} поз.</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {materials.filter(m => m.category === cat).map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                      <td className="px-4 py-2.5 text-white">{m.name}</td>
                      <td className="px-4 py-2.5 text-xs text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{m.unit}</td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color }}>
                        {m.price_per_unit.toLocaleString("ru-RU")} ₽
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {materials.length === 0 && <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Материалы не заполнены</div>}
        </div>
      )}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function Staff() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setChecking(false); return; }
    authFetch(AUTH_URL, {}, saved).then(res => {
      if (res.staff) { setUser(res.staff); setToken(saved); }
      setChecking(false);
    });
  }, []);

  const handleLogin = (u: StaffUser, t: string) => { setUser(u); setToken(t); };

  const handleLogout = async () => {
    if (token) await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "logout" }) }, token);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null); setToken(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
            style={{ borderTopColor: "var(--neon-orange)" }} />
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Проверка сессии...</div>
        </div>
      </div>
    );
  }

  if (!user || !token) return <LoginScreen onLogin={handleLogin} />;

  const renderCabinet = () => {
    switch (user.role_code) {
      case "architect": return <ArchitectCabinet user={user} token={token} />;
      case "constructor": return <ConstructorCabinet user={user} token={token} />;
      case "supply": return <SupplyCabinet user={user} token={token} />;
      default: return <ReadonlyCabinet user={user} token={token} />;
    }
  };

  return (
    <DashboardShell user={user} token={token} onLogout={handleLogout}>
      {renderCabinet()}
    </DashboardShell>
  );
}