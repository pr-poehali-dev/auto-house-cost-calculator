import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import MaterialsDB from "./MaterialsDB";
import { SUPPLIER_API, SUPPLY_OPS, MATERIALS_URL, StaffUser, Material, authFetch } from "./staff-types";
import { fmt as _fmt } from "./supply/supply-types";
import type { RFQRow, SupplierRow, InvoiceRow } from "./supply/supply-types";
import RfqTab from "./supply/RfqTab";
import SuppliersTab from "./supply/SuppliersTab";
import InvoicesTab from "./supply/InvoicesTab";

export default function SupplyCabinet({ user, token }: { user: StaffUser; token: string }) {
  const [tab, setTab] = useState<"rfqs"|"suppliers"|"prices"|"invoices">("rfqs");
  const [rfqs, setRfqs] = useState<RFQRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const supFetch = useCallback((url: string, opts: RequestInit = {}) =>
    fetch(url, { ...opts, headers: { "Content-Type": "application/json", "X-Auth-Token": token, ...(opts.headers||{}) } }).then(r => r.json()), [token]);

  const loadRfqs = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLIER_API}?action=rfq_list`);
    setRfqs(res.rfqs || []); setLoading(false);
  }, [supFetch]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLIER_API}?action=suppliers_list`);
    setSuppliers(res.suppliers || []); setLoading(false);
  }, [supFetch]);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    const res = await authFetch(MATERIALS_URL, {}, token);
    setMaterials(res.items || []); setLoading(false);
  }, [token]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const res = await supFetch(`${SUPPLY_OPS}?action=invoices_list`);
    setInvoices(res.invoices || []); setLoading(false);
  }, [supFetch]);

  useEffect(() => {
    if (tab === "rfqs") loadRfqs();
    else if (tab === "suppliers") loadSuppliers();
    else if (tab === "prices") loadMaterials();
    else if (tab === "invoices") loadInvoices();
  }, [tab, loadRfqs, loadSuppliers, loadMaterials, loadInvoices]);

  const verifySupplier = async (id: number, verified: boolean) => {
    await supFetch(`${SUPPLIER_API}?action=verify_supplier`, { method: "POST", body: JSON.stringify({ supplier_id: id, is_verified: verified }) });
    loadSuppliers();
  };

  const TABS = [
    { id: "rfqs", label: "Запросы КП", icon: "FileText" },
    { id: "suppliers", label: "Поставщики", icon: "Building2" },
    { id: "prices", label: "Цены", icon: "Tag" },
    { id: "invoices", label: "Счета", icon: "Receipt" },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#FBBF24" }}>Снабженец</div>
          <h2 className="font-display text-2xl font-bold text-white">Снабжение и закупки</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Добро пожаловать, {user.full_name}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.05)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t.id ? "#FBBF24" : "transparent", color: tab === t.id ? "#000" : "rgba(255,255,255,0.5)" }}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "rfqs" && <RfqTab token={token} materials={materials} rfqs={rfqs} loading={loading} onReload={loadRfqs} />}
      {tab === "suppliers" && <SuppliersTab suppliers={suppliers} loading={loading} onVerify={verifySupplier} />}
      {tab === "prices" && <MaterialsDB user={user} token={token} />}
      {tab === "invoices" && <InvoicesTab invoices={invoices} loading={loading} />}
    </div>
  );
}
