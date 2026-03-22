import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatWidget from "@/components/ChatWidget";
import AuthScreen from "./supplier/AuthScreen";
import { RfqList, MyProposals } from "./supplier/RfqList";
import { PriceListTab, SupplierPriceOffer } from "./supplier/PriceListTab";
import { API, TOKEN_KEY, apiFetch, type SupplierUser } from "./supplier/supplier-types";

export default function SupplierPortal() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SupplierUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<"rfqs" | "proposals" | "pricelist" | "prices">("rfqs");

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setChecking(false); return; }
    apiFetch(API + "?action=me", {}, saved).then(res => {
      if (res.supplier) { setToken(saved); setUser(res.supplier); }
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("rfq")) setActiveTab("rfqs");
  }, [searchParams]);

  const handleAuth = (t: string, u: SupplierUser) => { setToken(t); setUser(u); };
  const handleLogout = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); setUser(null); };

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="w-10 h-10 border-2 border-white/10 rounded-full animate-spin" style={{ borderTopColor: "var(--neon-cyan)" }} />
    </div>
  );

  if (!token || !user) return <AuthScreen onAuth={handleAuth} />;

  return (
    <div className="min-h-screen" style={{ background: "var(--dark-bg)" }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000" }}>П</div>
            <div>
              <div className="font-display font-semibold text-sm text-white">{user.company_name}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{user.contact_name}</span>
                {user.is_verified
                  ? <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)" }}>✓ Верифицирован</span>
                  : <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>На проверке</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              {[{id:"rfqs",label:"Запросы КП",icon:"FileText"},{id:"proposals",label:"Мои КП",icon:"Send"},{id:"pricelist",label:"Мой прайс",icon:"Table2"},{id:"prices",label:"Цены в базе",icon:"Tag"}].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as "rfqs"|"proposals"|"pricelist"|"prices")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: activeTab === tab.id ? "var(--neon-cyan)" : "transparent", color: activeTab === tab.id ? "#000" : "rgba(255,255,255,0.5)" }}>
                  <Icon name={tab.icon} size={13} /><span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
            <button onClick={handleLogout} className="p-2 rounded-lg transition-all hover:bg-white/10" style={{ color: "rgba(255,255,255,0.4)" }}>
              <Icon name="LogOut" size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === "rfqs" && <RfqList token={token} />}
        {activeTab === "proposals" && <MyProposals token={token} />}
        {activeTab === "pricelist" && <PriceListTab token={token} />}
        {activeTab === "prices" && <SupplierPriceOffer token={token} user={user} />}
      </main>

      <ChatWidget role="supplier" userName={user.company_name} />
    </div>
  );
}
