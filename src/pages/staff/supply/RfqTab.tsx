import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { SUPPLIER_API, SUPPLY_OPS, PROJECTS_URL, type Material } from "../staff-types";
import type { RFQRow, ProposalRow } from "./supply-types";
import { fmt } from "./supply-types";

export default function RfqTab({ token, materials, rfqs, loading, onReload }: {
  token: string;
  materials: Material[];
  rfqs: RFQRow[];
  loading: boolean;
  onReload: () => void;
}) {
  const [selectedRfq, setSelectedRfq] = useState<(RFQRow & { proposals?: ProposalRow[] }) | null>(null);
  const [showRfqForm, setShowRfqForm] = useState(false);
  const [rfqForm, setRfqForm] = useState({ title: "", construction_address: "", area: 100, floors: 2, house_type: "Кирпичный", deadline: "", customer_name: "", customer_phone: "", source_type: "manual" as "project"|"order"|"manual", source_project_id: null as number|null, order_id: null as number|null, items: [] as {name:string;unit:string;qty:number}[] });
  const [rfqSource, setRfqSource] = useState<"project"|"order"|"manual">("manual");
  const [publicProjects, setPublicProjects] = useState<{id:number;name:string;type:string;area:number;floors:number}[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [ordersList, setOrdersList] = useState<{id:number;number:string;client_name:string;address:string;status:string;stage:string}[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState("");
  const [generatingInv, setGeneratingInv] = useState<number | null>(null);
  const [invMsg, setInvMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const supFetch = useCallback((url: string, opts: RequestInit = {}) =>
    fetch(url, { ...opts, headers: { "Content-Type": "application/json", "X-Auth-Token": token, ...(opts.headers||{}) } }).then(r => r.json()), [token]);

  const openRfq = async (rfq: RFQRow) => {
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_get`, { method: "POST", body: JSON.stringify({ rfq_id: rfq.id }) });
    setSelectedRfq(res.rfq || null);
  };

  const loadPublicProjects = useCallback(async () => {
    setLoadingProjects(true);
    const res = await fetch(`${PROJECTS_URL}?action=public_list`).then(r => r.json());
    setPublicProjects((res.projects || []).map((p: Record<string,unknown>) => ({ id: p.id, name: p.name, type: p.type, area: p.area, floors: p.floors })));
    setLoadingProjects(false);
  }, []);

  const loadOrdersList = useCallback(async () => {
    setLoadingOrders(true);
    const res = await supFetch(`${SUPPLIER_API}?action=orders_list`);
    setOrdersList(res.orders || []);
    setLoadingOrders(false);
  }, [supFetch]);

  const applyProject = (p: {id:number;name:string;type:string;area:number;floors:number}) => {
    setRfqForm(prev => ({ ...prev, title: p.name, area: p.area, floors: p.floors, house_type: p.type, source_project_id: p.id, source_type: "project" }));
  };

  const applyOrder = (o: {id:number;number:string;client_name:string;address:string}) => {
    setRfqForm(prev => ({ ...prev, order_id: o.id, construction_address: o.address, customer_name: o.client_name, source_type: "order", title: prev.title || `Заказ №${o.number}` }));
  };

  const createRfq = async () => {
    setSaving(true);
    const items = (materials || []).slice(0, 20).map(m => ({ name: m.name, unit: m.unit, qty: rfqForm.area }));
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_create`, { method: "POST", body: JSON.stringify({ ...rfqForm, items }) });
    setSaving(false);
    if (res.ok) { setShowRfqForm(false); setRfqSource("manual"); onReload(); }
  };

  const notifySuppliers = async (rfq_id: number) => {
    setNotifyStatus("Рассылка...");
    const res = await supFetch(`${SUPPLIER_API}?action=notify`, { method: "POST", body: JSON.stringify({ rfq_id, channels: ["email","sms"] }) });
    setNotifyStatus(res.ok ? `Отправлено email: ${res.results?.sent_email}, SMS: ${res.results?.sent_sms}` : res.error || "Ошибка");
  };

  const awardProposal = async (rfq_id: number, proposal_id: number) => {
    await supFetch(`${SUPPLIER_API}?action=rfq_award`, { method: "POST", body: JSON.stringify({ rfq_id, proposal_id }) });
    openRfq(selectedRfq!);
  };

  const generateInvoice = async (proposal_id: number) => {
    setGeneratingInv(proposal_id); setInvMsg("");
    const res = await supFetch(`${SUPPLY_OPS}?action=generate_invoice`, { method: "POST", body: JSON.stringify({ proposal_id }) });
    setGeneratingInv(null);
    if (res.ok) {
      setInvMsg(`Счёт ${res.invoice_number} создан`);
      if (res.pdf_base64) {
        const link = document.createElement("a");
        link.href = "data:application/pdf;base64," + res.pdf_base64;
        link.download = `${res.invoice_number}.pdf`;
        link.click();
      }
    } else setInvMsg(res.error || "Ошибка генерации");
  };

  return (
    <div>
      {selectedRfq ? (
        <div className="animate-fade-in">
          <button onClick={() => setSelectedRfq(null)} className="flex items-center gap-2 mb-4 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon name="ChevronLeft" size={15} /> К списку
          </button>
          <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <div className="font-display font-bold text-xl text-white">{selectedRfq.title}</div>
              {selectedRfq.source_type === "project" && (
                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)" }}>
                  <Icon name="FolderOpen" size={10} /> Из проекта
                </span>
              )}
              {selectedRfq.source_type === "order" && (
                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
                  <Icon name="UserCheck" size={10} /> Заказ клиента
                </span>
              )}
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>📍 {selectedRfq.construction_address} · {selectedRfq.area} м² · {selectedRfq.floors} эт.</div>
            {selectedRfq.source_type === "order" && selectedRfq.customer_name && (
              <div className="mt-2 flex items-center gap-3 text-sm px-3 py-2 rounded-xl"
                style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)" }}>
                <Icon name="User" size={14} style={{ color: "var(--neon-cyan)" }} />
                <span style={{ color: "rgba(255,255,255,0.8)" }}>{selectedRfq.customer_name}</span>
                {selectedRfq.customer_phone && (
                  <a href={`tel:${selectedRfq.customer_phone}`} className="flex items-center gap-1 hover:underline"
                    style={{ color: "var(--neon-cyan)" }}>
                    <Icon name="Phone" size={12} /> {selectedRfq.customer_phone}
                  </a>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => notifySuppliers(selectedRfq.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "#FBBF24", color: "#000" }}>
                <Icon name="Send" size={14} /> Разослать уведомления
              </button>
              {notifyStatus && <span className="text-xs self-center" style={{ color: "rgba(255,255,255,0.5)" }}>{notifyStatus}</span>}
            </div>
          </div>
          {invMsg && <div className="mb-4 px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(0,255,136,0.1)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.2)" }}>{invMsg}</div>}
          <h3 className="font-display font-semibold text-lg text-white mb-3">
            Предложения поставщиков — отсортированы по цене
          </h3>
          {(!selectedRfq.proposals || selectedRfq.proposals.length === 0) ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
              <div className="text-4xl mb-2">⏳</div>
              <div className="text-white">Предложений пока нет</div>
              <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Разошлите уведомления поставщикам</div>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedRfq.proposals.map((p, i) => (
                <div key={p.id} className="rounded-2xl p-5"
                  style={{
                    background: i === 0 ? "rgba(251,191,36,0.08)" : "var(--card-bg)",
                    border: i === 0 ? "1px solid rgba(251,191,36,0.4)" : "1px solid var(--card-border)",
                  }}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      {i === 0 && <div className="text-xs font-semibold mb-1" style={{ color: "#FBBF24" }}>🏆 Лучшая цена</div>}
                      <div className="font-display font-bold text-lg text-white">{p.company_name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>📞 {p.phone} · ✉️ {p.email}</div>
                      {p.comment && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>💬 {p.comment}</div>}
                      {p.delivery_days && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>🚚 Срок поставки: {p.delivery_days} дн.</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-display font-black text-2xl" style={{ color: i === 0 ? "#FBBF24" : "rgba(255,255,255,0.7)" }}>
                        {fmt(p.total_amount)} ₽
                      </div>
                      <div className="flex gap-2 mt-2 justify-end flex-wrap">
                        {p.status !== "winner" && selectedRfq.status !== "awarded" && (
                          <button onClick={() => awardProposal(selectedRfq.id, p.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            style={{ background: "#FBBF24", color: "#000" }}>
                            Выбрать победителя
                          </button>
                        )}
                        {p.status === "winner" && (
                          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)" }}>✓ Победитель</span>
                        )}
                        <button onClick={() => generateInvoice(p.id)} disabled={generatingInv === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                          style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.2)" }}>
                          {generatingInv === p.id ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="FileDown" size={12} />}
                          Создать счёт
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{rfqs.length} запросов</span>
            <button onClick={() => setShowRfqForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "#FBBF24", color: "#000" }}>
              <Icon name="Plus" size={14} /> Новый запрос КП
            </button>
          </div>
          {showRfqForm && (
            <div className="rounded-2xl p-6 mb-5 animate-scale-in" style={{ background: "var(--card-bg)", border: "1px solid rgba(251,191,36,0.3)" }}>
              <h3 className="font-display font-semibold text-lg text-white mb-4">Создать запрос КП</h3>

              {/* Источник RFQ */}
              <div className="mb-5">
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Источник запроса</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "project", label: "Из проекта", icon: "FolderOpen", desc: "Каталог архитекторов" },
                    { id: "order",   label: "Заказ клиента", icon: "UserCheck", desc: "По заявке заказчика" },
                    { id: "manual",  label: "Вручную",    icon: "PenLine",    desc: "Произвольный запрос" },
                  ] as const).map(s => (
                    <button key={s.id} type="button"
                      onClick={() => {
                        setRfqSource(s.id);
                        setRfqForm(p => ({ ...p, source_type: s.id, order_id: null }));
                        if (s.id === "project" && publicProjects.length === 0) loadPublicProjects();
                        if (s.id === "order" && ordersList.length === 0) loadOrdersList();
                      }}
                      className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all"
                      style={{
                        background: rfqSource === s.id ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                        border: rfqSource === s.id ? "1px solid #FBBF24" : "1px solid rgba(255,255,255,0.08)",
                        color: rfqSource === s.id ? "#FBBF24" : "rgba(255,255,255,0.5)",
                      }}>
                      <Icon name={s.icon} size={18} />
                      <span className="text-xs font-semibold">{s.label}</span>
                      <span className="text-xs opacity-60">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Выбор проекта из каталога */}
              {rfqSource === "project" && (
                <div className="mb-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Выберите проект из каталога
                  </div>
                  {loadingProjects ? (
                    <div className="text-sm py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка проектов...</div>
                  ) : publicProjects.length === 0 ? (
                    <div className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Нет опубликованных проектов</div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {publicProjects.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => applyProject(p)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                          style={{
                            background: rfqForm.source_project_id === p.id ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                            border: rfqForm.source_project_id === p.id ? "1px solid #FBBF24" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div>
                            <div className="text-sm font-semibold text-white">{p.name}</div>
                            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{p.type} · {p.area} м² · {p.floors} эт.</div>
                          </div>
                          {rfqForm.source_project_id === p.id && <Icon name="CheckCircle2" size={16} style={{ color: "#FBBF24", flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Выбор заказа клиента */}
              {rfqSource === "order" && (
                <div className="mb-5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Выберите заказ</div>
                  {loadingOrders ? (
                    <div className="text-sm py-4 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка заказов...</div>
                  ) : ordersList.length === 0 ? (
                    <div className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Нет заказов с адресом объекта</div>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {ordersList.map(o => (
                        <button key={o.id} type="button"
                          onClick={() => applyOrder(o)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                          style={{
                            background: rfqForm.order_id === o.id ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                            border: rfqForm.order_id === o.id ? "1px solid #FBBF24" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div>
                            <div className="text-sm font-semibold text-white">№{o.number} — {o.client_name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                              <Icon name="MapPin" size={11} />
                              <span className="text-xs">{o.address}</span>
                            </div>
                          </div>
                          {rfqForm.order_id === o.id && <Icon name="CheckCircle2" size={16} style={{ color: "#FBBF24", flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                  {rfqForm.order_id && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                      <Icon name="MapPin" size={13} style={{ color: "#FBBF24" }} />
                      <span className="text-xs text-white">Адрес подтянут из заказа и заблокирован для изменений</span>
                    </div>
                  )}
                </div>
              )}

              {/* Основные поля объекта */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {[
                  { label:"Название объекта", key:"title", placeholder:"Жилой дом, ул. Ленина 12" },
                  { label:"Адрес строительства", key:"construction_address", placeholder:"г. Москва, ул. Ленина, 12" },
                  { label:"Срок подачи КП", key:"deadline", type:"date" },
                ].map(f => {
                  const isAddressLocked = f.key === "construction_address" && !!rfqForm.order_id;
                  return (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {f.label}{isAddressLocked && <span className="ml-1.5 normal-case tracking-normal font-normal" style={{ color: "#FBBF24" }}>из заказа</span>}
                    </label>
                    <input type={f.type||"text"} value={(rfqForm as Record<string,unknown>)[f.key] as string} placeholder={f.placeholder}
                      readOnly={isAddressLocked}
                      onChange={e => !isAddressLocked && setRfqForm(p => ({...p,[f.key]:e.target.value}))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: isAddressLocked ? "rgba(251,191,36,0.07)" : "rgba(255,255,255,0.06)", border: isAddressLocked ? "1px solid rgba(251,191,36,0.3)" : "1px solid rgba(255,255,255,0.1)", cursor: isAddressLocked ? "default" : "text" }} />
                  </div>
                  );
                })}
                {[{label:"Площадь (м²)",key:"area"},{label:"Этажей",key:"floors"}].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</label>
                    <input type="number" value={(rfqForm as Record<string,unknown>)[f.key] as number}
                      onChange={e => setRfqForm(p => ({...p,[f.key]:+e.target.value}))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                ))}
              </div>

              {rfqForm.source_project_id && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24" }}>
                  <Icon name="Link2" size={13} />
                  Привязан к проекту: <strong>{publicProjects.find(p=>p.id===rfqForm.source_project_id)?.name}</strong>
                </div>
              )}

              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                Список материалов из сметы будет добавлен автоматически
              </p>
              <div className="flex gap-3">
                <button onClick={createRfq} disabled={saving}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: "#FBBF24", color: "#000" }}>
                  {saving ? "Создание..." : "Создать и разослать"}
                </button>
                <button onClick={() => { setShowRfqForm(false); setRfqSource("manual"); }}
                  className="px-6 py-2.5 rounded-xl text-sm"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                  Отмена
                </button>
              </div>
            </div>
          )}
          {loading ? <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div> : (
            <div className="space-y-3">
              {rfqs.map((rfq, i) => (
                <div key={rfq.id} className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.005]"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${i*0.04}s both` }}
                  onClick={() => openRfq(rfq)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className="font-display font-bold text-lg text-white">{rfq.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: rfq.status==="open"?"rgba(0,255,136,0.15)":rfq.status==="awarded"?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.07)", color: rfq.status==="open"?"var(--neon-green)":rfq.status==="awarded"?"#FBBF24":"rgba(255,255,255,0.4)" }}>
                          {rfq.status==="open"?"Открыт":rfq.status==="awarded"?"Завершён":"Закрыт"}
                        </span>
                        {rfq.source_type === "project" && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)" }}>
                            <Icon name="FolderOpen" size={10} /> Из проекта
                          </span>
                        )}
                        {rfq.source_type === "order" && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{ background: "rgba(0,212,255,0.12)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.25)" }}>
                            <Icon name="UserCheck" size={10} /> Заказ клиента
                          </span>
                        )}
                      </div>
                      <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>📍 {rfq.construction_address} · {rfq.area} м² · {rfq.floors} эт.</div>
                      {rfq.source_type === "order" && rfq.customer_name && (
                        <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          👤 {rfq.customer_name}{rfq.customer_phone ? ` · ${rfq.customer_phone}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <div className="font-display font-bold text-xl" style={{ color: "#FBBF24" }}>{rfq.proposals_count || 0}</div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>предложений</div>
                    </div>
                  </div>
                </div>
              ))}
              {rfqs.length === 0 && <div className="rounded-2xl p-12 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-5xl mb-2">📋</div><div className="text-white">Создайте первый запрос КП</div>
              </div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
