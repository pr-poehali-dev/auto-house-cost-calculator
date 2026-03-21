import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import ProjectPanel from "@/components/ProjectEditor";
import ArchitectCabinetNew from "./staff/ArchitectCabinet";
import MaterialsDB from "./staff/MaterialsDB";
import TechCardsDB from "./staff/TechCardsDB";
import CompanySettings from "./staff/CompanySettings";
import SalesManager from "./staff/SalesManager";
import LoginScreen from "./staff/LoginScreen";
import DashboardShell from "./staff/DashboardShell";
import SupplyCabinet from "./staff/SupplyCabinet";
import { AUTH_URL, MATERIALS_URL, PROJECTS_URL, TOKEN_KEY, StaffUser, Material, HouseProject, ROLE_COLORS, authFetch } from "./staff/staff-types";

// ─── Architect cabinet (legacy inline) ────────────────────────────────────────
function ArchitectCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [projects, setProjects] = useState<HouseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Кирпичный", area: 100, floors: 2, rooms: 4, price: 5000000, tag: "", tag_color: "#FF6B1A", description: "", features: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`${PROJECTS_URL}?action=list`, {}, token);
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
    const action = editingId ? "update" : "create";
    const body = editingId ? { ...form, project_id: editingId } : form;
    const res = await authFetch(`${PROJECTS_URL}?action=${action}`, { method: "POST", body: JSON.stringify(body) }, token);
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
                {HOUSE_TYPES.map(t => <option key={t} value={t} style={{ background: "#1a1f2e" }}>{t}</option>)}
              </select>
            </div>
            {[
              { label: "Площадь (м²)", key: "area" },
              { label: "Этажей", key: "floors" },
              { label: "Комнат", key: "rooms" },
              { label: "Цена (₽)", key: "price" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                <input type="number" value={(form as Record<string, unknown>)[f.key] as number}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: +e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Цвет метки</label>
              <input type="color" value={form.tag_color} onChange={e => setForm(p => ({ ...p, tag_color: e.target.value }))}
                className="w-full h-10 rounded-xl outline-none cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Особенности (через перенос строки)</label>
            <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} rows={3}
              placeholder="Тёплый пол&#10;Панорамные окна&#10;Двойное остекление"
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            <label htmlFor="is_active" className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Опубликован (виден в каталоге)</label>
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
              <button onClick={e => { e.stopPropagation(); setOpenProjectId(p.id); }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
                style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.2)" }}>
                <Icon name="Images" size={13} /> Файлы и ведомость
              </button>
            </div>
          ))}
        </div>
      )}

      {openProjectId && (() => {
        const p = projects.find(pr => pr.id === openProjectId);
        return p ? <ProjectPanel project={p} token={token} role="architect" onClose={() => setOpenProjectId(null)} /> : null;
      })()}
    </div>
  );
}

// ─── Constructor cabinet ───────────────────────────────────────────────────────
function ConstructorCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [tab, setTab] = useState<"materials"|"ttk">("materials");
  return (
    <div>
      <div className="flex gap-2 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)" }}>
        {([["materials","Материалы","Package"],["ttk","Тех. карты","BookOpen"]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === id ? "#FBBF24" : "transparent", color: tab === id ? "#000" : "rgba(255,255,255,0.5)" }}>
            <Icon name={icon} size={14} />{label}
          </button>
        ))}
      </div>
      {tab === "materials" && <MaterialsDB user={user} token={token} />}
      {tab === "ttk" && <TechCardsDB token={token} />}
    </div>
  );
}

