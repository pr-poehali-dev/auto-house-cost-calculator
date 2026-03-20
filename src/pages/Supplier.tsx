import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatWidget from "@/components/ChatWidget";

const API = "https://functions.poehali.dev/0864e1a5-8fce-4370-a525-80d6700b50ee";
const OPS = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";
const TOKEN_KEY = "supplier_token";

const CATEGORIES = [
  { id: "materials", label: "Стройматериалы", icon: "🧱" },
  { id: "equipment", label: "Оборудование/техника", icon: "🏗️" },
  { id: "furniture", label: "Мебель и отделка", icon: "🪑" },
  { id: "labor", label: "Рабочая сила", icon: "👷" },
];

interface SupplierUser { id: number; company_name: string; contact_name: string; email: string; phone: string; categories: string; region: string; is_verified: boolean; }
interface RFQ { id: number; title: string; construction_address: string; area: number; floors: number; house_type: string; items: RFQItem[]; deadline: string | null; status: string; my_proposal?: Proposal; }
interface RFQItem { name: string; unit: string; qty: number; category: string; }
interface Proposal { id: number; rfq_id?: number; rfq_title?: string; address?: string; total_amount: number; delivery_days: number; status: string; submitted_at?: string; items?: ProposalItem[]; comment?: string; }
interface ProposalItem { name: string; unit: string; qty: number; price_per_unit: number; total: number; }
interface Invoice { id: number; invoice_number: string; amount: number; status: string; created_at: string; rfq_title: string; address: string; }

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Supplier-Token": token } : {}), ...(opts.headers || {}) },
  }).then(r => r.json());
}

