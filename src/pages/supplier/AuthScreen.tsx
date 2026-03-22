import { useState } from "react";
import { API, TOKEN_KEY, CATEGORIES, apiFetch, type SupplierUser } from "./supplier-types";

export default function AuthScreen({ onAuth }: { onAuth: (token: string, user: SupplierUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", password: "", region: "", categories: [] as string[], description: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const toggleCat = (id: string) => setForm(p => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter(c => c !== id) : [...p.categories, id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    const body = mode === "register"
      ? { ...form, action: "register", categories: form.categories.join(",") }
      : { email: form.email, password: form.password };
    const res = await apiFetch(API, { method: "POST", body: JSON.stringify(body) });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem(TOKEN_KEY, res.token);
    const me = await apiFetch(API, {}, res.token);
    if (me.supplier) onAuth(res.token, me.supplier);
  };

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
  const label = "block text-xs font-semibold mb-1.5 uppercase tracking-wider";
  const labelStyle = { color: "rgba(255,255,255,0.4)" };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
      </div>
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 40px rgba(0,212,255,0.4)" }}>
            П
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Портал поставщиков</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>СтройКалькулятор — строительная платформа</p>
        </div>

        <div className="flex p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: mode === m ? "var(--neon-cyan)" : "transparent", color: mode === m ? "#000" : "rgba(255,255,255,0.5)" }}>
              {m === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-7 space-y-4"
          style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label} style={labelStyle}>Компания</label>
                  <input className={inp} style={inpStyle} placeholder="ООО Стройснаб" value={form.company_name} onChange={e => set("company_name", e.target.value)} required />
                </div>
                <div>
                  <label className={label} style={labelStyle}>Контактное лицо</label>
                  <input className={inp} style={inpStyle} placeholder="Иван Петров" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label} style={labelStyle}>Телефон</label>
                  <input className={inp} style={inpStyle} placeholder="+7 900 000-00-00" value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
                <div>
                  <label className={label} style={labelStyle}>Регион</label>
                  <input className={inp} style={inpStyle} placeholder="Москва" value={form.region} onChange={e => set("region", e.target.value)} />
                </div>
              </div>
              <div>
                <label className={label} style={labelStyle}>Категории поставок</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.id} onClick={() => toggleCat(c.id)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                      style={{
                        background: form.categories.includes(c.id) ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
                        border: form.categories.includes(c.id) ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                        color: form.categories.includes(c.id) ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)",
                      }}>
                      <span>{c.icon}</span><span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label} style={labelStyle}>О компании</label>
                <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={2} placeholder="Кратко о компании, опыт работы..." value={form.description} onChange={e => set("description", e.target.value)} />
              </div>
            </>
          )}
          {error && mode === "register" && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
              {error.toLowerCase().includes("email") && (
                <button type="button" onClick={() => { setMode("login"); setError(""); }}
                  className="ml-2 underline font-semibold whitespace-nowrap">
                  Войти →
                </button>
              )}
            </div>
          )}
          <div>
            <label className={label} style={labelStyle}>Email</label>
            <input type="email" className={inp} style={{ ...inpStyle, ...(error && error.toLowerCase().includes("email") ? { border: "1px solid #ef4444" } : {}) }} placeholder="company@mail.ru" value={form.email} onChange={e => { set("email", e.target.value); setError(""); }} required />
          </div>
          <div>
            <label className={label} style={labelStyle}>Пароль</label>
            <input type="password" className={inp} style={inpStyle} placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} required />
            {mode === "register" && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Минимум 6 символов</p>}
          </div>
          {error && <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-[1.02] disabled:opacity-60 mt-2"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 25px rgba(0,212,255,0.3)" }}>
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}