// ─── OldConstructorCabinet (legacy) ───────────────────────────────────────────
function OldConstructorCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<HouseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "", name: "", unit: "", price_per_unit: 0, qty_formula: "", sort_order: 0, is_active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filterCat, setFilterCat] = useState("Все");
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);
  const [activeConTab, setActiveConTab] = useState<"materials" | "specs">("materials");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(MATERIALS_URL, {}, token);
    setMaterials(res.items || []);
    const pr = await authFetch(`${PROJECTS_URL}?action=list`, {}, token);
    setProjects(pr.projects || []);
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

  // suppress unused warning
  void user;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-orange)" }}>Конструктор</div>
          <h2 className="font-display text-2xl font-bold text-white">Конструктор</h2>
        </div>
        {activeConTab === "materials" && (
          <button onClick={openNew}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "var(--neon-orange)", color: "#fff", boxShadow: "0 0 20px rgba(255,107,26,0.3)" }}>
            <Icon name="Plus" size={15} />Добавить позицию
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)" }}>
        {[{id:"materials",label:"Материалы",icon:"Package"},{id:"specs",label:"Ведомости",icon:"ClipboardList"}].map(t => (
          <button key={t.id} onClick={() => setActiveConTab(t.id as "materials"|"specs")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeConTab === t.id ? "var(--neon-orange)" : "transparent", color: activeConTab === t.id ? "#fff" : "rgba(255,255,255,0.5)" }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {activeConTab === "specs" && (
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={p.id} className="rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-white/5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i*0.04}s both` }}>
              <div>
                <div className="font-display font-semibold text-white">{p.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{p.type} · {p.area} м² · {p.floors} эт.</div>
              </div>
              <button onClick={() => setOpenProjectId(p.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(255,107,26,0.12)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.25)" }}>
                <Icon name="ClipboardList" size={14} /> Открыть ведомость
              </button>
            </div>
          ))}
          {openProjectId && (() => {
            const p = projects.find(pr => pr.id === openProjectId);
            return p ? <ProjectPanel project={p} token={token} role="constructor" onClose={() => setOpenProjectId(null)} /> : null;
          })()}
        </div>
      )}

      {activeConTab === "materials" && <>
        {showForm && (
          <div className="rounded-2xl p-5 mb-5 animate-scale-in"
            style={{ background: "var(--card-bg)", border: "1px solid rgba(255,107,26,0.3)" }}>
            <h3 className="font-display font-semibold text-base text-white mb-4">
              {editingId ? "Редактировать позицию" : "Новая позиция"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Раздел", key: "category", placeholder: "Фундамент" },
                { label: "Наименование", key: "name", placeholder: "Бетон М300" },
                { label: "Ед. изм.", key: "unit", placeholder: "м³" },
                { label: "Цена/ед., ₽", key: "price_per_unit", type: "number" },
                { label: "Формула кол-ва", key: "qty_formula", placeholder: "a * 0.25" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                  <input type={f.type || "text"} value={(form as Record<string, unknown>)[f.key] as string | number}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === "number" ? +e.target.value : e.target.value }))}
                    placeholder={(f as {placeholder?: string}).placeholder}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
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
      </>}
    </div>
  );
}

// suppress unused
void OldConstructorCabinet;

// ─── Readonly cabinet (Engineer / Lawyer / etc.) ──────────────────────────────
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
  const roleLabel = { engineer: "Инженер", lawyer: "Юрист", build_manager: "Рук. строительства", admin: "Администратор" }[user.role_code] || user.role_code;

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color }}>{roleLabel}</div>
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
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color }}>{m.price_per_unit.toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Staff page ───────────────────────────────────────────────────────────
export default function Staff() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [globalTab, setGlobalTab] = useState<"main"|"ttk"|"settings">("main");

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
    if (globalTab === "ttk") return <TechCardsDB token={token} />;
    if (globalTab === "settings") return <CompanySettings token={token} />;
    switch (user.role_code) {
      case "architect": return <ArchitectCabinetNew user={user} token={token} />;
      case "constructor": return <ConstructorCabinet user={user} token={token} />;
      case "supply": return <SupplyCabinet user={user} token={token} />;
      case "manager": return <SalesManager user={user} token={token} />;
      default: return <ReadonlyCabinet user={user} token={token} />;
    }
  };

  return (
    <DashboardShell user={user} token={token} onLogout={handleLogout} globalTab={globalTab} onGlobalTab={setGlobalTab}>
      {renderCabinet()}
    </DashboardShell>
  );
}
