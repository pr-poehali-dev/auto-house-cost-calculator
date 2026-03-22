import Icon from "@/components/ui/icon";
import type { SupplierRow } from "./supply-types";

export default function SuppliersTab({ suppliers, loading, onVerify }: {
  suppliers: SupplierRow[];
  loading: boolean;
  onVerify: (id: number, verified: boolean) => void;
}) {
  if (loading) return <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  return (
    <div>
      {suppliers.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-5xl mb-2">🏭</div>
          <div className="text-white">Поставщики не зарегистрированы</div>
          <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Поставщики регистрируются через портал поставщиков</div>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map(s => (
            <div key={s.id} className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-display font-bold text-lg text-white">{s.company_name}</div>
                    {s.is_verified
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)" }}>✓ Верифицирован</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>На проверке</span>}
                  </div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{s.contact_name}</div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <span>📞 {s.phone}</span>
                    <span>✉️ {s.email}</span>
                    {s.region && <span>📍 {s.region}</span>}
                  </div>
                  {s.categories && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.categories.split(",").map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>{c.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {!s.is_verified ? (
                    <button onClick={() => onVerify(s.id, true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                      style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
                      <Icon name="CheckCircle" size={14} /> Верифицировать
                    </button>
                  ) : (
                    <button onClick={() => onVerify(s.id, false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all hover:scale-105"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <Icon name="XCircle" size={14} /> Снять верификацию
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
