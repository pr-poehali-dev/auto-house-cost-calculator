import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const ORDER_URL = "https://functions.poehali.dev/5cd1eb69-9a08-4572-ae2a-bc11e49da506";
const COMPANY_URL = "https://functions.poehali.dev/0796a927-18d1-46be-bd26-3bbcfe93738d";
const SUPPLIER_API = "https://functions.poehali.dev/0864e1a5-8fce-4370-a525-80d6700b50ee";

interface SalesManagerProps {
  user: { id: number; full_name: string; role_code: string };
  token: string;
}

interface Order {
  id: number;
  number: string;
  status: string;
  stage: string;
  source: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  client_comment?: string;
  area?: number;
  floors?: number;
  budget?: number;
  address?: string;
  notes?: string;
  manager_name?: string;
  manager_id?: number;
  next_action?: string;
  next_action_at?: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  house_project_id?: number;
  company_id?: number;
  files?: OrderFile[];
  specs?: OrderSpec[];
  events?: LeadEvent[];
}

interface OrderFile {
  id: number;
  file_name: string;
  file_url: string;
  file_type: string;
  parse_status?: string;
  parse_result?: unknown;
  created_at: string;
}

interface SpecItem {
  section: string;
  name: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  note?: string;
}

interface OrderSpec {
  id: number;
  title: string;
  items: SpecItem[];
  total_qty: number;
  total_amount: number;
  created_at: string;
  updated_at?: string;
}

interface LeadEvent {
  id: number;
  type: string;
  direction?: string;
  content: string;
  source?: string;
  author?: string;
  created_at: string;
}

interface Proposal {
  id: number;
  number: string;
  status: string;
  total_amount: number;
  items?: SpecItem[];
  created_at: string;
}

interface Contract {
  id: number;
  number: string;
  status: string;
  template_id?: number;
  lawyer_approved_by?: number;
  lawyer_approved_at?: string;
  created_at: string;
}

interface ContractTemplate {
  id: number;
  name: string;
  type: string;
}

interface RfqBrief {
  id: number;
  title: string;
  construction_address: string;
  status: string;
  proposals_count: number;
  deadline: string | null;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...(opts.headers || {}),
    },
  }).then((r) => r.json());
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function relativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "только что";
    if (mins < 60) return `${mins} мин назад`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ч назад`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} д назад`;
    return new Date(dateStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Style constants ─────────────────────────────────────────────────────────

const INP = "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all";
const INP_S = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };
const LBL_S = { color: "rgba(255,255,255,0.4)" };
const CARD_S = { background: "var(--card-bg)", border: "1px solid var(--card-border)" };

function focusOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "var(--neon-orange)";
}
function blurOn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = "rgba(255,255,255,0.1)";
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: "Лид", qualified: "Квалифицирован", proposal: "КП",
  negotiation: "Переговоры", contract: "Договор", won: "Выигран", lost: "Проигран",
};
const STAGE_COLORS: Record<string, string> = {
  lead: "#6B7280", qualified: "#00D4FF", proposal: "#FBBF24",
  negotiation: "#A855F7", contract: "#FF6B1A", won: "#00FF88", lost: "#ef4444",
};
const SOURCE_LABELS: Record<string, string> = {
  site: "Сайт", avito: "Авито", direct: "Прямое", referral: "Рекомендация",
};
const SOURCE_COLORS: Record<string, string> = {
  site: "#00D4FF", avito: "#00FF88", direct: "#FBBF24", referral: "#A855F7",
};
const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444", normal: "#FBBF24", low: "#6B7280",
};
const FILE_TYPE_LABELS: Record<string, string> = {
  project: "Проект", spec: "Спецификация", dwg: "DWG", bim: "BIM", other: "Прочее",
};
const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", sent: "#00D4FF", accepted: "#00FF88", rejected: "#ef4444",
};
const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик", sent: "Отправлено", accepted: "Принято", rejected: "Отклонено",
};
const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280", review: "#FBBF24", approved: "#00FF88", signed: "#00D4FF",
};
const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик", review: "На проверке", approved: "Согласован", signed: "Подписан",
};
const EVENT_TYPE_ICONS: Record<string, string> = {
  call: "Phone", message: "MessageSquare", note: "StickyNote", meeting: "Users",
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  call: "Звонок", message: "Сообщение", note: "Заметка", meeting: "Встреча",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: `${STAGE_COLORS[stage] || "#888"}22`, color: STAGE_COLORS[stage] || "#888" }}
    >
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: `${SOURCE_COLORS[source] || "#888"}20`, color: SOURCE_COLORS[source] || "#888" }}
    >
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ orders }: { orders: Order[] }) {
  const stats = [
    { label: "Новые", value: orders.filter((o) => o.stage === "lead").length, color: "#6B7280", icon: "Inbox" },
    { label: "В работе", value: orders.filter((o) => ["qualified", "proposal", "negotiation"].includes(o.stage)).length, color: "#FBBF24", icon: "TrendingUp" },
    { label: "КП отправлено", value: orders.filter((o) => o.stage === "proposal").length, color: "#00D4FF", icon: "FileText" },
    { label: "Договор", value: orders.filter((o) => o.stage === "contract" || o.stage === "won").length, color: "#00FF88", icon: "CheckCircle2" },
  ];
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3" style={CARD_S}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${s.color}18` }}
          >
            <Icon name={s.icon} size={18} style={{ color: s.color }} />
          </div>
          <div>
            <div className="text-2xl font-bold text-white leading-none">{s.value}</div>
            <div className="text-xs mt-0.5" style={LBL_S}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── New Order Modal ──────────────────────────────────────────────────────────

function NewOrderModal({
  token,
  onCreated,
  onClose,
}: {
  token: string;
  onCreated: (id: number) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    client_name: "", client_phone: "", client_email: "",
    source: "site", area: "", floors: "", budget: "",
    address: "", client_comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim()) { setError("Укажите имя клиента"); return; }
    setSaving(true);
    const body: Record<string, unknown> = { ...form };
    if (form.area) body.area = parseFloat(form.area);
    if (form.floors) body.floors = parseInt(form.floors);
    if (form.budget) body.budget = parseFloat(form.budget);
    const res = await apiFetch(`${ORDER_URL}?action=create`, { method: "POST", body: JSON.stringify(body) }, token);
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onCreated(res.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden animate-fade-in"
        style={CARD_S}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2">
            <Icon name="PlusCircle" size={18} style={{ color: "#FBBF24" }} />
            <span className="font-semibold text-white">Новый заказ</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
            <Icon name="X" size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs mb-1.5" style={LBL_S}>Имя клиента *</label>
              <input
                className={INP} style={INP_S} value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Телефон</label>
              <input
                className={INP} style={INP_S} value={form.client_phone}
                onChange={(e) => set("client_phone", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="+7 (900) 000-00-00"
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Email</label>
              <input
                className={INP} style={INP_S} type="email" value={form.client_email}
                onChange={(e) => set("client_email", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="client@mail.ru"
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Источник</label>
              <select
                className={INP} style={INP_S} value={form.source}
                onChange={(e) => set("source", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
              >
                <option value="site">Сайт</option>
                <option value="avito">Авито</option>
                <option value="direct">Прямое обращение</option>
                <option value="referral">Рекомендация</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Площадь (м²)</label>
              <input
                className={INP} style={INP_S} type="number" value={form.area}
                onChange={(e) => set("area", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="120"
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Этажей</label>
              <input
                className={INP} style={INP_S} type="number" value={form.floors}
                onChange={(e) => set("floors", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="2"
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={LBL_S}>Бюджет (₽)</label>
              <input
                className={INP} style={INP_S} type="number" value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="5000000"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs mb-1.5" style={LBL_S}>Адрес объекта</label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all resize-none"
                style={INP_S} rows={2} value={form.address}
                onChange={(e) => set("address", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="г. Москва, ул. Примерная, д. 1"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs mb-1.5" style={LBL_S}>Комментарий клиента</label>
              <textarea
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all resize-none"
                style={INP_S} rows={3} value={form.client_comment}
                onChange={(e) => set("client_comment", e.target.value)}
                onFocus={focusOn} onBlur={blurOn}
                placeholder="Пожелания, требования..."
              />
            </div>
          </div>
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm transition-all hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}>
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#FBBF24", color: "#0a0d14" }}>
              {saving ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
              {saving ? "Создание..." : "Создать заказ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const pColor = PRIORITY_COLORS[order.priority || "normal"];
  return (
    <div
      className="rounded-2xl p-4 transition-all hover:border-white/20 cursor-pointer"
      style={CARD_S}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: pColor, boxShadow: `0 0 6px ${pColor}` }}
          />
          <span className="font-semibold text-white text-sm truncate">{order.client_name}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StageBadge stage={order.stage} />
          <SourceBadge source={order.source} />
        </div>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
          {order.number}
        </span>
        {order.client_phone && (
          <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="Phone" size={10} />
            {order.client_phone}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 mb-3">
        {order.area && (
          <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="Maximize2" size={10} />
            {order.area} м²
          </span>
        )}
        {order.budget && (
          <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="Wallet" size={10} />
            {fmt(order.budget)} ₽
          </span>
        )}
        {order.manager_name && (
          <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="User" size={10} />
            {order.manager_name}
          </span>
        )}
      </div>
      {order.next_action && (
        <div
          className="rounded-lg px-3 py-1.5 mb-3 flex items-center gap-2"
          style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)" }}
        >
          <Icon name="Zap" size={11} style={{ color: "#FBBF24" }} />
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{order.next_action}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {relativeTime(order.created_at)}
        </span>
        <button
          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
          style={{ background: "rgba(251,191,36,0.12)", color: "#FBBF24" }}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          Открыть
        </button>
      </div>
    </div>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────────

function OrderDetail({
  orderId,
  token,
  onBack,
}: {
  orderId: number;
  token: string;
  onBack: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("client");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [rfqs, setRfqs] = useState<RfqBrief[]>([]);

  const loadOrder = useCallback(() => {
    apiFetch(`${ORDER_URL}?action=get&order_id=${orderId}`, {}, token).then((r) => {
      setOrder(r.order || null);
      setLoading(false);
    });
  }, [orderId, token]);

  const loadRfqs = useCallback(() => {
    apiFetch(`${SUPPLIER_API}?action=rfq_list`, {}, token).then((r) => {
      const all: RfqBrief[] = r.rfqs || [];
      setRfqs(all.filter((rfq) => (rfq as unknown as { order_id?: number }).order_id === orderId));
    });
  }, [orderId, token]);

  useEffect(() => { loadOrder(); loadRfqs(); }, [loadOrder, loadRfqs]);

  useEffect(() => {
    if (tab === "proposal") {
      apiFetch(`${ORDER_URL}?action=proposals&order_id=${orderId}`, {}, token).then((r) =>
        setProposals(r.proposals || [])
      );
    }
    if (tab === "contract") {
      apiFetch(`${ORDER_URL}?action=contracts&order_id=${orderId}`, {}, token).then((r) =>
        setContracts(r.contracts || [])
      );
      apiFetch(`${COMPANY_URL}?action=templates`).then((r) =>
        setTemplates(r.templates || [])
      );
    }
    if (tab === "supply") loadRfqs();
  }, [tab, orderId, token, loadRfqs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Icon name="Loader2" size={32} className="animate-spin" style={{ color: "#FBBF24" }} />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="text-center py-24">
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Заказ не найден</p>
        <button onClick={onBack} className="mt-4 text-sm" style={{ color: "#FBBF24" }}>← Назад</button>
      </div>
    );
  }

  const DETAIL_TABS = [
    { id: "client", label: "Клиент", icon: "User" },
    { id: "files", label: "Файлы проекта", icon: "Folder" },
    { id: "vor", label: "ВОР", icon: "ClipboardList" },
    { id: "proposal", label: "КП", icon: "FileText" },
    { id: "contract", label: "Договор", icon: "ScrollText" },
    { id: "supply", label: "Снабжение", icon: "Truck" },
    { id: "history", label: "История", icon: "Clock" },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
        >
          <Icon name="ArrowLeft" size={15} />
          Назад
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">{order.client_name}</span>
            <span className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>{order.number}</span>
            <StageBadge stage={order.stage} />
          </div>
          {order.client_phone && (
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{order.client_phone}</p>
          )}
        </div>
      </div>

      {/* Stage pills */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(STAGE_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={async () => {
              await apiFetch(`${ORDER_URL}?action=update`, { method: "POST", body: JSON.stringify({ order_id: order.id, stage: k }) }, token);
              setOrder((p) => p ? { ...p, stage: k } : p);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: order.stage === k ? `${STAGE_COLORS[k]}28` : "rgba(255,255,255,0.05)",
              color: order.stage === k ? STAGE_COLORS[k] : "rgba(255,255,255,0.4)",
              border: order.stage === k ? `1px solid ${STAGE_COLORS[k]}55` : "1px solid transparent",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ background: "rgba(255,255,255,0.04)" }}>
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background: tab === t.id ? "var(--card-bg)" : "transparent",
              color: tab === t.id ? "#FBBF24" : "rgba(255,255,255,0.5)",
              border: tab === t.id ? "1px solid var(--card-border)" : "1px solid transparent",
            }}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
            {t.id === "supply" && rfqs.length > 0 && (
              <span
                className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: tab === t.id ? "#FBBF24" : "rgba(251,191,36,0.25)", color: tab === t.id ? "#0a0d14" : "#FBBF24" }}
              >
                {rfqs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "client" && (
        <ClientTab order={order} token={token} onSaved={loadOrder} />
      )}
      {tab === "files" && (
        <FilesTab order={order} token={token} onRefresh={loadOrder} />
      )}
      {tab === "vor" && (
        <VorTab order={order} token={token} />
      )}
      {tab === "proposal" && (
        <ProposalTab orderId={order.id} proposals={proposals} setProposals={setProposals} token={token} />
      )}
      {tab === "contract" && (
        <ContractTab
          orderId={order.id}
          orderCompanyId={order.company_id}
          contracts={contracts}
          setContracts={setContracts}
          templates={templates}
          token={token}
        />
      )}
      {tab === "supply" && (
        <SupplyTab orderId={order.id} rfqs={rfqs} address={order.address} />
      )}
      {tab === "history" && (
        <HistoryTab order={order} token={token} onRefresh={loadOrder} />
      )}
    </div>
  );
}

// ─── Client Tab ───────────────────────────────────────────────────────────────

function ClientTab({ order, token, onSaved }: { order: Order; token: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    client_name: order.client_name || "",
    client_phone: order.client_phone || "",
    client_email: order.client_email || "",
    area: order.area ? String(order.area) : "",
    floors: order.floors ? String(order.floors) : "",
    budget: order.budget ? String(order.budget) : "",
    address: order.address || "",
    notes: order.notes || "",
    next_action: order.next_action || "",
    next_action_at: order.next_action_at ? order.next_action_at.slice(0, 16) : "",
    priority: order.priority || "normal",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {
      order_id: order.id,
      ...form,
    };
    if (form.area) body.area = parseFloat(form.area);
    if (form.floors) body.floors = parseInt(form.floors);
    if (form.budget) body.budget = parseFloat(form.budget);
    if (!form.area) delete body.area;
    if (!form.floors) delete body.floors;
    if (!form.budget) delete body.budget;
    const res = await apiFetch(`${ORDER_URL}?action=update`, { method: "POST", body: JSON.stringify(body) }, token);
    setSaving(false);
    setMsg(res.error ? `Ошибка: ${res.error}` : "Сохранено");
    if (!res.error) onSaved();
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="rounded-2xl p-5 space-y-5" style={CARD_S}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs mb-1.5" style={LBL_S}>Имя клиента</label>
          <input className={INP} style={INP_S} value={form.client_name} onChange={(e) => set("client_name", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Телефон</label>
          <input className={INP} style={INP_S} value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Email</label>
          <input className={INP} style={INP_S} type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Площадь (м²)</label>
          <input className={INP} style={INP_S} type="number" value={form.area} onChange={(e) => set("area", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Бюджет (₽)</label>
          <input className={INP} style={INP_S} type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs mb-1.5" style={LBL_S}>Адрес объекта</label>
          <input className={INP} style={INP_S} value={form.address} onChange={(e) => set("address", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs mb-1.5" style={LBL_S}>Заметки</label>
          <textarea
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all resize-none"
            style={INP_S} rows={3} value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            onFocus={focusOn} onBlur={blurOn}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs mb-1.5" style={LBL_S}>Следующее действие</label>
          <input className={INP} style={INP_S} value={form.next_action} onChange={(e) => set("next_action", e.target.value)} onFocus={focusOn} onBlur={blurOn} placeholder="Позвонить, отправить КП..." />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Дата следующего действия</label>
          <input className={INP} style={INP_S} type="datetime-local" value={form.next_action_at} onChange={(e) => set("next_action_at", e.target.value)} onFocus={focusOn} onBlur={blurOn} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={LBL_S}>Приоритет</label>
          <select className={INP} style={INP_S} value={form.priority} onChange={(e) => set("priority", e.target.value)} onFocus={focusOn} onBlur={blurOn}>
            <option value="high">Высокий</option>
            <option value="normal">Обычный</option>
            <option value="low">Низкий</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "#FBBF24", color: "#0a0d14" }}
        >
          {saving ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Save" size={15} />}
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {msg && (
          <span className="text-sm flex items-center gap-1.5" style={{ color: msg.startsWith("Ошибка") ? "#ef4444" : "#00FF88" }}>
            <Icon name={msg.startsWith("Ошибка") ? "AlertCircle" : "CheckCircle2"} size={14} />
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Files Tab ────────────────────────────────────────────────────────────────

const PARSE_STATUS_COLORS: Record<string, string> = {
  pending: "#6B7280", processing: "#FBBF24", done: "#00FF88", error: "#ef4444",
};
const PARSE_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает", processing: "Обработка", done: "Готово", error: "Ошибка",
};

function FilesTab({ order, token, onRefresh }: { order: Order; token: string; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState("spec");
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState<Record<number, boolean>>({});
  const [parseResults, setParseResults] = useState<Record<number, number>>({});
  const files = order.files || [];

  const handleUpload = async (file: File) => {
    setUploading(true);
    const presRes = await apiFetch(
      `${ORDER_URL}?action=presigned_file`,
      { method: "POST", body: JSON.stringify({ order_id: order.id, file_name: file.name }) },
      token
    );
    if (presRes.error) { setUploading(false); return; }
    await fetch(presRes.presigned_url, { method: "PUT", body: file, headers: { "Content-Type": "application/octet-stream" } });
    await apiFetch(
      `${ORDER_URL}?action=confirm_file`,
      { method: "POST", body: JSON.stringify({ order_id: order.id, file_name: file.name, file_url: presRes.cdn_url, file_type: fileType }) },
      token
    );
    setUploading(false);
    onRefresh();
  };

  const handleParse = async (f: OrderFile) => {
    setParsing((p) => ({ ...p, [f.id]: true }));
    const res = await apiFetch(
      `${ORDER_URL}?action=parse_file`,
      { method: "POST", body: JSON.stringify({ order_id: order.id, file_url: f.file_url, file_id: f.id }) },
      token
    );
    setParsing((p) => ({ ...p, [f.id]: false }));
    if (res.items) setParseResults((p) => ({ ...p, [f.id]: res.items.length }));
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="rounded-2xl p-5" style={CARD_S}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={LBL_S}>Загрузить файл</p>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs" style={LBL_S}>Тип файла:</label>
          <select
            className="px-3 py-1.5 rounded-lg text-xs text-white outline-none"
            style={INP_S} value={fileType}
            onChange={(e) => setFileType(e.target.value)}
          >
            <option value="project">Проект</option>
            <option value="spec">Спецификация</option>
            <option value="dwg">DWG</option>
            <option value="bim">BIM</option>
            <option value="other">Прочее</option>
          </select>
        </div>
        <div
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 cursor-pointer transition-all hover:border-yellow-400/40"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f); }}
        >
          {uploading ? (
            <Icon name="Loader2" size={28} className="animate-spin" style={{ color: "#FBBF24" }} />
          ) : (
            <>
              <Icon name="Upload" size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
              <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>Перетащите файл или нажмите</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>PDF, XLSX, DWG, IFC</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>

      {/* Files list */}
      {files.length === 0 ? (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-2" style={CARD_S}>
          <Icon name="Folder" size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Файлы ещё не загружены</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={CARD_S}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                <Icon name="FileText" size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={f.file_url} target="_blank" rel="noreferrer"
                    className="text-sm font-medium text-white truncate hover:underline"
                  >
                    {f.file_name}
                  </a>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {FILE_TYPE_LABELS[f.file_type] || f.file_type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{relativeTime(f.created_at)}</span>
                  {f.parse_status && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: `${PARSE_STATUS_COLORS[f.parse_status]}18`, color: PARSE_STATUS_COLORS[f.parse_status] }}
                    >
                      {PARSE_STATUS_LABELS[f.parse_status] || f.parse_status}
                    </span>
                  )}
                  {parseResults[f.id] !== undefined && (
                    <span className="text-xs" style={{ color: "#00FF88" }}>
                      Извлечено позиций: {parseResults[f.id]}
                    </span>
                  )}
                </div>
              </div>
              {(f.file_type === "spec" || f.file_type === "project") && (
                <button
                  onClick={() => handleParse(f)}
                  disabled={parsing[f.id] || f.parse_status === "done"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 flex-shrink-0"
                  style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)" }}
                >
                  {parsing[f.id] ? (
                    <Icon name="Loader2" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="Cpu" size={12} />
                  )}
                  {f.parse_status === "done" ? "Распознан" : "Распознать"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VOR Tab ──────────────────────────────────────────────────────────────────

function VorTab({ order, token }: { order: Order; token: string }) {
  const [specs, setSpecs] = useState<OrderSpec[]>(order.specs || []);
  const [procMsg, setProcMsg] = useState("");
  const [procLoading, setProcLoading] = useState(false);

  useEffect(() => {
    apiFetch(`${ORDER_URL}?action=specs&order_id=${order.id}`, {}, token).then((r) =>
      setSpecs(r.specs || [])
    );
  }, [order.id, token]);

  const latest = specs.length > 0 ? specs[specs.length - 1] : null;
  const items: SpecItem[] = latest?.items || [];

  const sections = Array.from(new Set(items.map((i) => i.section))).filter(Boolean);

  const grandTotal = items.reduce((s, i) => s + (i.qty || 0) * (i.price_per_unit || 0), 0);

  const toProcurement = async () => {
    setProcLoading(true);
    const res = await apiFetch(`${ORDER_URL}?action=create_procurement`, { method: "POST", body: JSON.stringify({ order_id: order.id }) }, token);
    setProcLoading(false);
    setProcMsg(res.error ? `Ошибка: ${res.error}` : `Список материалов передан в снабжение (${res.items?.length || 0} позиций)`);
    setTimeout(() => setProcMsg(""), 5000);
  };

  if (!latest) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CARD_S}>
        <Icon name="ClipboardList" size={36} style={{ color: "rgba(255,255,255,0.1)" }} />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>ВОР не сформирована</p>
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
          Загрузите спецификацию в формате PDF или XLSX на вкладку «Файлы проекта» и нажмите «Распознать»
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl p-4 flex items-center justify-between" style={CARD_S}>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs" style={LBL_S}>Позиций</p>
            <p className="text-xl font-bold text-white">{items.length}</p>
          </div>
          <div>
            <p className="text-xs" style={LBL_S}>Итого</p>
            <p className="text-xl font-bold" style={{ color: "#FBBF24" }}>{fmt(grandTotal)} ₽</p>
          </div>
          <div>
            <p className="text-xs" style={LBL_S}>Разделов</p>
            <p className="text-xl font-bold text-white">{sections.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {procMsg && (
            <span className="text-xs" style={{ color: procMsg.startsWith("Ошибка") ? "#ef4444" : "#00FF88" }}>
              {procMsg}
            </span>
          )}
          <button
            onClick={toProcurement} disabled={procLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88", border: "1px solid rgba(0,255,136,0.2)" }}
          >
            {procLoading ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Package" size={15} />}
            Передать в снабжение
          </button>
        </div>
      </div>

      {/* Table by sections */}
      {sections.length > 0 ? sections.map((sec) => {
        const secItems = items.filter((i) => i.section === sec);
        const secTotal = secItems.reduce((s, i) => s + (i.qty || 0) * (i.price_per_unit || 0), 0);
        return (
          <div key={sec} className="rounded-2xl overflow-hidden" style={CARD_S}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--card-border)" }}>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#FBBF24" }}>{sec}</span>
              <span className="text-xs font-medium text-white">{fmt(secTotal)} ₽</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <th className="text-left px-4 py-2 text-xs font-medium" style={LBL_S}>Наименование</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={LBL_S}>Ед.</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={LBL_S}>Кол-во</th>
                    <th className="text-right px-3 py-2 text-xs font-medium" style={LBL_S}>Цена</th>
                    <th className="text-right px-4 py-2 text-xs font-medium" style={LBL_S}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {secItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td className="px-4 py-2.5 text-white text-xs">{item.name}</td>
                      <td className="px-3 py-2.5 text-right text-xs" style={LBL_S}>{item.unit}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-white">{item.qty}</td>
                      <td className="px-3 py-2.5 text-right text-xs" style={LBL_S}>
                        {item.price_per_unit > 0 ? `${fmt(item.price_per_unit)} ₽` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-medium text-white">
                        {item.price_per_unit > 0 ? `${fmt((item.qty || 0) * item.price_per_unit)} ₽` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }) : (
        <div className="space-y-0 rounded-2xl overflow-hidden" style={CARD_S}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <th className="text-left px-4 py-2 text-xs font-medium" style={LBL_S}>Раздел</th>
                <th className="text-left px-4 py-2 text-xs font-medium" style={LBL_S}>Наименование</th>
                <th className="text-right px-3 py-2 text-xs font-medium" style={LBL_S}>Ед.</th>
                <th className="text-right px-3 py-2 text-xs font-medium" style={LBL_S}>Кол-во</th>
                <th className="text-right px-4 py-2 text-xs font-medium" style={LBL_S}>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td className="px-4 py-2.5 text-xs" style={LBL_S}>{item.section || "—"}</td>
                  <td className="px-4 py-2.5 text-white text-xs">{item.name}</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={LBL_S}>{item.unit}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-white">{item.qty}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-white">
                    {item.price_per_unit > 0 ? `${fmt((item.qty || 0) * item.price_per_unit)} ₽` : "—"}
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

// ─── Proposal Tab ─────────────────────────────────────────────────────────────

function ProposalTab({
  orderId, proposals, setProposals, token,
}: {
  orderId: number;
  proposals: Proposal[];
  setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
  token: string;
}) {
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const createProposal = async () => {
    setCreating(true);
    const res = await apiFetch(`${ORDER_URL}?action=create_proposal`, { method: "POST", body: JSON.stringify({ order_id: orderId }) }, token);
    setCreating(false);
    if (res.error) { setMsg(`Ошибка: ${res.error}`); return; }
    setMsg(`КП ${res.number} создано — ${fmt(res.total_amount || 0)} ₽`);
    setProposals((p) => [{ id: res.id, number: res.number, status: "draft", total_amount: res.total_amount || 0, created_at: new Date().toISOString() }, ...p]);
    setTimeout(() => setMsg(""), 5000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={LBL_S}>Коммерческие предложения</p>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs" style={{ color: msg.startsWith("Ошибка") ? "#ef4444" : "#00FF88" }}>{msg}</span>}
          <button
            onClick={createProposal} disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#FBBF24", color: "#0a0d14" }}
          >
            {creating ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
            Создать КП
          </button>
        </div>
      </div>
      {proposals.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CARD_S}>
          <Icon name="FileText" size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>КП ещё не созданы</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <div key={p.id} className="rounded-2xl px-4 py-3 flex items-center gap-4" style={CARD_S}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(251,191,36,0.1)" }}>
                <Icon name="FileText" size={16} style={{ color: "#FBBF24" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{p.number}</span>
                  <span
                    className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: `${PROPOSAL_STATUS_COLORS[p.status] || "#888"}20`, color: PROPOSAL_STATUS_COLORS[p.status] || "#888" }}
                  >
                    {PROPOSAL_STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={LBL_S}>{relativeTime(p.created_at)}</p>
              </div>
              <span className="text-sm font-semibold" style={{ color: "#FBBF24" }}>{fmt(p.total_amount)} ₽</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Contract Tab ─────────────────────────────────────────────────────────────

function ContractTab({
  orderId, orderCompanyId, contracts, setContracts, templates, token,
}: {
  orderId: number;
  orderCompanyId?: number;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  templates: ContractTemplate[];
  token: string;
}) {
  const [creating, setCreating] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<string>("");
  const [selectedCompany, setSelectedCompany] = useState<string>(orderCompanyId ? String(orderCompanyId) : "");
  const [companies, setCompanies] = useState<{ id: number; company_name: string; is_default: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${COMPANY_URL}?action=companies`)
      .then((r) => r.json())
      .then((r) => {
        const list = r.companies || [];
        setCompanies(list);
        if (!selectedCompany) {
          const def = list.find((c: { is_default: boolean }) => c.is_default);
          if (def) setSelectedCompany(String(def.id));
        }
      });
  }, []);

  const createContract = async () => {
    setCreating(true);
    const body: Record<string, unknown> = { order_id: orderId };
    if (selectedTpl) body.template_id = parseInt(selectedTpl);
    if (selectedCompany) body.company_id = parseInt(selectedCompany);
    const res = await apiFetch(`${ORDER_URL}?action=create_contract`, { method: "POST", body: JSON.stringify(body) }, token);
    setCreating(false);
    if (res.error) { setMsg(`Ошибка: ${res.error}`); return; }
    setMsg(`Договор ${res.number} создан`);
    setContracts((p) => [{ id: res.id, number: res.number, status: "draft", created_at: new Date().toISOString() }, ...p]);
    setTimeout(() => setMsg(""), 4000);
  };

  const approve = async (id: number) => {
    setApprovingId(id);
    await apiFetch(`${ORDER_URL}?action=approve_contract`, { method: "POST", body: JSON.stringify({ contract_id: id }) }, token);
    setContracts((p) => p.map((c) => c.id === id ? { ...c, status: "approved" } : c));
    setApprovingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={LBL_S}>Договоры</p>
        <div className="flex items-center gap-3 flex-wrap">
          {msg && <span className="text-xs" style={{ color: msg.startsWith("Ошибка") ? "#ef4444" : "#00FF88" }}>{msg}</span>}
          {companies.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Icon name="Building2" size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
              <select
                className="px-3 py-2 rounded-xl text-xs text-white outline-none"
                style={INP_S} value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="">Организация не выбрана</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}{c.is_default ? " (основная)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {templates.length > 0 && (
            <select
              className="px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={INP_S} value={selectedTpl}
              onChange={(e) => setSelectedTpl(e.target.value)}
            >
              <option value="">Без шаблона</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={createContract} disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#FBBF24", color: "#0a0d14" }}
          >
            {creating ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
            Создать договор
          </button>
        </div>
      </div>
      {contracts.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3" style={CARD_S}>
          <Icon name="ScrollText" size={32} style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Договоров ещё нет</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div key={c.id} className="rounded-2xl px-4 py-3 flex items-center gap-4" style={CARD_S}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,212,255,0.08)" }}>
                <Icon name="ScrollText" size={16} style={{ color: "#00D4FF" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{c.number}</span>
                  <span
                    className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ background: `${CONTRACT_STATUS_COLORS[c.status] || "#888"}20`, color: CONTRACT_STATUS_COLORS[c.status] || "#888" }}
                  >
                    {CONTRACT_STATUS_LABELS[c.status] || c.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={LBL_S}>{relativeTime(c.created_at)}</p>
              </div>
              {c.status !== "approved" && c.status !== "signed" && (
                <button
                  onClick={() => approve(c.id)}
                  disabled={approvingId === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(0,255,136,0.1)", color: "#00FF88", border: "1px solid rgba(0,255,136,0.2)" }}
                >
                  {approvingId === c.id ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                  Согласовать
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Supply Tab ───────────────────────────────────────────────────────────────

const RFQ_STATUS_LABELS: Record<string, string> = {
  open: "Открыт", awarded: "Выбран поставщик", closed: "Закрыт",
};
const RFQ_STATUS_COLORS: Record<string, string> = {
  open: "#FBBF24", awarded: "#00FF88", closed: "#6B7280",
};

function SupplyTab({ orderId, rfqs, address }: { orderId: number; rfqs: RfqBrief[]; address?: string }) {
  return (
    <div className="space-y-4">
      {/* Адрес объекта */}
      {address && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <Icon name="MapPin" size={16} style={{ color: "#FBBF24", flexShrink: 0 }} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Адрес объекта</p>
            <p className="text-sm text-white">{address}</p>
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
          Запросы коммерческих предложений
        </p>
        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
          {rfqs.length} запр.
        </span>
      </div>

      {rfqs.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 flex flex-col items-center gap-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <Icon name="Truck" size={28} style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>По этому заказу ещё нет запросов КП</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Снабженец создаст запрос через свой кабинет, выбрав заказ №{orderId}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rfqs.map((rfq) => (
            <div key={rfq.id} className="rounded-2xl px-4 py-3.5" style={CARD_S}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{rfq.title}</span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                      style={{ background: `${RFQ_STATUS_COLORS[rfq.status] || "#888"}20`, color: RFQ_STATUS_COLORS[rfq.status] || "#888" }}>
                      {RFQ_STATUS_LABELS[rfq.status] || rfq.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    <Icon name="MapPin" size={11} />
                    <span className="text-xs">{rfq.construction_address}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Icon name="Users" size={12} style={{ color: "#00D4FF" }} />
                    <span className="text-sm font-bold" style={{ color: "#00D4FF" }}>{rfq.proposals_count}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>предл.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5">
                  <Icon name="Calendar" size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {rfq.deadline ? `Срок: ${new Date(rfq.deadline).toLocaleDateString("ru-RU")}` : "Срок не указан"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="Clock" size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{relativeTime(rfq.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ order, token, onRefresh }: { order: Order; token: string; onRefresh: () => void }) {
  const [form, setForm] = useState({ type: "note", direction: "out", content: "" });
  const [saving, setSaving] = useState(false);
  const events = order.events || [];

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSaving(true);
    await apiFetch(
      `${ORDER_URL}?action=add_event`,
      { method: "POST", body: JSON.stringify({ order_id: order.id, ...form }) },
      token
    );
    setSaving(false);
    setForm((p) => ({ ...p, content: "" }));
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Add event form */}
      <div className="rounded-2xl p-4" style={CARD_S}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={LBL_S}>Добавить запись</p>
        <form onSubmit={addEvent} className="space-y-3">
          <div className="flex gap-3">
            <select
              className="px-3 py-2 rounded-xl text-xs text-white outline-none flex-1"
              style={INP_S} value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="note">Заметка</option>
              <option value="call">Звонок</option>
              <option value="message">Сообщение</option>
              <option value="meeting">Встреча</option>
            </select>
            {(form.type === "call" || form.type === "message") && (
              <select
                className="px-3 py-2 rounded-xl text-xs text-white outline-none"
                style={INP_S} value={form.direction}
                onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))}
              >
                <option value="in">Входящий</option>
                <option value="out">Исходящий</option>
              </select>
            )}
          </div>
          <textarea
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all resize-none"
            style={INP_S} rows={3} value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            onFocus={focusOn} onBlur={blurOn}
            placeholder="Текст заметки или итог звонка..."
          />
          <div className="flex justify-end">
            <button
              type="submit" disabled={saving || !form.content.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#FBBF24", color: "#0a0d14" }}
            >
              {saving ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
              Добавить
            </button>
          </div>
        </form>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-2" style={CARD_S}>
          <Icon name="Clock" size={28} style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>История событий пуста</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...events].reverse().map((ev) => (
            <div key={ev.id} className="rounded-2xl px-4 py-3 flex gap-3" style={CARD_S}>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <Icon name={EVENT_TYPE_ICONS[ev.type] || "Circle"} size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {EVENT_TYPE_LABELS[ev.type] || ev.type}
                  </span>
                  {ev.direction && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                      {ev.direction === "in" ? "Входящий" : "Исходящий"}
                    </span>
                  )}
                  {ev.author && (
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>· {ev.author}</span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {relativeTime(ev.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-1 text-white leading-relaxed">{ev.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main SalesManager ────────────────────────────────────────────────────────

export default function SalesManager({ user, token }: SalesManagerProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);

  const loadOrders = useCallback(() => {
    setLoading(true);
    apiFetch(`${ORDER_URL}?action=list`, {}, token).then((r) => {
      setOrders(r.orders || []);
      setLoading(false);
    });
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openOrder = (id: number) => {
    setSelectedId(id);
    setView("detail");
  };

  const filteredOrders =
    stageFilter === "all" ? orders : orders.filter((o) => o.stage === stageFilter);

  const STAGES = [
    { id: "all", label: "Все" },
    { id: "lead", label: "Лид" },
    { id: "qualified", label: "Квалифицирован" },
    { id: "proposal", label: "КП" },
    { id: "negotiation", label: "Переговоры" },
    { id: "contract", label: "Договор" },
    { id: "won", label: "Выигран" },
    { id: "lost", label: "Проигран" },
  ];

  if (view === "detail" && selectedId !== null) {
    return (
      <OrderDetail
        orderId={selectedId}
        token={token}
        onBack={() => { setView("list"); loadOrders(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">CRM продаж</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Воронка заказов и работа с клиентами
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "#FBBF24", color: "#0a0d14" }}
        >
          <Icon name="Plus" size={16} />
          Новый заказ
        </button>
      </div>

      {/* Stats */}
      <StatsBar orders={orders} />

      {/* Stage filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STAGES.map((s) => {
          const count = s.id === "all" ? orders.length : orders.filter((o) => o.stage === s.id).length;
          const active = stageFilter === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setStageFilter(s.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: active ? `${STAGE_COLORS[s.id] || "#FBBF24"}22` : "rgba(255,255,255,0.04)",
                color: active ? STAGE_COLORS[s.id] || "#FBBF24" : "rgba(255,255,255,0.5)",
                border: active ? `1px solid ${STAGE_COLORS[s.id] || "#FBBF24"}44` : "1px solid transparent",
              }}
            >
              {s.label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-xs"
                  style={{
                    background: active ? `${STAGE_COLORS[s.id] || "#FBBF24"}30` : "rgba(255,255,255,0.08)",
                    color: active ? STAGE_COLORS[s.id] || "#FBBF24" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={32} className="animate-spin" style={{ color: "#FBBF24" }} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-3" style={CARD_S}>
          <Icon name="Inbox" size={40} style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {stageFilter === "all" ? "Заказов пока нет" : `Нет заказов на стадии «${STAGE_LABELS[stageFilter]}»`}
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="mt-2 text-sm font-medium"
            style={{ color: "#FBBF24" }}
          >
            + Создать первый заказ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((o) => (
            <OrderCard key={o.id} order={o} onClick={() => openOrder(o.id)} />
          ))}
        </div>
      )}

      {/* New Order Modal */}
      {showNewModal && (
        <NewOrderModal
          token={token}
          onCreated={(id) => {
            setShowNewModal(false);
            loadOrders();
            openOrder(id);
          }}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}