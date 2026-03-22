import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { API, OPS, apiFetch, formatMoney, type RFQ, type RFQItem, type Proposal, type ProposalItem, type Invoice } from "./supplier-types";

export function RfqList({ token }: { token: string }) {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RFQ | null>(null);
  const [proposalForm, setProposalForm] = useState<Record<number, ProposalItem> & { comment?: string; delivery_days?: number; delivery_conditions?: string; delivery_city?: string; delivery_street?: string; delivery_building?: string; quality_gost?: string; quality_certificates?: string; quality_warranty_months?: number; acceptance_method?: string; acceptance_min_batch?: string; acceptance_packaging?: string; resources_warehouse?: string; resources_transport?: string; resources_managers?: number; }>({});
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(API + "?action=rfq_list", {}, token);
    setRfqs(res.rfqs || []); setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openRFQ = async (rfq: RFQ) => {
    const res = await apiFetch(API + `?action=rfq_get`, { method: "POST", body: JSON.stringify({ rfq_id: rfq.id }) }, token);
    if (res.rfq) {
      setSelected(res.rfq);
      const items: Record<number, ProposalItem> = {};
      (res.rfq.items || []).forEach((item: RFQItem, i: number) => {
        items[i] = { name: item.name, unit: item.unit, qty: item.qty, price_per_unit: 0, total: 0 };
      });
      setProposalForm({
        ...items,
        comment: "", delivery_days: 14, delivery_conditions: "", delivery_city: "", delivery_street: "", delivery_building: "",
        quality_gost: "", quality_certificates: "", quality_warranty_months: 12,
        acceptance_method: "", acceptance_min_batch: "", acceptance_packaging: "",
        resources_warehouse: "", resources_transport: "", resources_managers: 1,
      });
    }
  };

  const updateItemPrice = (idx: number, price: number) => {
    setProposalForm(prev => {
      const item = { ...prev[idx] as ProposalItem, price_per_unit: price, total: price * (prev[idx] as ProposalItem).qty };
      return { ...prev, [idx]: item };
    });
  };

  const submitProposal = async () => {
    if (!selected) return;
    setSubmitting(true); setMsg("");
    const items = Object.keys(proposalForm).filter(k => !isNaN(+k)).map(k => proposalForm[+k] as ProposalItem);
    const res = await apiFetch(API + "?action=proposal_submit", {
      method: "POST",
      body: JSON.stringify({
        rfq_id: selected.id, items,
        comment: proposalForm.comment,
        delivery_days: proposalForm.delivery_days,
        delivery_conditions: proposalForm.delivery_conditions,
        delivery_city: proposalForm.delivery_city,
        delivery_street: proposalForm.delivery_street,
        delivery_building: proposalForm.delivery_building,
        quality_gost: proposalForm.quality_gost,
        quality_certificates: proposalForm.quality_certificates,
        quality_warranty_months: proposalForm.quality_warranty_months,
        acceptance_method: proposalForm.acceptance_method,
        acceptance_min_batch: proposalForm.acceptance_min_batch,
        acceptance_packaging: proposalForm.acceptance_packaging,
        resources_warehouse: proposalForm.resources_warehouse,
        resources_transport: proposalForm.resources_transport,
        resources_managers: proposalForm.resources_managers,
      }),
    }, token);
    setSubmitting(false);
    if (res.ok) { setMsg("Предложение отправлено!"); setSelected(null); load(); }
    else setMsg(res.error || "Ошибка");
  };

  if (loading) return <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка запросов...</div>;

  if (selected) {
    const itemKeys = Object.keys(proposalForm).filter(k => !isNaN(+k)).map(Number);
    const totalSum = itemKeys.reduce((s, k) => s + ((proposalForm[k] as ProposalItem)?.total || 0), 0);
    return (
      <div className="animate-fade-in">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 mb-5 text-sm transition-all hover:opacity-80" style={{ color: "rgba(255,255,255,0.5)" }}>
          <Icon name="ChevronLeft" size={16} /> Назад к списку
        </button>
        <div className="rounded-2xl p-6 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.25)" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Запрос КП #{selected.id}</div>
          <h2 className="font-display text-2xl font-bold text-white mb-1">{selected.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span>📍 {selected.construction_address}</span>
            {selected.area && <span>📐 {selected.area} м²</span>}
            {selected.floors && <span>🏠 {selected.floors} эт.</span>}
            {selected.deadline && <span>📅 Срок: {selected.deadline}</span>}
          </div>
        </div>

        {selected.my_proposal ? (
          <div className="rounded-2xl p-6" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)" }}>
            <div className="font-display font-bold text-lg" style={{ color: "var(--neon-green)" }}>✓ Предложение отправлено</div>
            <div className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>
              Сумма: {formatMoney(selected.my_proposal.total_amount)} · Статус: {selected.my_proposal.status === "winner" ? "🏆 Победитель" : selected.my_proposal.status === "rejected" ? "❌ Отклонено" : "⏳ На рассмотрении"}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <h3 className="font-display font-semibold text-lg text-white mb-4">Ваше коммерческое предложение</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    {["Наименование", "Ед.", "Кол-во", "Ваша цена/ед., ₽", "Сумма, ₽"].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid var(--card-border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemKeys.map((k, i) => {
                    const item = proposalForm[k] as ProposalItem;
                    return (
                      <tr key={k} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                        <td className="px-3 py-2.5 text-white">{item.name}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                        <td className="px-3 py-2.5 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>{item.qty}</td>
                        <td className="px-3 py-2.5">
                          <input type="number" min={0} value={item.price_per_unit || ""}
                            onChange={e => updateItemPrice(k, +e.target.value)}
                            className="w-28 px-2 py-1.5 rounded-lg text-sm text-white outline-none"
                            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(0,212,255,0.3)" }}
                            placeholder="0" />
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-right" style={{ color: "var(--neon-cyan)" }}>
                          {item.total > 0 ? formatMoney(item.total) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "rgba(0,212,255,0.08)", borderTop: "1px solid rgba(0,212,255,0.3)" }}>
                    <td colSpan={3} className="px-3 py-3 font-semibold text-white">ИТОГО</td>
                    <td colSpan={2} className="px-3 py-3 text-right font-display font-bold text-lg" style={{ color: "var(--neon-cyan)" }}>{formatMoney(totalSum)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Условия поставки</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Срок поставки (дней) *</label>
                  <input type="number" value={proposalForm.delivery_days || ""}
                    onChange={e => setProposalForm(p => ({ ...p, delivery_days: +e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Условия (самовывоз / доставка)</label>
                  <input type="text" value={proposalForm.delivery_conditions || ""}
                    onChange={e => setProposalForm(p => ({ ...p, delivery_conditions: e.target.value }))}
                    placeholder="напр. Доставка включена / Самовывоз"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Адрес доставки</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Город</label>
                  <input type="text" value={proposalForm.delivery_city || ""}
                    onChange={e => setProposalForm(p => ({ ...p, delivery_city: e.target.value }))}
                    placeholder="Москва"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Улица</label>
                  <input type="text" value={proposalForm.delivery_street || ""}
                    onChange={e => setProposalForm(p => ({ ...p, delivery_street: e.target.value }))}
                    placeholder="ул. Строителей"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Дом / офис</label>
                  <input type="text" value={proposalForm.delivery_building || ""}
                    onChange={e => setProposalForm(p => ({ ...p, delivery_building: e.target.value }))}
                    placeholder="12, стр. 1"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ShieldCheck" size={14} style={{ color: "var(--neon-green)" }} />
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--neon-green)" }}>Качество</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>ГОСТ / ТУ</label>
                  <input type="text" value={proposalForm.quality_gost || ""}
                    onChange={e => setProposalForm(p => ({ ...p, quality_gost: e.target.value }))}
                    placeholder="ГОСТ 530-2012"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Сертификаты</label>
                  <input type="text" value={proposalForm.quality_certificates || ""}
                    onChange={e => setProposalForm(p => ({ ...p, quality_certificates: e.target.value }))}
                    placeholder="ISO 9001, ПБ, ЭКО"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Гарантия (месяцев)</label>
                  <input type="number" min={0} value={proposalForm.quality_warranty_months ?? ""}
                    onChange={e => setProposalForm(p => ({ ...p, quality_warranty_months: +e.target.value }))}
                    placeholder="12"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="ClipboardCheck" size={14} style={{ color: "var(--neon-orange)" }} />
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--neon-orange)" }}>Параметры приёмки</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Способ приёмки</label>
                  <select value={proposalForm.acceptance_method || ""}
                    onChange={e => setProposalForm(p => ({ ...p, acceptance_method: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <option value="">Не указано</option>
                    <option>По накладной</option>
                    <option>С замером на объекте</option>
                    <option>По факту монтажа</option>
                    <option>Лабораторный контроль</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Мин. партия</label>
                  <input type="text" value={proposalForm.acceptance_min_batch || ""}
                    onChange={e => setProposalForm(p => ({ ...p, acceptance_min_batch: e.target.value }))}
                    placeholder="1 паллет / 100 шт."
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Упаковка</label>
                  <input type="text" value={proposalForm.acceptance_packaging || ""}
                    onChange={e => setProposalForm(p => ({ ...p, acceptance_packaging: e.target.value }))}
                    placeholder="Паллеты, стрейч-плёнка"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Icon name="Warehouse" size={14} style={{ color: "#A855F7" }} />
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#A855F7" }}>Ресурсы</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Склад</label>
                  <input type="text" value={proposalForm.resources_warehouse || ""}
                    onChange={e => setProposalForm(p => ({ ...p, resources_warehouse: e.target.value }))}
                    placeholder="Москва, 5000 м²"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Транспорт</label>
                  <input type="text" value={proposalForm.resources_transport || ""}
                    onChange={e => setProposalForm(p => ({ ...p, resources_transport: e.target.value }))}
                    placeholder="3 фуры до 20 т"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Кол-во менеджеров</label>
                  <input type="number" min={1} value={proposalForm.resources_managers ?? ""}
                    onChange={e => setProposalForm(p => ({ ...p, resources_managers: +e.target.value }))}
                    placeholder="1"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Комментарий / особые условия</label>
              <input type="text" value={proposalForm.comment || ""}
                onChange={e => setProposalForm(p => ({ ...p, comment: e.target.value }))}
                placeholder="Условия оплаты, гарантии, особые условия..."
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            {msg && <div className="mb-3 text-sm" style={{ color: msg.includes("отправлено") ? "var(--neon-green)" : "#ef4444" }}>{msg}</div>}
            <button onClick={submitProposal} disabled={submitting || totalSum === 0}
              className="px-8 py-3 rounded-xl font-display font-semibold text-base transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
              {submitting ? "Отправка..." : `Отправить КП на ${formatMoney(totalSum)}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Открытые запросы</div>
        <h2 className="font-display text-2xl font-bold text-white">Запросы коммерческих предложений</h2>
      </div>
      {rfqs.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="text-5xl mb-3">📋</div>
          <div className="font-display text-lg text-white">Нет активных запросов</div>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Запросы появятся здесь, когда снабженец их создаст</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map((rfq, i) => (
            <div key={rfq.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.005]"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}
              onClick={() => openRFQ(rfq)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-bold text-lg text-white">{rfq.title}</div>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <span>📍 {rfq.construction_address}</span>
                    {rfq.area && <span>📐 {rfq.area} м²</span>}
                    {rfq.deadline && <span>📅 до {rfq.deadline}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(rfq.items || []).slice(0, 4).map((item, j) => (
                      <span key={j} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>{item.name}</span>
                    ))}
                    {(rfq.items || []).length > 4 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>+{(rfq.items || []).length - 4} ещё</span>}
                  </div>
                </div>
                <Icon name="ChevronRight" size={18} style={{ color: "var(--neon-cyan)", flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MyProposals({ token }: { token: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(API + "?action=my_proposals", {}, token),
      apiFetch(OPS + "?action=my_invoices", {}, token),
    ]).then(([p, inv]) => {
      setProposals(p.proposals || []);
      setInvoices(inv.invoices || []);
      setLoading(false);
    });
  }, [token]);

  const statusColor = (s: string) => s === "winner" ? "var(--neon-green)" : s === "rejected" ? "#ef4444" : "rgba(255,255,255,0.5)";
  const statusLabel = (s: string) => s === "winner" ? "🏆 Победитель" : s === "rejected" ? "❌ Отклонено" : "⏳ На рассмотрении";

  if (loading) return <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-orange)" }}>Мои предложения</div>
        <h2 className="font-display text-2xl font-bold text-white mb-4">История КП</h2>
        {proposals.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="text-4xl mb-2">📤</div>
            <div className="text-white">Вы ещё не подавали предложений</div>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p, i) => (
              <div key={p.id} className="rounded-2xl p-5 flex items-center justify-between"
                style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}>
                <div>
                  <div className="font-semibold text-white">{p.rfq_title}</div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>📍 {p.address}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-lg" style={{ color: "var(--neon-cyan)" }}>{formatMoney(p.total_amount)}</div>
                  <div className="text-xs mt-0.5 font-semibold" style={{ color: statusColor(p.status) }}>{statusLabel(p.status)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {invoices.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-green)" }}>Счета</div>
          <h2 className="font-display text-2xl font-bold text-white mb-4">Выставленные счета</h2>
          <div className="space-y-3">
            {invoices.map((inv, i) => (
              <div key={inv.id} className="rounded-2xl p-5 flex items-center justify-between"
                style={{ background: "var(--card-bg)", border: "1px solid rgba(0,255,136,0.2)", animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both` }}>
                <div>
                  <div className="font-semibold text-white">{inv.invoice_number}</div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{inv.rfq_title}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-lg" style={{ color: "var(--neon-green)" }}>{formatMoney(inv.amount)}</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {inv.status === "paid" ? "✅ Оплачен" : inv.status === "sent" ? "📬 Отправлен" : "📝 Черновик"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
