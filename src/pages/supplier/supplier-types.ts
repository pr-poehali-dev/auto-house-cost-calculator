export const API = "https://functions.poehali.dev/0864e1a5-8fce-4370-a525-80d6700b50ee";
export const OPS = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";
export const TOKEN_KEY = "supplier_token";

export const CATEGORIES = [
  { id: "materials", label: "Стройматериалы", icon: "🧱" },
  { id: "equipment", label: "Оборудование/техника", icon: "🏗️" },
  { id: "furniture", label: "Мебель и отделка", icon: "🪑" },
  { id: "labor", label: "Рабочая сила", icon: "👷" },
];

export interface SupplierUser { id: number; company_name: string; contact_name: string; email: string; phone: string; categories: string; region: string; is_verified: boolean; }
export interface RFQ { id: number; title: string; construction_address: string; area: number; floors: number; house_type: string; items: RFQItem[]; deadline: string | null; status: string; my_proposal?: Proposal; }
export interface RFQItem { name: string; unit: string; qty: number; category: string; }
export interface Proposal {
  id: number; rfq_id?: number; rfq_title?: string; address?: string; total_amount: number; delivery_days: number; status: string; submitted_at?: string; items?: ProposalItem[]; comment?: string;
  delivery_conditions?: string; delivery_city?: string; delivery_street?: string; delivery_building?: string;
  quality_gost?: string; quality_certificates?: string; quality_warranty_months?: number;
  acceptance_method?: string; acceptance_min_batch?: string; acceptance_packaging?: string;
  resources_warehouse?: string; resources_transport?: string; resources_managers?: number;
}
export interface ProposalItem { name: string; unit: string; qty: number; price_per_unit: number; total: number; }
export interface Invoice { id: number; invoice_number: string; amount: number; status: string; created_at: string; rfq_title: string; address: string; }
export interface PriceRow {
  id?: number;
  material_id?: number | null;
  material_name: string;
  unit: string;
  price_per_unit: number | string;
  category: string;
  article: string;
  note: string;
  valid_from?: string;
  is_new_material?: boolean;
  _key: number;
}
export interface PriceVersion {
  id: number;
  version_date: string;
  file_name: string;
  items_count: number;
  created_at: string;
}
export interface MatItem { id: number; category: string; name: string; unit: string; price_per_unit: number; best_price: number | null; }

export const UNITS = ["шт","м²","м³","м п.м.","кг","т","л","уп","компл","рул"];
export const CATS = ["Стройматериалы","Отделочные материалы","Кровля","Водосточные системы","Фасадные системы","Фундамент","Металлопрокат","Дерево и пиломатериалы","Утеплители","Инженерия","Электрика","Сантехника","Крепёж и метизы","Инструмент и расходники","Мебель и отделка","Прочее"];

export function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Supplier-Token": token } : {}), ...(opts.headers || {}) },
  }).then(r => r.json());
}

export function formatMoney(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽"; }
