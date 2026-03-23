import React from "react";

export const COMPANY_URL =
  "https://functions.poehali.dev/0796a927-18d1-46be-bd26-3bbcfe93738d";

export const INP =
  "w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-all";
export const INP_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};
export const LABEL_STYLE: React.CSSProperties = {
  color: "rgba(255,255,255,0.4)",
};

export const TPL_TYPE_LABELS: Record<string, string> = {
  construction: "Строительство",
  supply: "Поставка",
  service: "Услуги",
};
export const TPL_TYPE_COLORS: Record<string, string> = {
  construction: "#FBBF24",
  supply: "#00D4FF",
  service: "#00FF88",
};

export function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Auth-Token": token } : {}),
      ...(opts.headers || {}),
    },
  }).then((r) => r.json());
}

export function focusOrange(
  e: React.FocusEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) {
  e.target.style.borderColor = "#FBBF24";
}
export function blurOrange(
  e: React.FocusEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) {
  e.target.style.borderColor = "rgba(255,255,255,0.1)";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface Company {
  id: number;
  is_default: boolean;
  company_name: string;
  full_name?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legal_address?: string;
  actual_address?: string;
  phone?: string;
  email?: string;
  website?: string;
  director_name?: string;
  director_title?: string;
  bank_name?: string;
  bik?: string;
  account_number?: string;
  corr_account?: string;
  logo_url?: string;
  stamp_url?: string;
  signature_url?: string;
  company_map_url?: string;
  updated_at?: string;
}

export interface ContractTemplate {
  id: number;
  name: string;
  type: string;
  content_text?: string;
  file_name?: string;
  file_url?: string;
  created_at?: string;
}
