import { useState } from "react";
import { AUTH_URL, ROLES, StaffUser, authFetch } from "./staff-types";

export default function LoginScreen({ onLogin }: { onLogin: (user: StaffUser, token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [regForm, setRegForm] = useState({ login: "", full_name: "", role_code: "architect", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inp = "w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
  const focusOrange = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = "var(--neon-orange)"; };
  const blurOrange = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ login, password }) });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem("staff_token", res.token);
    onLogin(res.staff, res.token);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await authFetch(AUTH_URL, { method: "POST", body: JSON.stringify({ action: "register", ...regForm }) });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem("staff_token", res.token);
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
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 40px rgba(255,107,26,0.4)" }}>
            СК
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Личный кабинет</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Сотрудники СтройКалькулятор</p>
        </div>

        <div className="flex p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: mode === m ? "var(--neon-orange)" : "transparent", color: mode === m ? "#fff" : "rgba(255,255,255,0.5)" }}>
              {m === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="rounded-2xl p-8 space-y-5"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Логин</label>
              <input type="text" value={login} onChange={e => setLogin(e.target.value)} placeholder="architect1"
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange} />
              <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                При первом входе придуманный вами пароль станет постоянным
              </p>
            </div>
            {error && <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 25px rgba(255,107,26,0.35)" }}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="rounded-2xl p-8 space-y-4"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Полное имя</label>
              <input type="text" value={regForm.full_name} onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Иван Петров"
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Логин</label>
              <input type="text" value={regForm.login} onChange={e => setRegForm(p => ({ ...p, login: e.target.value }))} placeholder="ivan_petrov"
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Должность</label>
              <select value={regForm.role_code} onChange={e => setRegForm(p => ({ ...p, role_code: e.target.value }))}
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange}>
                {ROLES.map(r => <option key={r.code} value={r.code} style={{ background: "#1a1f2e" }}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Пароль</label>
              <input type="password" value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="Минимум 6 символов"
                className={inp} style={inpStyle} onFocus={focusOrange} onBlur={blurOrange} />
            </div>
            {error && <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff", boxShadow: "0 0 25px rgba(255,107,26,0.35)" }}>
              {loading ? "Создание..." : "Зарегистрироваться"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
