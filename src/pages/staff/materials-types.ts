export const MAT_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";
export const AI_URL = "https://functions.poehali.dev/8ecbdbca-904c-4ffc-a3b2-3279170e95ee";

export function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }

export function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Auth-Token": token } : {}), ...(opts.headers || {}) },
  }).then(r => r.json());
}

export interface Material {
  id: number; item_type: string; category: string; name: string; unit: string;
  price_per_unit: number; qty_formula: string; article: string; description: string;
  best_price: number | null; best_price_updated_at: string | null;
  best_price_supplier: string | null;
  sort_order: number; is_active: boolean; updated_at: string;
  offers?: Offer[];
}

export interface Offer {
  id: number | string; supplier_id: number; company: string; region?: string;
  price: number; location: string; note: string; updated_at: string;
  source?: "offer" | "pricelist";
}

export interface AiItem {
  section: string; name: string; unit: string; qty: number; price_per_unit: number; note: string;
}

export interface StaffUser { id: number; full_name: string; role_code: string; }

export const TYPE_COLORS: Record<string, string> = { material: "var(--neon-cyan)", work: "var(--neon-orange)" };
export const TYPE_LABELS: Record<string, string> = { material: "Материал", work: "Работа" };
