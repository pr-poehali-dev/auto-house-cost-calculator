import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS, StaffUser, authFetch } from "./staff-types";

interface StaffMember {
  id: number;
  login: string;
  full_name: string;
  role_code: string;
  created_at: string;
}

interface ResetForm {
  staffId: number | null;
  login: string;
  fullName: string;
  newPassword: string;
  confirm: string;
}

export default function AdminCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [resetForm, setResetForm] = useState<ResetForm | null>(null);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`${AUTH_URL}?action=staff_list`, {}, token);
    setStaffList(Array.isArray(res.staff) ? res.staff : []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openReset = (m: StaffMember) => {
    setMsg(null);
    setResetForm({ staffId: m.id, login: m.login, fullName: m.full_name, newPassword: "", confirm: "" });
  };

  const doReset = async () => {
    if (!resetForm) return;
    if (resetForm.newPassword.length < 6) {
      setMsg({ text: "Пароль должен быть не менее 6 символов", ok: false });
      return;
    }
    if (resetForm.newPassword !== resetForm.confirm) {
      setMsg({ text: "Пароли не совпадают", ok: false });
      return;
    }
    setResetting(true);
    setMsg(null);
    const res = await authFetch(AUTH_URL, {
      method: "POST",
      body: JSON.stringify({ action: "reset_password", staff_id: resetForm.staffId, new_password: resetForm.newPassword }),
    }, token);
    setResetting(false);
    if (res.ok) {
      setMsg({ text: `Пароль для «${resetForm.fullName}» успешно изменён`, ok: true });
      setResetForm(null);
    } else {
      setMsg({ text: res.error || "Ошибка", ok: false });
    }
  };

  const roles = Array.from(new Set(staffList.map(s => s.role_code)));
  const filtered = staffList.filter(s => {
    const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.login.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || s.role_code === filterRole;
    return matchSearch && matchRole;
  });

  const totalByRole = roles.reduce<Record<string, number>>((acc, r) => {
    acc[r] = staffList.filter(s => s.role_code === r).length;
    return acc;
  }, {});

  return (
    <div>
      {/* Заголовок */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#E11D48" }}>
            Администратор
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Управление пользователями</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {user.full_name} · {staffList.length} сотрудников
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:bg-white/10"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <Icon name="RefreshCw" size={14} />
          Обновить
        </button>
      </div>

      {/* Статистика по ролям */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {roles.map(r => (
          <button key={r} onClick={() => setFilterRole(filterRole === r ? "all" : r)}
            className="rounded-2xl p-3 text-left transition-all hover:scale-105"
            style={{
              background: filterRole === r ? `${ROLE_COLORS[r] || "#fff"}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${filterRole === r ? `${ROLE_COLORS[r] || "#fff"}44` : "rgba(255,255,255,0.07)"}`,
            }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name={ROLE_ICONS[r] || "User"} size={13} style={{ color: ROLE_COLORS[r] || "#fff" }} />
              <span className="text-xs font-medium" style={{ color: ROLE_COLORS[r] || "#fff" }}>
                {ROLE_LABELS[r] || r}
              </span>
            </div>
            <div className="font-display font-bold text-xl text-white">{totalByRole[r]}</div>
          </button>
        ))}
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или логину..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Сообщение */}
      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: msg.ok ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${msg.ok ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`, color: msg.ok ? "var(--neon-green)" : "#ef4444" }}>
          {msg.text}
        </div>
      )}

      {/* Модалка сброса пароля */}
      {resetForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--card-bg)", border: "1px solid rgba(225,29,72,0.3)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(225,29,72,0.12)" }}>
                <Icon name="KeyRound" size={16} style={{ color: "#E11D48" }} />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Сброс пароля</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{resetForm.fullName} · {resetForm.login}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Новый пароль
                </label>
                <input
                  type="password"
                  value={resetForm.newPassword}
                  onChange={e => setResetForm(f => f ? { ...f, newPassword: e.target.value } : f)}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Повтор пароля
                </label>
                <input
                  type="password"
                  value={resetForm.confirm}
                  onChange={e => setResetForm(f => f ? { ...f, confirm: e.target.value } : f)}
                  placeholder="Повторите пароль"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            {msg && !msg.ok && (
              <div className="mt-3 text-xs" style={{ color: "#ef4444" }}>{msg.text}</div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={doReset} disabled={resetting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: "#E11D48", color: "#fff" }}>
                {resetting ? "Сохраняю..." : "Сохранить пароль"}
              </button>
              <button onClick={() => { setResetForm(null); setMsg(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Таблица */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Сотрудник", "Логин", "Роль", "Дата регистрации", ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const color = ROLE_COLORS[m.role_code] || "#fff";
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}18` }}>
                          <Icon name={ROLE_ICONS[m.role_code] || "User"} size={13} style={{ color }} />
                        </div>
                        <span className="text-white font-medium">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {m.login}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: `${color}18`, color }}>
                        {ROLE_LABELS[m.role_code] || m.role_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {new Date(m.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openReset(m)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
                        style={{ background: "rgba(225,29,72,0.1)", color: "#E11D48", border: "1px solid rgba(225,29,72,0.2)" }}>
                        <Icon name="KeyRound" size={12} />
                        Сбросить пароль
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Нет сотрудников</div>
          )}
        </div>
      )}
    </div>
  );
}
