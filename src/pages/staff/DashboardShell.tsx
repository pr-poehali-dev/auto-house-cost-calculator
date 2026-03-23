import Icon from "@/components/ui/icon";
import ChatWidget, { type ChatRole } from "@/components/ChatWidget";
import AiAssistant from "@/components/AiAssistant";
import { StaffUser, ROLE_LABELS, ROLE_COLORS, ROLE_ICONS } from "./staff-types";

export default function DashboardShell({ user, token, onLogout, children, globalTab, onGlobalTab }: {
  user: StaffUser; token: string; onLogout: () => void; children: React.ReactNode;
  globalTab: string; onGlobalTab: (t: "main" | "ttk" | "settings") => void;
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
            <AiAssistant roleCode={user.role_code} token={token} />
            <button onClick={() => onGlobalTab("main")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: globalTab === "main" ? "rgba(255,255,255,0.1)" : "transparent", color: globalTab === "main" ? "#fff" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="LayoutDashboard" size={13} />
              <span className="hidden sm:inline">Кабинет</span>
            </button>
            <button onClick={() => onGlobalTab("ttk")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: globalTab === "ttk" ? "#FBBF24" : "transparent", color: globalTab === "ttk" ? "#000" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="BookOpen" size={13} />
              <span className="hidden sm:inline">Тех. карты</span>
            </button>
            {["admin", "architect", "manager"].includes(user.role_code) && (
              <button onClick={() => onGlobalTab("settings")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ background: globalTab === "settings" ? "#FBBF24" : "transparent", color: globalTab === "settings" ? "#000" : "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Icon name="Settings" size={13} />
                <span className="hidden sm:inline">Настройки</span>
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: `${color}18`, border: `1px solid ${color}44` }}>
              <Icon name={icon} size={13} style={{ color }} />
              <span className="text-xs font-semibold hidden sm:inline" style={{ color }}>{ROLE_LABELS[user.role_code]}</span>
            </div>
            <div className="text-sm text-white hidden lg:block">{user.full_name}</div>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Icon name="LogOut" size={13} />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative">
        {children}
      </main>

      <ChatWidget role={user.role_code as ChatRole} userName={user.full_name} />
    </div>
  );
}