function formatMoney(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽"; }

// ─── Register / Login ─────────────────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (token: string, user: SupplierUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", password: "", region: "", categories: [] as string[], description: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const toggleCat = (id: string) => setForm(p => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter(c => c !== id) : [...p.categories, id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    const body = mode === "register"
      ? { ...form, action: "register", categories: form.categories.join(",") }
      : { email: form.email, password: form.password };
    const res = await apiFetch(API, { method: "POST", body: JSON.stringify(body) });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    localStorage.setItem(TOKEN_KEY, res.token);
    const me = await apiFetch(API, {}, res.token);
    if (me.supplier) onAuth(res.token, me.supplier);
  };

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none";
  const inpStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
  const label = "block text-xs font-semibold mb-1.5 uppercase tracking-wider";
  const labelStyle = { color: "rgba(255,255,255,0.4)" };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--dark-bg)" }}>
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
      </div>
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display font-black text-2xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 40px rgba(0,212,255,0.4)" }}>
            П
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Портал поставщиков</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>СтройКалькулятор — строительная платформа</p>
        </div>

        <div className="flex p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: mode === m ? "var(--neon-cyan)" : "transparent", color: mode === m ? "#000" : "rgba(255,255,255,0.5)" }}>
              {m === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-7 space-y-4"
          style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label} style={labelStyle}>Компания</label>
                  <input className={inp} style={inpStyle} placeholder="ООО Стройснаб" value={form.company_name} onChange={e => set("company_name", e.target.value)} required />
                </div>
                <div>
                  <label className={label} style={labelStyle}>Контактное лицо</label>
                  <input className={inp} style={inpStyle} placeholder="Иван Петров" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label} style={labelStyle}>Телефон</label>
                  <input className={inp} style={inpStyle} placeholder="+7 900 000-00-00" value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
                <div>
                  <label className={label} style={labelStyle}>Регион</label>
                  <input className={inp} style={inpStyle} placeholder="Москва" value={form.region} onChange={e => set("region", e.target.value)} />
                </div>
              </div>
              <div>
                <label className={label} style={labelStyle}>Категории поставок</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.id} onClick={() => toggleCat(c.id)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                      style={{
                        background: form.categories.includes(c.id) ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)",
                        border: form.categories.includes(c.id) ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                        color: form.categories.includes(c.id) ? "var(--neon-cyan)" : "rgba(255,255,255,0.6)",
                      }}>
                      <span>{c.icon}</span><span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label} style={labelStyle}>О компании</label>
                <textarea className={inp} style={{ ...inpStyle, resize: "none" }} rows={2} placeholder="Кратко о компании, опыт работы..." value={form.description} onChange={e => set("description", e.target.value)} />
              </div>
            </>
          )}
          {error && mode === "register" && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
              {error.toLowerCase().includes("email") && (
                <button type="button" onClick={() => { setMode("login"); setError(""); }}
                  className="ml-2 underline font-semibold whitespace-nowrap" style={{ color: "#ef4444" }}>
                  Войти с этим email →
                </button>
              )}
            </div>
          )}
          <div>
            <label className={label} style={labelStyle}>Email</label>
            <input type="email" className={inp} style={{ ...inpStyle, ...(error && error.toLowerCase().includes("email") ? { border: "1px solid #ef4444" } : {}) }} placeholder="company@mail.ru" value={form.email} onChange={e => { set("email", e.target.value); setError(""); }} required />
          </div>
          <div>
            <label className={label} style={labelStyle}>Пароль</label>
            <input type="password" className={inp} style={inpStyle} placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} required />
            {mode === "register" && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Минимум 6 символов</p>}
          </div>
          {error && <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-[1.02] disabled:opacity-60 mt-2"
            style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 25px rgba(0,212,255,0.3)" }}>
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── RFQ list for supplier ────────────────────────────────────────────────────
function RfqList({ token }: { token: string }) {
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RFQ | null>(null);
  const [proposalForm, setProposalForm] = useState<{ [key: number]: ProposalItem } & { comment?: string; delivery_days?: number }>({});
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
      setProposalForm({ ...items, comment: "", delivery_days: 14 });
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
      body: JSON.stringify({ rfq_id: selected.id, items, comment: proposalForm.comment, delivery_days: proposalForm.delivery_days }),
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Срок поставки (дней)</label>
                <input type="number" value={proposalForm.delivery_days || ""}
                  onChange={e => setProposalForm(p => ({ ...p, delivery_days: +e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Комментарий</label>
                <input type="text" value={proposalForm.comment || ""}
                  onChange={e => setProposalForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Условия, гарантии..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
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

// ─── My Proposals ─────────────────────────────────────────────────────────────
function MyProposals({ token }: { token: string }) {
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

// ─── SupplierPriceOffer ────────────────────────────────────────────────────────
const MAT_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";

interface MatItem { id: number; category: string; name: string; unit: string; price_per_unit: number; best_price: number | null; }

function SupplierPriceOffer({ token, user }: { token: string; user: SupplierUser }) {
  const [items, setItems] = useState<MatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("Все");
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [location, setLocation] = useState(user.region || "");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    apiFetch(MAT_URL + "?action=public", {}).then(r => {
      setItems(r.items || []); setLoading(false);
    });
  }, []);

  const cats = ["Все", ...Array.from(new Set(items.map(i => i.category)))];
  const filtered = items.filter(i => {
    if (filterCat !== "Все" && i.category !== filterCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const submitPrice = async (materialId: number) => {
    const price = parseFloat(prices[materialId] || "0");
    if (!price || price <= 0) return;
    setSaving(materialId);
    await apiFetch(MAT_URL + "?action=offer_price", {
      method: "POST",
      body: JSON.stringify({ material_id: materialId, price, location }),
    }, token);
    setSaving(null);
    setSaved(prev => new Set([...prev, materialId]));
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Ценообразование</div>
        <h2 className="font-display text-2xl font-bold text-white">Предложить свои цены</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Укажите цены на материалы — лучшие предложения автоматически обновят базу
        </p>
      </div>

      <div className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center"
        style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
        <div>
          <div className="text-xs mb-1 font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Регион поставки</div>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Москва и МО"
            className="px-3 py-2 rounded-xl text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", minWidth: 220 }} />
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Ваши предложения будут видны только в привязке к выбранному региону
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-48" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск материала..." className="bg-transparent outline-none text-sm flex-1" style={{ color: "rgba(255,255,255,0.8)" }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка базы материалов...</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Категория","Наименование","Ед.","Текущая лучшая цена","Ваша цена, ₽",""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{item.category}</td>
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                  <td className="px-4 py-3">
                    {item.best_price
                      ? <span className="font-display font-bold text-sm" style={{ color: "var(--neon-green)" }}>{formatMoney(item.best_price)}</span>
                      : <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={prices[item.id] || ""}
                      onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                      placeholder="Введите цену"
                      className="w-32 px-3 py-2 rounded-xl text-sm text-white outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${saved.has(item.id) ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.1)"}`,
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {saved.has(item.id) ? (
                      <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>✓ Отправлено</span>
                    ) : (
                      <button
                        onClick={() => submitPrice(item.id)}
                        disabled={!prices[item.id] || saving === item.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-40"
                        style={{ background: "var(--neon-cyan)", color: "#000" }}>
                        {saving === item.id ? "..." : "Отправить"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PriceListTab ─────────────────────────────────────────────────────────────
interface PriceRow {
  id?: number;
  material_id?: number | null;
  material_name: string;
  unit: string;
  price_per_unit: number | string;
  category: string;
  article: string;
  note: string;
  is_new_material?: boolean;
  _key: number;
}

const UNITS = ["шт","м²","м³","м п.м.","кг","т","л","уп","компл","рул"];
const CATS = ["Стройматериалы","Отделочные материалы","Кровля","Водосточные системы","Фасадные системы","Фундамент","Металлопрокат","Дерево и пиломатериалы","Утеплители","Инженерия","Электрика","Сантехника","Крепёж и метизы","Инструмент и расходники","Мебель и отделка","Прочее"];

function PriceListTab({ token }: { token: string }) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [keyGen, setKeyGen] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [searchQ, setSearchQ] = useState<Record<number, string>>({});
  const [searchRes, setSearchRes] = useState<Record<number, {id:number;name:string;unit:string;category:string}[]>>({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const addRow = () => {
    const k = keyGen + 1;
    setKeyGen(k);
    setRows(prev => [...prev, { material_name:"", unit:"шт", price_per_unit:"", category:"Прочее", article:"", note:"", _key: k }]);
  };

  const removeRow = (k: number) => setRows(prev => prev.filter(r => r._key !== k));

  const updateRow = (k: number, field: keyof PriceRow, value: unknown) => {
    setRows(prev => prev.map(r => r._key === k ? { ...r, [field]: value } : r));
  };

  // Загрузить сохранённый прайс
  useEffect(() => {
    apiFetch(API + "?action=price_list_get", {}, token).then(res => {
      if (res.items?.length) {
        const loaded: PriceRow[] = res.items.map((it: PriceRow & { _key?: number }, i: number) => ({ ...it, _key: i + 1 }));
        setRows(loaded);
        setKeyGen(loaded.length + 1);
      }
      setLoadingExisting(false);
    });
  }, [token]);

  // Поиск материала по названию
  const searchMaterial = async (k: number, q: string) => {
    setSearchQ(prev => ({ ...prev, [k]: q }));
    updateRow(k, "material_name", q);
    if (q.length < 2) { setSearchRes(prev => ({ ...prev, [k]: [] })); return; }
    const res = await apiFetch(API + "?action=materials_search", { method: "POST", body: JSON.stringify({ q }) }, token);
    setSearchRes(prev => ({ ...prev, [k]: res.materials || [] }));
  };

  const pickMaterial = (k: number, mat: {id:number;name:string;unit:string;category:string}) => {
    setRows(prev => prev.map(r => r._key === k ? { ...r, material_id: mat.id, material_name: mat.name, unit: mat.unit, category: mat.category, is_new_material: false } : r));
    setSearchRes(prev => ({ ...prev, [k]: [] }));
    setSearchQ(prev => ({ ...prev, [k]: "" }));
  };

  // Загрузка Excel файла
  const handleFile = async (file: File) => {
    setUploading(true); setUploadMsg("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      const res = await apiFetch(API + "?action=upload_kp_file", {
        method: "POST",
        body: JSON.stringify({ file_base64: b64, file_name: file.name }),
      }, token);
      setUploading(false);
      if (res.parsed_items?.length) {
        const baseKey = keyGen + 1;
        const newRows: PriceRow[] = res.parsed_items.map((it: { name: string; name_clean?: string; unit: string; price_per_unit: number; category?: string; qty?: number }, i: number) => ({
          material_name: it.name_clean || it.name,
          unit: it.unit || "шт",
          price_per_unit: it.price_per_unit || "",
          category: it.category || "Прочее",
          article: "",
          note: "",
          is_new_material: true,
          _key: baseKey + i,
        }));
        setRows(prev => [...prev, ...newRows]);
        setKeyGen(baseKey + newRows.length);
        setUploadMsg(`✓ Распознано ${newRows.length} позиций. AI определил категории автоматически.`);
      } else {
        setUploadMsg(res.error || "Файл загружен, но позиции не распознаны автоматически. Добавьте вручную.");
      }
    };
    reader.readAsDataURL(file);
  };

  // AI-классификация вручную для текущих строк
  const classifyWithAI = async () => {
    const toClassify = rows.filter(r => r.material_name.trim());
    if (!toClassify.length) return;
    setClassifying(true); setMsg("");
    const res = await apiFetch(API + "?action=ai_classify", {
      method: "POST",
      body: JSON.stringify({ items: toClassify.map(r => ({ material_name: r.material_name, unit: r.unit, category: r.category })) }),
    }, token);
    setClassifying(false);
    if (res.ok && res.items) {
      setRows(prev => prev.map((row, idx) => {
        const updated = res.items[idx];
        if (!updated) return row;
        return {
          ...row,
          category: updated.category || row.category,
          unit: updated.unit || row.unit,
          material_name: updated.name_clean || row.material_name,
        };
      }));
      setMsg("✓ AI распознал категории для всех позиций");
    } else {
      setMsg(res.error || "Ошибка AI-распознавания");
    }
  };

  // Сохранить прайс
  const savePriceList = async () => {
    const valid = rows.filter(r => r.material_name.trim() && parseFloat(String(r.price_per_unit)) > 0);
    if (!valid.length) { setMsg("Нет позиций с ценой"); return; }
    setSaving(true); setMsg("");
    const items = valid.map(r => ({
      id: r.id || null,
      material_id: r.material_id || null,
      material_name: r.material_name,
      unit: r.unit,
      price_per_unit: parseFloat(String(r.price_per_unit)),
      category: r.category,
      article: r.article,
      note: r.note,
    }));
    const res = await apiFetch(API + "?action=price_list_save", { method: "POST", body: JSON.stringify({ items }) }, token);
    setSaving(false);
    if (res.ok) setMsg(`✓ Сохранено ${res.saved} позиций. Лучшие цены обновлены в базе.`);
    else setMsg(res.error || "Ошибка сохранения");
  };

  const inp = "w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none";
  const inpSt = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Прайс-лист</div>
        <h2 className="font-display text-2xl font-bold text-white">Мой прайс-лист</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Загрузите файл Excel/PDF или добавьте позиции вручную. Лучшие цены автоматически попадут в базу.
        </p>
      </div>

      {/* Загрузка файла */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузить из файла</div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
            style={{ background: "rgba(0,212,255,0.15)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.3)" }}>
            <Icon name={uploading ? "Loader" : "Upload"} size={15} />
            {uploading ? "Обработка файла..." : "Загрузить Excel / PDF"}
          </button>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Формат: колонки «Наименование», «Ед.», «Кол-во», «Цена»
          </div>
        </div>
        {uploadMsg && (
          <div className="mt-3 text-sm px-3 py-2 rounded-lg"
            style={{ background: uploadMsg.startsWith("✓") ? "rgba(0,255,136,0.08)" : "rgba(251,191,36,0.08)", color: uploadMsg.startsWith("✓") ? "var(--neon-green)" : "#FBBF24" }}>
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Таблица позиций */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--card-border)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
            Позиции прайс-листа ({rows.length})
          </span>
          <div className="flex items-center gap-2">
            {rows.some(r => r.material_name.trim()) && (
              <button onClick={classifyWithAI} disabled={classifying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
                <Icon name={classifying ? "Loader" : "Sparkles"} size={13} />
                {classifying ? "AI думает..." : "Распознать AI"}
              </button>
            )}
            <button onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
              <Icon name="Plus" size={13} /> Добавить строку
            </button>
          </div>
        </div>

        {loadingExisting ? (
          <div className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузите файл или добавьте позиции вручную</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Наименование","Ед.","Цена, ₽","Категория","Артикул","Примечание",""].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: idx % 2 ? "rgba(255,255,255,0.012)" : "transparent" }}>
                    {/* Наименование с поиском */}
                    <td className="px-3 py-2 min-w-48 relative">
                      <input className={inp} style={{ ...inpSt, ...(row.material_id ? { borderColor: "rgba(0,255,136,0.3)" } : {}) }}
                        placeholder="Название материала"
                        value={searchQ[row._key] !== undefined ? searchQ[row._key] : row.material_name}
                        onChange={e => searchMaterial(row._key, e.target.value)} />
                      {row.material_id && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--neon-green)" }}>✓</span>
                      )}
                      {(searchRes[row._key]?.length || 0) > 0 && (
                        <div className="absolute z-20 left-3 top-full mt-1 rounded-xl overflow-hidden shadow-xl" style={{ background: "#1a1f2e", border: "1px solid rgba(0,212,255,0.2)", minWidth: 240 }}>
                          {searchRes[row._key].map(m => (
                            <button key={m.id} type="button" onClick={() => pickMaterial(row._key, m)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors">
                              <span className="text-white font-medium">{m.name}</span>
                              <span className="ml-2 opacity-50">{m.unit} · {m.category}</span>
                            </button>
                          ))}
                          <button type="button" onClick={() => { setSearchRes(prev => ({ ...prev, [row._key]: [] })); updateRow(row._key, "material_name", searchQ[row._key] || ""); setSearchQ(prev => ({ ...prev, [row._key]: "" })); }}
                            className="w-full text-left px-3 py-2 text-xs border-t transition-colors hover:bg-white/10"
                            style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--neon-orange)" }}>
                            + Добавить как новый материал
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 w-20">
                      <select className={inp} style={inpSt} value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 w-28">
                      <input type="number" className={inp} style={{ ...inpSt, ...(parseFloat(String(row.price_per_unit)) > 0 ? { borderColor: "rgba(0,212,255,0.3)" } : {}) }}
                        placeholder="0" value={row.price_per_unit}
                        onChange={e => updateRow(row._key, "price_per_unit", e.target.value)} />
                    </td>
                    <td className="px-3 py-2 w-36">
                      <select className={inp} style={inpSt} value={row.category} onChange={e => updateRow(row._key, "category", e.target.value)}>
                        {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 w-24">
                      <input className={inp} style={inpSt} placeholder="—" value={row.article}
                        onChange={e => updateRow(row._key, "article", e.target.value)} />
                    </td>
                    <td className="px-3 py-2 w-36">
                      <input className={inp} style={inpSt} placeholder="Примечание" value={row.note}
                        onChange={e => updateRow(row._key, "note", e.target.value)} />
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => removeRow(row._key)} className="p-1 rounded-lg transition-all hover:bg-red-500/20" style={{ color: "rgba(255,255,255,0.2)" }}>
                        <Icon name="X" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: msg.startsWith("✓") ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.1)", color: msg.startsWith("✓") ? "var(--neon-green)" : "#ef4444", border: `1px solid ${msg.startsWith("✓") ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {msg}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={addRow}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="Plus" size={15} /> Добавить строку
        </button>
        <button onClick={savePriceList} disabled={saving || rows.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 20px rgba(0,212,255,0.25)" }}>
          <Icon name={saving ? "Loader" : "Save"} size={15} />
          {saving ? "Сохранение..." : `Сохранить прайс (${rows.filter(r => parseFloat(String(r.price_per_unit)) > 0).length} позиций)`}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  // Если пришли по ссылке из уведомления с rfq_id
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

      {/* Header */}
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