export const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";

export const FILE_TYPES = [
  { id: "render", label: "Рендер", icon: "🎨", accept: "image/*" },
  { id: "plan", label: "План", icon: "📐", accept: "image/*,application/pdf" },
  { id: "facade", label: "Фасад", icon: "🏛️", accept: "image/*,application/pdf" },
  { id: "section", label: "Разрез", icon: "✂️", accept: "image/*,application/pdf" },
  { id: "other", label: "Прочее", icon: "📎", accept: "*" },
];

export const DEFAULT_SECTIONS = [
  "Земляные работы", "Фундамент", "Стены и перекрытия", "Кровля",
  "Окна и двери", "Утепление и фасад", "Черновые полы", "Чистовые полы",
  "Отделка стен и потолков", "Электрика", "Сантехника",
];

export interface ProjectFile {
  id: number;
  file_type: string;
  file_url: string;
  file_name: string;
  sort_order: number;
}

export interface SpecItem {
  id: number;
  section: string;
  name: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  total_price: number;
  note: string;
  sort_order: number;
}

export interface Spec {
  id: number;
  title: string;
  version: number;
  status: string;
  items: SpecItem[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  type: string;
  area: number;
  floors: number;
  rooms: number;
  price: number;
  files?: ProjectFile[];
  specs?: { id: number; title: string; version: number; status: string }[];
}

export interface HistoryEntry {
  id: number;
  field: string;
  old: string;
  new: string;
  at: string;
  by: string;
  item: string;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function authFetch(url: string, opts: RequestInit = {}, token: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "X-Auth-Token": token, ...(opts.headers || {}) },
  }).then(r => r.json());
}
