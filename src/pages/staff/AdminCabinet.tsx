import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { AUTH_URL, SUPPLIER_API, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS, ROLES, StaffUser, authFetch } from "./staff-types";

interface StaffMember {
  id: number;
  login: string;
  full_name: string;
  role_code: string;
  created_at: string;
}

interface Supplier {
  id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

interface ResetModal {
  type: "staff" | "supplier";
  id: number;
  login: string;
  name: string;
  newPassword: string;
  confirm: string;
}

const NOTIFY_URL = "https://functions.poehali.dev/e936bb42-3c4d-4c99-88d7-6d976ca7cb7c";

interface StaffContact {
  id: number;
  full_name: string;
  role_code: string;
  email: string | null;
  bitrix_user_id: number | null;
  max_user_id: string | null;
  notify_bitrix: boolean;
}

const EMPTY_NEW = { full_name: "", login: "", role_code: "architect", password: "", confirm: "" };

export default function AdminCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [tab, setTab] = useState<"staff" | "suppliers" | "contacts">("staff");

  // Контакты сотрудников
  const [contactsList, setContactsList] = useState<StaffContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [editingContact, setEditingContact] = useState<number | null>(null);
  const [contactBuf, setContactBuf] = useState<Partial<StaffContact>>({});
  const [savingContact, setSavingContact] = useState(false);

  // Сотрудники
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("all");
  const [staffSearch, setStaffSearch] = useState("");

