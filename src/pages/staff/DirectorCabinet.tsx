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

// Роли в нужном порядке для дашборда
const ROLE_ORDER = [
  "manager", "architect", "constructor", "supply",
  "engineer", "lawyer", "build_manager", "marketer",
  "admin", "director", "assistant",
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  manager: "Ведёт клиентов, заявки и договоры",
  architect: "Разрабатывает проекты домов",
  constructor: "Составляет сметы и ведомости ОР",
  supply: "Закупки, запросы КП, поставщики",
  engineer: "Инженерные системы и коммуникации",
  lawyer: "Договоры и правовые вопросы",
  build_manager: "Руководит строительными работами",
  marketer: "Анализ рынка и конкурентов",
  admin: "Полный доступ к системе",
  director: "Руководитель — просмотр всех кабинетов",
  assistant: "Помощник руководителя",
};

export default function DirectorCabinet({
  user, token, onImpersonate,
}: {
  user: StaffUser;
  token: string;
  onImpersonate: (impUser: StaffUser, impToken: string, directorToken: string) => void;
}) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(`${AUTH_URL}?action=staff_list`, {}, token);
    setStaffList(res.staff || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const enterCabinet = async (member: StaffMember) => {
    setSwitching(member.id);
    const res = await authFetch(AUTH_URL, {
      method: "POST",
      body: JSON.stringify({ action: "impersonate", staff_id: member.id }),
    }, token);
    setSwitching(null);
    if (res.token) {
      onImpersonate(res.staff, res.token, token);
    }
  };

  // Группируем по ролям
  const byRole = ROLE_ORDER.reduce<Record<string, StaffMember[]>>((acc, role) => {
    const members = staffList.filter(s => s.role_code === role);
    if (members.length) acc[role] = members;
    return acc;
  }, {});

  // Статистика
  const totalStaff = staffList.filter(s => !["director", "assistant"].includes(s.role_code)).length;

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: ROLE_COLORS["director"] || "#fff" }}>
            {ROLE_LABELS[user.role_code]}
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Кабинеты сотрудников</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Добро пожаловать, {user.full_name} · {totalStaff} сотрудников
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Icon name="ShieldCheck" size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Нажмите «Войти» чтобы открыть кабинет от имени сотрудника
          </span>
        </div>
      </div>

      {/* Быстрая статистика по ролям */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { role: "manager", icon: "Phone", count: staffList.filter(s => s.role_code === "manager").length },
          { role: "architect", icon: "Pencil", count: staffList.filter(s => s.role_code === "architect").length },
          { role: "supply", icon: "ShoppingCart", count: staffList.filter(s => s.role_code === "supply").length },
          { role: "constructor", icon: "Wrench", count: staffList.filter(s => s.role_code === "constructor").length },
        ].map(({ role, icon, count }) => (
          <div key={role} className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${ROLE_COLORS[role]}18` }}>
              <Icon name={icon} size={16} style={{ color: ROLE_COLORS[role] }} />
            </div>
            <div>
              <div className="font-display font-bold text-xl text-white">{count}</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{ROLE_LABELS[role]}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Список сотрудников по ролям */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>
          <div className="w-8 h-8 border-2 border-white/10 rounded-full mx-auto mb-3 animate-spin"
            style={{ borderTopColor: "var(--neon-orange)" }} />
          Загружаем список...
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byRole).map(([role, members]) => {
            const color = ROLE_COLORS[role] || "#fff";
            const iconName = ROLE_ICONS[role] || "User";
            return (
              <div key={role}>
                {/* Заголовок раздела */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}18` }}>
                    <Icon name={iconName} size={14} style={{ color }} />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm">{ROLE_LABELS[role] || role}</span>
                    <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {members.length} чел.
                    </span>
                  </div>
                  <div className="flex-1 h-px ml-1" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </div>

                {/* Карточки сотрудников */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map(member => (
                    <div key={member.id}
                      className="rounded-2xl px-4 py-4 flex items-center gap-3 transition-all hover:scale-[1.01]"
                      style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                      {/* Аватар */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-white truncate">{member.full_name}</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                          @{member.login}
                        </div>
                      </div>

                      {/* Кнопка входа */}
                      {!["director", "assistant"].includes(member.role_code) && member.id !== user.id && (
                        <button
                          onClick={() => enterCabinet(member)}
                          disabled={switching === member.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50 flex-shrink-0"
                          style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                          {switching === member.id
                            ? <><Icon name="Loader2" size={11} className="animate-spin" /> Вхожу...</>
                            : <><Icon name="LogIn" size={11} /> Войти</>
                          }
                        </button>
                      )}
                      {member.id === user.id && (
                        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>
                          Вы
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
