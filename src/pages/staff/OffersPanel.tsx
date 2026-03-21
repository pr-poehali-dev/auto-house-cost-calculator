import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { MAT_URL, fmt, apiFetch, Material, Offer } from "./materials-types";

export default function OffersPanel({ material, token, role, onAccept }: {
  material: Material; token: string; role: string; onAccept: () => void;
}) {
  const [offers, setOffers] = useState<Offer[]>(material.offers || []);
  const [loading, setLoading] = useState(!material.offers);

  useEffect(() => {
    if (!material.offers) {
      apiFetch(`${MAT_URL}?action=offers&material_id=${material.id}`, {}, token)
        .then(r => { setOffers(r.offers || []); setLoading(false); });
    }
  }, [material, token]);

  const acceptBest = async () => {
    await apiFetch(`${MAT_URL}?action=accept_best_price`, {
      method: "POST", body: JSON.stringify({ material_id: material.id }),
    }, token);
    onAccept();
  };

  if (loading) return <div className="py-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;
  if (!offers.length) return <div className="py-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Предложений от поставщиков нет</div>;

  const best = offers[0];
  const saving = best.price < material.price_per_unit ? material.price_per_unit - best.price : 0;

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return d; } };

  return (
    <div className="space-y-2">
      {offers.map(o => (
        <div key={String(o.id)} className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{ background: o.id === best.id ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${o.id === best.id ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.06)"}` }}>
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-white">{o.company}</span>
                {o.source === "pricelist" && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", fontSize: "10px" }}>прайс</span>
                )}
              </div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                {o.location || o.region || ""}
                {o.note ? ` · ${o.note}` : ""}
                {o.updated_at ? ` · ${fmtDate(o.updated_at)}` : ""}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-sm" style={{ color: o.id === best.id ? "var(--neon-green)" : "rgba(255,255,255,0.7)" }}>
              {fmt(o.price)} ₽/{material.unit}
            </div>
            {o.id === best.id && <div className="text-xs" style={{ color: "var(--neon-green)" }}>Лучшая цена</div>}
          </div>
        </div>
      ))}
      {saving > 0 && role in { "constructor": 1, "architect": 1, "supply": 1 } && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Экономия vs текущей: <span style={{ color: "var(--neon-green)" }}>{fmt(saving)} ₽/{material.unit}</span>
          </div>
          <button onClick={acceptBest}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.3)" }}>
            Принять лучшую цену
          </button>
        </div>
      )}
    </div>
  );
}
