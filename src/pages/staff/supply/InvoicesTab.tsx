import type { InvoiceRow } from "./supply-types";
import { fmt } from "./supply-types";

export default function InvoicesTab({ invoices, loading }: {
  invoices: InvoiceRow[];
  loading: boolean;
}) {
  if (loading) return <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  return (
    <div>
      {invoices.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-5xl mb-2">🧾</div>
          <div className="text-white">Счётов пока нет</div>
          <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Счета создаются из запросов КП</div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {["Номер счёта","Объект","Поставщик","Сумма","Статус","Дата"].map((h,i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2?"rgba(255,255,255,0.015)":"transparent" }}>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: "var(--neon-cyan)" }}>{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-white">{inv.rfq_title}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{inv.company_name}</td>
                  <td className="px-4 py-3 font-display font-bold" style={{ color: "#FBBF24" }}>{fmt(inv.amount)} ₽</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: inv.status==="paid"?"rgba(0,255,136,0.12)":"rgba(255,255,255,0.07)", color: inv.status==="paid"?"var(--neon-green)":"rgba(255,255,255,0.5)" }}>
                      {inv.status==="paid"?"✅ Оплачен":inv.status==="sent"?"📬 Отправлен":"📝 Черновик"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{new Date(inv.created_at).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
