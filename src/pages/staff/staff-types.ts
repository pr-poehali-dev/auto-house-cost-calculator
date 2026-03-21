export const AUTH_URL = "https://functions.poehali.dev/b313eb2b-033b-49ed-a7e1-33dd33b4938b";
export const MATERIALS_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";
export const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";
export const SUPPLIER_API = "https://functions.poehali.dev/0864e1a5-8fce-4370-a525-80d6700b50ee";
export const SUPPLY_OPS = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";

export const TOKEN_KEY = "staff_token";

export interface StaffUser {
  id: number;
  login: string;
  full_name: string;
  role_code: string;
}

export interface Material {
  id: number;
  category: string;
  name: string;
  unit: string;
  price_per_unit: number;
  qty_formula: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface HouseProject {
  id: number;
  name: string;
  type: string;
  area: number;
  floors: number;
  rooms: number;
  price: number;
  tag: string;
  tag_color: string;
  description: string;
  features: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<string, string> = {
  architect: "Архитектор",
  constructor: "Конструктор",
  engineer: "Инженер",
  lawyer: "Юрист",
  supply: "Снабженец",
  manager: "Менеджер",
  build_manager: "Рук. строительства",
  admin: "Администратор",
  marketer: "Маркетолог",
};

export const ROLE_COLORS: Record<string, string> = {
  architect: "#00D4FF",
  constructor: "#FF6B1A",
  engineer: "#00FF88",
  lawyer: "#A855F7",
  supply: "#FBBF24",
  manager: "#F472B6",
  build_manager: "#FB923C",
  admin: "#E11D48",
  marketer: "#34D399",
};

export const ROLE_ICONS: Record<string, string> = {
  architect: "Pencil",
  constructor: "Wrench",
  engineer: "Settings",
  lawyer: "Scale",
  supply: "ShoppingCart",
  manager: "Phone",
  build_manager: "HardHat",
  admin: "ShieldCheck",
  marketer: "TrendingUp",
};

export const ROLES = [
  { code: "architect", label: "Архитектор" },
  { code: "constructor", label: "Конструктор" },
  { code: "engineer", label: "Инженер" },
  { code: "lawyer", label: "Юрист" },
  { code: "supply", label: "Снабженец" },
  { code: "manager", label: "Менеджер по продажам" },
  { code: "build_manager", label: "Руководитель строительства" },
  { code: "admin", label: "Администратор" },
  { code: "marketer", label: "Маркетолог" },
];

export function authFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...(opts.headers || {}),
    },
  }).then(r => r.json());
}