  // Поставщики
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supLoading, setSupLoading] = useState(false);
  const [supSearch, setSupSearch] = useState("");

  // Общее
  const [resetModal, setResetModal] = useState<ResetModal | null>(null);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Создание сотрудника
  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [creating, setCreating] = useState(false);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    const res = await authFetch(`${AUTH_URL}?action=staff_list`, {}, token);
    setStaffList(Array.isArray(res.staff) ? res.staff : []);
    setStaffLoading(false);
  }, [token]);

  const loadSuppliers = useCallback(async () => {
    setSupLoading(true);
    const res = await authFetch(`${SUPPLIER_API}?action=supplier_list`, {}, token);
    setSuppliers(Array.isArray(res.suppliers) ? res.suppliers : []);
    setSupLoading(false);
  }, [token]);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    const res = await authFetch(`${NOTIFY_URL}?action=get_staff_contacts`, {}, token);
    setContactsList(Array.isArray(res.staff) ? res.staff : []);
    setContactsLoading(false);
  }, [token]);

  const saveContact = async (id: number) => {
    setSavingContact(true);
    await authFetch(`${NOTIFY_URL}?action=update_staff_contacts`, {
      method: "POST",
      body: JSON.stringify({ staff_id: id, ...contactBuf }),
    }, token);
    setSavingContact(false);
    setEditingContact(null);
    setContactBuf({});
    loadContacts();
  };

  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => { if (tab === "suppliers" && suppliers.length === 0) loadSuppliers(); }, [tab]);
  useEffect(() => { if (tab === "contacts") loadContacts(); }, [tab, loadContacts]);

  const openStaffReset = (m: StaffMember) => {
    setMsg(null);
    setResetModal({ type: "staff", id: m.id, login: m.login, name: m.full_name, newPassword: "", confirm: "" });
  };

  const openSupReset = (s: Supplier) => {
    setMsg(null);
    setResetModal({ type: "supplier", id: s.id, login: s.email, name: s.company_name, newPassword: "", confirm: "" });
  };

  const doReset = async () => {
    if (!resetModal) return;
    if (resetModal.newPassword.length < 6) { setMsg({ text: "Пароль должен быть не менее 6 символов", ok: false }); return; }
    if (resetModal.newPassword !== resetModal.confirm) { setMsg({ text: "Пароли не совпадают", ok: false }); return; }
    setResetting(true); setMsg(null);

    let res;
    if (resetModal.type === "staff") {
      res = await authFetch(AUTH_URL, {
        method: "POST",
        body: JSON.stringify({ action: "reset_password", staff_id: resetModal.id, new_password: resetModal.newPassword }),
      }, token);
    } else {
      res = await authFetch(`${SUPPLIER_API}?action=admin_reset_password`, {
        method: "POST",
        body: JSON.stringify({ email: resetModal.login, password: resetModal.newPassword }),
      }, token);
    }

    setResetting(false);
    if (res.ok) {
      setMsg({ text: `Пароль для «${resetModal.name}» успешно изменён`, ok: true });
      setResetModal(null);
    } else {
      setMsg({ text: res.error || "Ошибка", ok: false });
    }
  };

  const doCreate = async () => {
    if (!newForm.full_name.trim() || !newForm.login.trim() || !newForm.password) {
      setMsg({ text: "Заполните все поля", ok: false }); return;
    }
    if (newForm.password.length < 6) { setMsg({ text: "Пароль минимум 6 символов", ok: false }); return; }
    if (newForm.password !== newForm.confirm) { setMsg({ text: "Пароли не совпадают", ok: false }); return; }
    setCreating(true); setMsg(null);
    const res = await authFetch(AUTH_URL, {
      method: "POST",
      body: JSON.stringify({ action: "register", login: newForm.login.trim(), full_name: newForm.full_name.trim(), role_code: newForm.role_code, password: newForm.password }),
    }, token);
    setCreating(false);
    if (res.token || res.staff) {
      setMsg({ text: `Сотрудник «${newForm.full_name}» успешно создан`, ok: true });
      setShowCreate(false);
      setNewForm(EMPTY_NEW);
      loadStaff();
    } else {
      setMsg({ text: res.error || "Ошибка создания", ok: false });
    }
  };

  const roles = Array.from(new Set(staffList.map(s => s.role_code)));
  const filteredStaff = staffList.filter(s => {
    const q = staffSearch.toLowerCase();
    return (!q || s.full_name.toLowerCase().includes(q) || s.login.toLowerCase().includes(q))
      && (filterRole === "all" || s.role_code === filterRole);
  });
  const filteredSup = suppliers.filter(s => {
    const q = supSearch.toLowerCase();
    return !q || s.company_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.contact_name.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Заголовок */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#E11D48" }}>Администратор</div>
          <h2 className="font-display text-2xl font-bold text-white">Управление пользователями</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{user.full_name}</p>
        </div>
        <div className="flex gap-2">
          {tab === "staff" && (
            <button onClick={() => { setShowCreate(v => !v); setMsg(null); setNewForm(EMPTY_NEW); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: showCreate ? "rgba(225,29,72,0.15)" : "#E11D48", color: "#fff" }}>
              <Icon name={showCreate ? "X" : "UserPlus"} size={14} />
              {showCreate ? "Отмена" : "Добавить"}
            </button>
          )}
          <button onClick={() => tab === "staff" ? loadStaff() : loadSuppliers()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            <Icon name="RefreshCw" size={14} />
            Обновить
          </button>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "staff", label: "Сотрудники", count: staffList.length, icon: "Users" },
          { key: "suppliers", label: "Поставщики", count: suppliers.length, icon: "Truck" },
          { key: "contacts", label: "Уведомления", count: 0, icon: "Bell" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === t.key ? "#E11D48" : "rgba(255,255,255,0.05)",
              color: tab === t.key ? "#fff" : "rgba(255,255,255,0.5)",
              border: `1px solid ${tab === t.key ? "#E11D48" : "rgba(255,255,255,0.1)"}`,
            }}>
            <Icon name={t.icon} size={14} />
            {t.label}
            {t.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-xs font-bold"
                style={{ background: tab === t.key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Сообщение */}
      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: msg.ok ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${msg.ok ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}`, color: msg.ok ? "var(--neon-green)" : "#ef4444" }}>
          {msg.text}
        </div>
      )}

      {/* ── ВКЛАДКА: СОТРУДНИКИ ── */}
      {tab === "staff" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
            {roles.map(r => (
              <button key={r} onClick={() => setFilterRole(filterRole === r ? "all" : r)}
                className="rounded-2xl p-3 text-left transition-all hover:scale-105"
                style={{
                  background: filterRole === r ? `${ROLE_COLORS[r] || "#fff"}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filterRole === r ? `${ROLE_COLORS[r] || "#fff"}44` : "rgba(255,255,255,0.07)"}`,
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={ROLE_ICONS[r] || "User"} size={13} style={{ color: ROLE_COLORS[r] || "#fff" }} />
                  <span className="text-xs font-medium" style={{ color: ROLE_COLORS[r] || "#fff" }}>{ROLE_LABELS[r] || r}</span>
                </div>
                <div className="font-display font-bold text-xl text-white">{staffList.filter(s => s.role_code === r).length}</div>
              </button>
            ))}
          </div>

          {/* Форма создания */}
          {showCreate && (
            <div className="rounded-2xl p-5 mb-5 animate-scale-in" style={{ background: "rgba(225,29,72,0.05)", border: "1px solid rgba(225,29,72,0.2)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Icon name="UserPlus" size={15} style={{ color: "#E11D48" }} />
                <span className="font-semibold text-white text-sm">Новый сотрудник</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Полное имя</label>
                  <input value={newForm.full_name} onChange={e => setNewForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Иванов Иван Иванович"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Логин</label>
                  <input value={newForm.login} onChange={e => setNewForm(f => ({ ...f, login: e.target.value }))}
                    placeholder="ivanov"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Роль</label>
                  <select value={newForm.role_code} onChange={e => setNewForm(f => ({ ...f, role_code: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {ROLES.map(r => <option key={r.code} value={r.code} style={{ background: "#1a1f2e" }}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Пароль</label>
                  <input type="password" value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Минимум 6 символов"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Повтор пароля</label>
                  <input type="password" value={newForm.confirm} onChange={e => setNewForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Повторите пароль"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
              <button onClick={doCreate} disabled={creating}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: "#E11D48", color: "#fff" }}>
                {creating ? "Создаю..." : "Создать сотрудника"}
              </button>
            </div>
          )}

          <div className="relative mb-4">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
              placeholder="Поиск по имени или логину..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {staffLoading ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Сотрудник", "Логин", "Роль", "Дата", ""].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((m, i) => {
                    const color = ROLE_COLORS[m.role_code] || "#fff";
                    return (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                              <Icon name={ROLE_ICONS[m.role_code] || "User"} size={13} style={{ color }} />
                            </div>
                            <span className="text-white font-medium">{m.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{m.login}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: `${color}18`, color }}>
                            {ROLE_LABELS[m.role_code] || m.role_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {new Date(m.created_at).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openStaffReset(m)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
                            style={{ background: "rgba(225,29,72,0.1)", color: "#E11D48", border: "1px solid rgba(225,29,72,0.2)" }}>
                            <Icon name="KeyRound" size={12} />
                            Сброс пароля
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredStaff.length === 0 && <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Нет сотрудников</div>}
            </div>
          )}
        </>
      )}

      {/* ── ВКЛАДКА: ПОСТАВЩИКИ ── */}
      {tab === "suppliers" && (
        <>
          <div className="relative mb-4">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input value={supSearch} onChange={e => setSupSearch(e.target.value)}
              placeholder="Поиск по компании, email или контакту..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {supLoading ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Компания", "Контакт", "Email (логин)", "Телефон", "Статус", ""].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSup.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(251,191,36,0.12)" }}>
                            <Icon name="Truck" size={13} style={{ color: "#FBBF24" }} />
                          </div>
                          <span className="text-white font-medium">{s.company_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{s.contact_name}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{s.email}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            background: s.is_verified ? "rgba(0,255,136,0.1)" : "rgba(251,191,36,0.1)",
                            color: s.is_verified ? "var(--neon-green)" : "#FBBF24",
                          }}>
                          {s.is_verified ? "Верифицирован" : "Ожидает"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openSupReset(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
                          style={{ background: "rgba(225,29,72,0.1)", color: "#E11D48", border: "1px solid rgba(225,29,72,0.2)" }}>
                          <Icon name="KeyRound" size={12} />
                          Сброс пароля
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSup.length === 0 && <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Нет поставщиков</div>}
            </div>
          )}
        </>
      )}

      {/* ── Вкладка: Уведомления / контакты ── */}
      {tab === "contacts" && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
            <div>
              <div className="font-semibold text-white">Контакты для уведомлений</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                Укажите телефон и Битрикс24 ID для каждого сотрудника — система будет отправлять SMS и создавать задачи
              </div>
            </div>
            <button onClick={loadContacts} disabled={contactsLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              <Icon name={contactsLoading ? "Loader" : "RefreshCw"} size={12} className={contactsLoading ? "animate-spin" : ""} />
              Обновить
            </button>
          </div>

          {contactsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: "#E11D48" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ divideColor: "rgba(255,255,255,0.05)" }}>
              {contactsList.map(ct => (
                <div key={ct.id} className="px-5 py-4">
                  {editingContact === ct.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-semibold text-white text-sm">{ct.full_name}</div>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                          {ct.role_code}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>📧 Email</label>
                          <input
                            defaultValue={ct.email || ""}
                            onChange={e => setContactBuf(b => ({ ...b, email: e.target.value }))}
                            placeholder="example@company.ru"
                            className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>🏢 Битрикс24 ID</label>
                          <input
                            type="number"
                            defaultValue={ct.bitrix_user_id || ""}
                            onChange={e => setContactBuf(b => ({ ...b, bitrix_user_id: e.target.value ? +e.target.value : null }))}
                            placeholder="Например: 42"
                            className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                            Профиль → цифра в URL (?ID=42)
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>💬 Max ID (мессенджер)</label>
                          <input
                            defaultValue={ct.max_user_id || ""}
                            onChange={e => setContactBuf(b => ({ ...b, max_user_id: e.target.value || null }))}
                            placeholder="Будет доступно после создания бота"
                            disabled
                            className="w-full px-3 py-2 rounded-xl text-sm outline-none opacity-40"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }} />
                          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Подключим когда создадим бота в Max
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>🔔 Каналы уведомлений</label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox"
                              defaultChecked={ct.notify_bitrix !== false}
                              onChange={e => setContactBuf(b => ({ ...b, notify_bitrix: e.target.checked }))}
                              className="w-4 h-4 rounded" />
                            <span className="text-sm text-white">Задачи в Битрикс24</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveContact(ct.id)} disabled={savingContact}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: "#E11D48", color: "#fff" }}>
                          <Icon name={savingContact ? "Loader" : "Save"} size={13} className={savingContact ? "animate-spin" : ""} />
                          Сохранить
                        </button>
                        <button onClick={() => { setEditingContact(null); setContactBuf({}); }}
                          className="px-4 py-2 rounded-xl text-sm"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white text-sm">{ct.full_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                            {ct.role_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <span className="flex items-center gap-1">
                            <Icon name="Building2" size={11} />
                            {ct.bitrix_user_id
                              ? <span style={{ color: "var(--neon-cyan)" }}>Битрикс ID: {ct.bitrix_user_id}</span>
                              : <span style={{ color: "rgba(255,100,100,0.5)" }}>Битрикс не привязан</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Icon name="MessageCircle" size={11} />
                            {ct.max_user_id
                              ? <span style={{ color: "var(--neon-green)" }}>Max подключён</span>
                              : <span style={{ color: "rgba(255,255,255,0.2)" }}>Max — скоро</span>}
                          </span>
                          {ct.notify_bitrix && (
                            <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(0,212,255,0.1)", color: "var(--neon-cyan)" }}>Битрикс ✓</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setEditingContact(ct.id); setContactBuf({ email: ct.email, bitrix_user_id: ct.bitrix_user_id, max_user_id: ct.max_user_id, notify_bitrix: ct.notify_bitrix }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <Icon name="Pencil" size={12} />
                        Изменить
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {contactsList.length === 0 && (
                <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Список пуст. Нажмите «Обновить»
                </div>
              )}
            </div>
          )}

          {/* Подсказки */}
          <div className="px-5 py-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,212,255,0.03)" }}>
            <div className="flex items-start gap-2">
              <Icon name="Info" size={13} style={{ color: "rgba(0,212,255,0.5)", marginTop: 1, flexShrink: 0 }} />
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span style={{ color: "rgba(0,212,255,0.7)" }}>Битрикс24 ID:</span> откройте профиль сотрудника →
                в адресной строке <code style={{ color: "rgba(255,255,255,0.5)" }}>?ID=42</code>.
                Снабженцы = ответственные по задаче, руководители (admin/manager) = наблюдатели.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Icon name="MessageCircle" size={13} style={{ color: "rgba(168,85,247,0.5)", marginTop: 1, flexShrink: 0 }} />
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                <span style={{ color: "rgba(168,85,247,0.7)" }}>Max мессенджер</span> — будет доступен после создания бота.
                Уведомления через Max подключим отдельно.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка сброса пароля */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--card-bg)", border: "1px solid rgba(225,29,72,0.3)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(225,29,72,0.12)" }}>
                <Icon name="KeyRound" size={16} style={{ color: "#E11D48" }} />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Сброс пароля</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {resetModal.name} · {resetModal.type === "staff" ? "логин: " : "email: "}{resetModal.login}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Новый пароль</label>
                <input type="password" value={resetModal.newPassword}
                  onChange={e => setResetModal(f => f ? { ...f, newPassword: e.target.value } : f)}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Повтор пароля</label>
                <input type="password" value={resetModal.confirm}
                  onChange={e => setResetModal(f => f ? { ...f, confirm: e.target.value } : f)}
                  placeholder="Повторите пароль"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>
            {msg && !msg.ok && <div className="mt-3 text-xs" style={{ color: "#ef4444" }}>{msg.text}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={doReset} disabled={resetting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: "#E11D48", color: "#fff" }}>
                {resetting ? "Сохраняю..." : "Сохранить пароль"}
              </button>
              <button onClick={() => { setResetModal(null); setMsg(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}