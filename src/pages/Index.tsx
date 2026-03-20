import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import ChatWidget from "@/components/ChatWidget";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Data ────────────────────────────────────────────────────────────────────

const HOUSE_TYPES = [
  { id: "brick", label: "Кирпичный", icon: "🧱", multiplier: 1.4 },
  { id: "frame", label: "Каркасный", icon: "🏗️", multiplier: 0.85 },
  { id: "concrete", label: "Монолитный", icon: "🏢", multiplier: 1.6 },
  { id: "wood", label: "Деревянный", icon: "🪵", multiplier: 1.0 },
  { id: "aerated", label: "Газобетон", icon: "🟫", multiplier: 1.1 },
  { id: "modular", label: "Модульный", icon: "📦", multiplier: 0.75 },
];

const ROOF_TYPES = [
  { id: "flat", label: "Плоская", multiplier: 1.0, price: 2500 },
  { id: "gable", label: "Двускатная", multiplier: 1.15, price: 3200 },
  { id: "hip", label: "Вальмовая", multiplier: 1.3, price: 4200 },
  { id: "mansard", label: "Мансардная", multiplier: 1.45, price: 5500 },
  { id: "complex", label: "Сложная", multiplier: 1.6, price: 7000 },
];

const FOUNDATION_TYPES = [
  { id: "tape", label: "Ленточный", price: 8000, icon: "━" },
  { id: "pile", label: "Свайный", price: 5500, icon: "┃" },
  { id: "slab", label: "Плитный", price: 12000, icon: "▬" },
  { id: "combined", label: "Комбинированный", price: 14000, icon: "▨" },
];

const FINISHING = [
  { id: "none", label: "Без отделки", multiplier: 0 },
  { id: "rough", label: "Черновая", multiplier: 0.15 },
  { id: "standard", label: "Стандартная", multiplier: 0.3 },
  { id: "premium", label: "Премиум", multiplier: 0.55 },
  { id: "luxury", label: "Люкс", multiplier: 0.85 },
];

const COMMUNICATIONS = [
  { id: "electricity", label: "Электричество", price: 180000, icon: "⚡" },
  { id: "water", label: "Водоснабжение", price: 250000, icon: "💧" },
  { id: "sewage", label: "Канализация", price: 200000, icon: "🔧" },
  { id: "gas", label: "Газификация", price: 450000, icon: "🔥" },
  { id: "heating", label: "Отопление", price: 350000, icon: "♨️" },
  { id: "ventilation", label: "Вентиляция", price: 280000, icon: "💨" },
  { id: "internet", label: "Интернет", price: 45000, icon: "📡" },
  { id: "security", label: "Безопасность", price: 120000, icon: "🔐" },
];

const ADDITIONAL = [
  { id: "garage", label: "Гараж", price: 650000, icon: "🚗" },
  { id: "terrace", label: "Терраса", price: 180000, icon: "🏡" },
  { id: "pool", label: "Бассейн", price: 1200000, icon: "🏊" },
  { id: "sauna", label: "Баня/Сауна", price: 380000, icon: "🧖" },
  { id: "fence", label: "Забор", price: 220000, icon: "🚧" },
  { id: "landscaping", label: "Ландшафт", price: 350000, icon: "🌿" },
  { id: "solar", label: "Солнечные панели", price: 480000, icon: "☀️" },
  { id: "smart", label: "Умный дом", price: 320000, icon: "🏠" },
];

const PROJECTS = [
  {
    id: 1,
    name: "Эко Минимал",
    type: "Каркасный",
    area: 85,
    floors: 1,
    rooms: 3,
    price: 3200000,
    tag: "Популярный",
    tagColor: "#00D4FF",
    desc: "Современный одноэтажный дом в скандинавском стиле",
    features: ["Панорамные окна", "Открытая планировка", "Эко-материалы"],
  },
  {
    id: 2,
    name: "Классик Плюс",
    type: "Кирпичный",
    area: 150,
    floors: 2,
    rooms: 5,
    price: 7800000,
    tag: "Хит",
    tagColor: "#FF6B1A",
    desc: "Двухэтажный кирпичный дом с просторными комнатами",
    features: ["Камин", "Подвал", "Гараж на 2 авто"],
  },
  {
    id: 3,
    name: "Модерн XL",
    type: "Монолитный",
    area: 220,
    floors: 3,
    rooms: 7,
    price: 14500000,
    tag: "Премиум",
    tagColor: "#00FF88",
    desc: "Трёхэтажный монолитный дом с эксплуатируемой кровлей",
    features: ["Кровельная терраса", "Лифт", "Умный дом"],
  },
  {
    id: 4,
    name: "Лесная Усадьба",
    type: "Деревянный",
    area: 120,
    floors: 2,
    rooms: 4,
    price: 5600000,
    tag: "Новинка",
    tagColor: "#A855F7",
    desc: "Двухэтажный деревянный дом с мансардой",
    features: ["Мансарда", "Панорамная баня", "Терраса"],
  },
  {
    id: 5,
    name: "Компакт Смарт",
    type: "Газобетон",
    area: 65,
    floors: 1,
    rooms: 2,
    price: 2100000,
    tag: "Бюджет",
    tagColor: "#FBBF24",
    desc: "Компактный дом для молодой семьи",
    features: ["Оптимальная площадь", "Энергоэффективность", "Быстрое строительство"],
  },
  {
    id: 6,
    name: "Вилла Гранд",
    type: "Кирпичный",
    area: 400,
    floors: 3,
    rooms: 10,
    price: 32000000,
    tag: "Люкс",
    tagColor: "#EC4899",
    desc: "Элитная вилла с полным набором опций",
    features: ["Бассейн", "Кинозал", "Винный погреб"],
  },
];

// ─── Smeta Data ──────────────────────────────────────────────────────────────

interface SmetaItem {
  name: string;
  unit: string;
  qty: (area: number, floors: number) => number;
  pricePerUnit: number;
  category: string;
}

const SMETA_ITEMS: SmetaItem[] = [
  // Земляные работы
  { name: "Разработка грунта (экскаватор)", unit: "м³", qty: (a) => Math.round(a * 0.8), pricePerUnit: 850, category: "Земляные работы" },
  { name: "Вывоз грунта", unit: "м³", qty: (a) => Math.round(a * 0.5), pricePerUnit: 600, category: "Земляные работы" },
  { name: "Ручная доработка грунта", unit: "м³", qty: (a) => Math.round(a * 0.15), pricePerUnit: 1200, category: "Земляные работы" },
  { name: "Планировка территории", unit: "м²", qty: (a) => Math.round(a * 1.5), pricePerUnit: 180, category: "Земляные работы" },

  // Фундамент
  { name: "Опалубка фундамента", unit: "м²", qty: (a) => Math.round(a * 0.6), pricePerUnit: 1800, category: "Фундамент" },
  { name: "Арматура Ø12 AIII", unit: "т", qty: (a) => +(a * 0.012).toFixed(2), pricePerUnit: 75000, category: "Фундамент" },
  { name: "Бетон М300 (B22.5)", unit: "м³", qty: (a) => Math.round(a * 0.25), pricePerUnit: 6500, category: "Фундамент" },
  { name: "Гидроизоляция фундамента (рулонная)", unit: "м²", qty: (a) => Math.round(a * 0.7), pricePerUnit: 420, category: "Фундамент" },
  { name: "Утеплитель ЭППС 100мм", unit: "м²", qty: (a) => Math.round(a * 0.5), pricePerUnit: 680, category: "Фундамент" },
  { name: "Укладка бетонной подготовки", unit: "м²", qty: (a) => Math.round(a), pricePerUnit: 950, category: "Фундамент" },

  // Стены и перекрытия
  { name: "Кладка наружных стен (кирпич)", unit: "м³", qty: (a, fl) => Math.round(a * 0.18 * fl), pricePerUnit: 8500, category: "Стены и перекрытия" },
  { name: "Кирпич рядовой М150", unit: "тыс.шт", qty: (a, fl) => +(a * 0.05 * fl).toFixed(1), pricePerUnit: 18000, category: "Стены и перекрытия" },
  { name: "Раствор кладочный М75", unit: "м³", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 5200, category: "Стены и перекрытия" },
  { name: "Кладка внутренних перегородок", unit: "м²", qty: (a, fl) => Math.round(a * 0.8 * fl), pricePerUnit: 1800, category: "Стены и перекрытия" },
  { name: "Монтаж перемычек оконных/дверных", unit: "шт", qty: (a, fl) => Math.round(a * 0.08 * fl), pricePerUnit: 2500, category: "Стены и перекрытия" },
  { name: "Плиты перекрытия ПК", unit: "шт", qty: (a, fl) => Math.round(a / 12 * fl), pricePerUnit: 14000, category: "Стены и перекрытия" },
  { name: "Монтаж плит перекрытия (кран)", unit: "шт", qty: (a, fl) => Math.round(a / 12 * fl), pricePerUnit: 2200, category: "Стены и перекрытия" },
  { name: "Армопояс (бетон М300)", unit: "м³", qty: (a, fl) => +(a * 0.015 * fl).toFixed(2), pricePerUnit: 12000, category: "Стены и перекрытия" },

  // Кровля
  { name: "Стропильная система (брус 150×50)", unit: "м³", qty: (a) => +(a * 0.025).toFixed(2), pricePerUnit: 32000, category: "Кровля" },
  { name: "Монтаж стропильной системы", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 1400, category: "Кровля" },
  { name: "Обрешётка (доска 25×100)", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 380, category: "Кровля" },
  { name: "Гидроизоляционная плёнка", unit: "м²", qty: (a) => Math.round(a * 1.2), pricePerUnit: 280, category: "Кровля" },
  { name: "Металлочерепица (Монтеррей)", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 850, category: "Кровля" },
  { name: "Конёк, торцевые планки", unit: "пм", qty: (a) => Math.round(Math.sqrt(a) * 2.5), pricePerUnit: 650, category: "Кровля" },
  { name: "Утеплитель кровли (минвата 200мм)", unit: "м²", qty: (a) => Math.round(a * 1.1), pricePerUnit: 520, category: "Кровля" },
  { name: "Пароизоляция кровли", unit: "м²", qty: (a) => Math.round(a * 1.1), pricePerUnit: 180, category: "Кровля" },
  { name: "Водосточная система", unit: "пм", qty: (a) => Math.round(Math.sqrt(a) * 4), pricePerUnit: 1200, category: "Кровля" },

  // Окна и двери
  { name: "Окна ПВХ 2-камерный стеклопакет", unit: "м²", qty: (a, fl) => Math.round(a * 0.12 * fl), pricePerUnit: 12500, category: "Окна и двери" },
  { name: "Монтаж окон", unit: "шт", qty: (a, fl) => Math.round(a * 0.06 * fl), pricePerUnit: 3500, category: "Окна и двери" },
  { name: "Откосы оконные (ПВХ)", unit: "пм", qty: (a, fl) => Math.round(a * 0.18 * fl), pricePerUnit: 850, category: "Окна и двери" },
  { name: "Дверь входная (металл, утеплённая)", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 28000, category: "Окна и двери" },
  { name: "Двери межкомнатные (ПВХ)", unit: "шт", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 8500, category: "Окна и двери" },
  { name: "Монтаж дверей межкомнатных", unit: "шт", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 2800, category: "Окна и двери" },

  // Утепление и фасад
  { name: "Утеплитель фасадный (минвата 100мм)", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 680, category: "Утепление и фасад" },
  { name: "Крепёж (дюбель-гриб)", unit: "шт", qty: (a, fl) => Math.round(a * 3.5 * fl), pricePerUnit: 18, category: "Утепление и фасад" },
  { name: "Армирующая сетка фасадная", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 220, category: "Утепление и фасад" },
  { name: "Штукатурка фасадная декоративная", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 950, category: "Утепление и фасад" },
  { name: "Грунтовка фасадная", unit: "л", qty: (a, fl) => Math.round(a * 0.7 * fl * 0.3), pricePerUnit: 180, category: "Утепление и фасад" },
  { name: "Краска фасадная", unit: "л", qty: (a, fl) => Math.round(a * 0.7 * fl * 0.5), pricePerUnit: 320, category: "Утепление и фасад" },

  // Черновые полы
  { name: "Стяжка цементно-песчаная 70мм", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 780, category: "Черновые полы" },
  { name: "Цемент М400 (мешок 50кг)", unit: "мешок", qty: (a, fl) => Math.round(a * fl * 0.18), pricePerUnit: 420, category: "Черновые полы" },
  { name: "Песок речной", unit: "т", qty: (a, fl) => +(a * fl * 0.12).toFixed(1), pricePerUnit: 1800, category: "Черновые полы" },
  { name: "Гидроизоляция пола (полиэтилен 200мкм)", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 45, category: "Черновые полы" },
  { name: "Утеплитель пола (ЭППС 50мм)", unit: "м²", qty: (a) => Math.round(a), pricePerUnit: 420, category: "Черновые полы" },

  // Чистовые полы
  { name: "Ламинат 33 класс (укладка)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.7), pricePerUnit: 1200, category: "Чистовые полы" },
  { name: "Ламинат 33 класс (материал)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.72), pricePerUnit: 850, category: "Чистовые полы" },
  { name: "Плитка керамогранит (санузлы, кухня)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.2), pricePerUnit: 2800, category: "Чистовые полы" },
  { name: "Клей для плитки", unit: "мешок", qty: (a, fl) => Math.round(a * fl * 0.2 * 0.08), pricePerUnit: 380, category: "Чистовые полы" },
  { name: "Плинтус напольный МДФ", unit: "пм", qty: (a, fl) => Math.round(Math.sqrt(a) * 4 * fl), pricePerUnit: 280, category: "Чистовые полы" },

  // Отделка стен и потолков
  { name: "Шпатлёвка стартовая", unit: "кг", qty: (a, fl) => Math.round(a * fl * 2.5), pricePerUnit: 28, category: "Отделка стен и потолков" },
  { name: "Шпатлёвка финишная", unit: "кг", qty: (a, fl) => Math.round(a * fl * 1.5), pricePerUnit: 42, category: "Отделка стен и потолков" },
  { name: "Грунтовка глубокого проникновения", unit: "л", qty: (a, fl) => Math.round(a * fl * 0.4), pricePerUnit: 85, category: "Отделка стен и потолков" },
  { name: "Краска интерьерная (потолок)", unit: "л", qty: (a, fl) => Math.round(a * fl * 0.25), pricePerUnit: 220, category: "Отделка стен и потолков" },
  { name: "Обои флизелиновые", unit: "рул", qty: (a, fl) => Math.round(a * fl * 0.07), pricePerUnit: 1800, category: "Отделка стен и потолков" },
  { name: "Клей для обоев", unit: "пач", qty: (a, fl) => Math.round(a * fl * 0.007), pricePerUnit: 320, category: "Отделка стен и потолков" },
  { name: "Работы по штукатурке стен", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.8), pricePerUnit: 650, category: "Отделка стен и потолков" },
  { name: "Работы по шпатлёвке стен", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.8), pricePerUnit: 480, category: "Отделка стен и потолков" },
  { name: "Поклейка обоев", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.0), pricePerUnit: 320, category: "Отделка стен и потолков" },

  // Электрика
  { name: "Кабель ВВГнг 3×2.5 (освещение)", unit: "м", qty: (a, fl) => Math.round(a * fl * 1.8), pricePerUnit: 95, category: "Электрика" },
  { name: "Кабель ВВГнг 3×4 (розетки)", unit: "м", qty: (a, fl) => Math.round(a * fl * 2.2), pricePerUnit: 145, category: "Электрика" },
  { name: "Кабель ВВГнг 3×6 (силовые)", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.5), pricePerUnit: 220, category: "Электрика" },
  { name: "Щиток электрический на 24 модуля", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 4500, category: "Электрика" },
  { name: "Автоматы защиты (16А, 25А)", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.08), pricePerUnit: 380, category: "Электрика" },
  { name: "Розетки (двойные)", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.15), pricePerUnit: 620, category: "Электрика" },
  { name: "Выключатели", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.06), pricePerUnit: 480, category: "Электрика" },
  { name: "Монтаж электрики (разводка)", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 950, category: "Электрика" },

  // Сантехника
  { name: "Труба ПП 25мм (водоснабжение)", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.3), pricePerUnit: 85, category: "Сантехника" },
  { name: "Труба канализационная 110мм", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.25), pricePerUnit: 320, category: "Сантехника" },
  { name: "Унитаз с инсталляцией", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 18500, category: "Сантехника" },
  { name: "Ванна акриловая 170×70", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 12000, category: "Сантехника" },
  { name: "Смеситель для ванны/душа", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 4800, category: "Сантехника" },
  { name: "Смеситель кухонный", unit: "шт", qty: () => 1, pricePerUnit: 3500, category: "Сантехника" },
  { name: "Мойка кухонная нержавейка", unit: "шт", qty: () => 1, pricePerUnit: 4200, category: "Сантехника" },
  { name: "Монтаж сантехники", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 680, category: "Сантехника" },
];

type SmetaGroupData = { category: string; items: (SmetaItem & { totalQty: number; totalPrice: number })[]; groupTotal: number };

function buildSmeta(area: number, floors: number, finishingId: string): SmetaGroupData[] {
  const noFinish = finishingId === "none";
  const roughOnly = finishingId === "rough";
  const finishCategories = ["Чистовые полы", "Отделка стен и потолков"];
  const roughCategories = ["Черновые полы"];

  const filtered = SMETA_ITEMS.filter(item => {
    if (noFinish && [...finishCategories, ...roughCategories].includes(item.category)) return false;
    if (roughOnly && finishCategories.includes(item.category)) return false;
    return true;
  });

  const groups: Record<string, SmetaGroupData> = {};
  for (const item of filtered) {
    if (!groups[item.category]) groups[item.category] = { category: item.category, items: [], groupTotal: 0 };
    const totalQty = item.qty(area, floors);
    const totalPrice = Math.round(totalQty * item.pricePerUnit);
    groups[item.category].items.push({ ...item, totalQty, totalPrice });
    groups[item.category].groupTotal += totalPrice;
  }
  return Object.values(groups);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн ₽";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + " тыс ₽";
  return n.toFixed(0) + " ₽";
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

const NAV_ITEMS = [
  { id: "calc", label: "Калькулятор", icon: "Calculator" },
  { id: "smeta", label: "Смета", icon: "FileText" },
  { id: "projects", label: "Проекты", icon: "LayoutGrid" },
  { id: "compare", label: "Сравнение", icon: "GitCompare" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Index() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("calc");

  // Calculator state
  const [area, setArea] = useState(120);
  const [floors, setFloors] = useState(2);
  const [houseType, setHouseType] = useState("brick");
  const [roofType, setRoofType] = useState("gable");
  const [foundation, setFoundation] = useState("tape");
  const [finishing, setFinishing] = useState("standard");
  const [communications, setCommunications] = useState<string[]>(["electricity", "water", "sewage"]);
  const [additionals, setAdditionals] = useState<string[]>([]);
  const [region, setRegion] = useState(1.0);
  const [animKey, setAnimKey] = useState(0);

  // Projects state
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [compareList, setCompareList] = useState<number[]>([]);

  // Calculation
  const BASE_PRICE_PER_SQM = 45000;
  const houseTypeData = HOUSE_TYPES.find(h => h.id === houseType)!;
  const roofData = ROOF_TYPES.find(r => r.id === roofType)!;
  const foundationData = FOUNDATION_TYPES.find(f => f.id === foundation)!;
  const finishingData = FINISHING.find(f => f.id === finishing)!;

  const baseConstruction = area * BASE_PRICE_PER_SQM * houseTypeData.multiplier * floors * 0.85 * region;
  const roofCost = area * roofData.price * roofData.multiplier;
  const foundationCost = area * foundationData.price;
  const finishingCost = baseConstruction * finishingData.multiplier;
  const commsCost = communications.reduce((sum, id) => sum + (COMMUNICATIONS.find(c => c.id === id)?.price || 0), 0);
  const additionalCost = additionals.reduce((sum, id) => sum + (ADDITIONAL.find(a => a.id === id)?.price || 0), 0);
  const totalCost = baseConstruction + roofCost + foundationCost + finishingCost + commsCost + additionalCost;

  const toggleComm = (id: string) =>
    setCommunications(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAdditional = (id: string) =>
    setAdditionals(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCompare = (id: number) =>
    setCompareList(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [area, floors, houseType, roofType, foundation, finishing, communications, additionals, region]);

  // Smeta
  const smetaGroups = buildSmeta(area, floors, finishing);
  const smetaTotal = smetaGroups.reduce((s, g) => s + g.groupTotal, 0);

  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Header
    doc.setFillColor(10, 13, 20);
    doc.rect(0, 0, 210, 297, "F");
    doc.setFontSize(20);
    doc.setTextColor(255, 107, 26);
    doc.text("СМЕТА НА СТРОИТЕЛЬСТВО ДОМА", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text(`Дата: ${new Date().toLocaleDateString("ru-RU")}`, 14, 26);
    doc.text(`Площадь: ${area} м²  |  Этажей: ${floors}  |  Тип: ${houseTypeData.label}  |  Отделка: ${finishingData.label}`, 14, 32);

    let startY = 40;

    for (const group of smetaGroups) {
      // Group header
      doc.setFillColor(30, 37, 53);
      doc.rect(14, startY - 4, 182, 7, "F");
      doc.setFontSize(9);
      doc.setTextColor(255, 107, 26);
      doc.text(group.category.toUpperCase(), 16, startY);
      startY += 4;

      autoTable(doc, {
        startY,
        head: [["Наименование", "Ед.", "Кол-во", "Цена/ед.", "Сумма, ₽"]],
        body: group.items.map(item => [
          item.name,
          item.unit,
          String(item.totalQty),
          formatNum(item.pricePerUnit),
          formatNum(item.totalPrice),
        ]),
        foot: [["", "", "", "Итого по разделу:", formatNum(group.groupTotal)]],
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2, textColor: [220, 220, 220], fillColor: [15, 19, 30], lineColor: [30, 37, 53] },
        headStyles: { fillColor: [20, 26, 40], textColor: [0, 212, 255], fontStyle: "bold", fontSize: 7.5 },
        footStyles: { fillColor: [20, 26, 40], textColor: [0, 255, 136], fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 15, halign: "center" },
          2: { cellWidth: 20, halign: "right" },
          3: { cellWidth: 32, halign: "right" },
          4: { cellWidth: 32, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }

    // Total
    doc.setFontSize(13);
    doc.setTextColor(255, 107, 26);
    doc.text(`ИТОГО ПО СМЕТЕ: ${formatNum(smetaTotal)} руб.`, 14, startY + 6);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("* Смета носит ориентировочный характер. Цены могут отличаться в зависимости от региона и поставщиков.", 14, startY + 14);

    doc.save(`smeta_${area}m2_${floors}fl.pdf`);
  };

  return (
    <div className="noise-bg min-h-screen" style={{ background: "var(--dark-bg)" }}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, var(--neon-orange) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, var(--neon-cyan) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #A855F7 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5"
        style={{ background: "rgba(10,13,20,0.92)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-sm"
              style={{ background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)", color: "#fff" }}>
              СК
            </div>
            <div>
              <div className="font-display font-semibold text-base tracking-wide text-white">СтройКалькулятор</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Автоматический расчёт</div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: activeTab === item.id ? "var(--neon-orange)" : "transparent",
                  color: activeTab === item.id ? "#fff" : "rgba(255,255,255,0.5)",
                  boxShadow: activeTab === item.id ? "0 0 20px rgba(255,107,26,0.35)" : "none",
                }}>
                <Icon name={item.icon} size={15} />
                {item.label}
                {item.id === "compare" && compareList.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: activeTab === "compare" ? "rgba(255,255,255,0.3)" : "var(--neon-orange)", color: "#fff", fontSize: 10 }}>
                    {compareList.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="sm:hidden flex gap-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="p-2 rounded-lg transition-all"
                  style={{ background: activeTab === item.id ? "var(--neon-orange)" : "rgba(255,255,255,0.05)", color: "#fff" }}>
                  <Icon name={item.icon} size={18} />
                </button>
              ))}
            </div>
            <button onClick={() => navigate("/staff")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
              title="Личный кабинет сотрудника">
              <Icon name="Users" size={13} />
              <span className="hidden sm:inline">Сотрудники</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── CALCULATOR TAB ── */}
        {activeTab === "calc" && (
          <div className="animate-fade-in">
            {/* Hero banner */}
            <div className="relative rounded-2xl overflow-hidden mb-8">
              <img
                src="https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/18ef8126-de0c-4571-a466-a3809e6ec703.jpg"
                alt="Строительство дома"
                className="w-full object-cover"
                style={{ height: 200, objectPosition: "center 40%" }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(10,13,20,0.97) 45%, rgba(10,13,20,0.3))" }} />
              <div className="absolute inset-0 flex items-center px-8">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-orange)" }}>
                    Онлайн расчёт · 2026
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
                    Сколько стоит
                  </h1>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold" style={{ color: "var(--neon-orange)" }}>
                    построить дом?
                  </h1>
                  <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Настройте параметры — цена обновляется мгновенно
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Left column: all params */}
              <div className="xl:col-span-2 space-y-5">

                {/* Area & Floors */}
                <Section icon="Ruler" title="Площадь и этажность">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Площадь дома</span>
                        <span className="font-display font-bold text-xl" style={{ color: "var(--neon-cyan)" }}>{area} м²</span>
                      </div>
                      <input type="range" min={30} max={500} value={area} onChange={e => setArea(+e.target.value)} />
                      <div className="flex justify-between mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                        <span>30 м²</span><span>500 м²</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>Количество этажей</span>
                        <span className="font-display font-bold text-xl" style={{ color: "var(--neon-cyan)" }}>{floors}</span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map(f => (
                          <button key={f} onClick={() => setFloors(f)}
                            className="flex-1 py-3 rounded-xl font-display font-bold text-xl transition-all duration-200"
                            style={{
                              background: floors === f ? "var(--neon-cyan)" : "rgba(255,255,255,0.05)",
                              color: floors === f ? "#0A0D14" : "rgba(255,255,255,0.5)",
                              boxShadow: floors === f ? "0 0 18px rgba(0,212,255,0.45)" : "none",
                            }}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* House type */}
                <Section icon="Home" title="Тип строения">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {HOUSE_TYPES.map(h => (
                      <button key={h.id} onClick={() => setHouseType(h.id)}
                        className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: houseType === h.id ? "rgba(255,107,26,0.14)" : "rgba(255,255,255,0.04)",
                          border: houseType === h.id ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: houseType === h.id ? "0 0 20px rgba(255,107,26,0.2)" : "none",
                        }}>
                        <div className="text-2xl mb-2">{h.icon}</div>
                        <div className="font-semibold text-sm text-white">{h.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: houseType === h.id ? "var(--neon-orange)" : "rgba(255,255,255,0.3)" }}>
                          {h.multiplier >= 1 ? "+" : ""}{Math.round((h.multiplier - 1) * 100)}% к цене
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Foundation */}
                <Section icon="Layers" title="Фундамент">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {FOUNDATION_TYPES.map(f => (
                      <button key={f.id} onClick={() => setFoundation(f.id)}
                        className="p-4 rounded-xl text-center transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: foundation === f.id ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                          border: foundation === f.id ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                          boxShadow: foundation === f.id ? "0 0 18px rgba(0,212,255,0.2)" : "none",
                        }}>
                        <div className="text-xl font-mono mb-2" style={{ color: "var(--neon-cyan)" }}>{f.icon}</div>
                        <div className="text-xs font-semibold text-white">{f.label}</div>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {(f.price / 1000).toFixed(0)}&nbsp;тыс/м²
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Roof */}
                <Section icon="Triangle" title="Кровля">
                  <div className="flex flex-wrap gap-3">
                    {ROOF_TYPES.map(r => (
                      <button key={r.id} onClick={() => setRoofType(r.id)}
                        className="px-5 py-3 rounded-xl text-sm transition-all duration-200"
                        style={{
                          background: roofType === r.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                          border: roofType === r.id ? "1px solid #A855F7" : "1px solid rgba(255,255,255,0.07)",
                          color: roofType === r.id ? "#A855F7" : "rgba(255,255,255,0.6)",
                        }}>
                        <div className="font-semibold">{r.label}</div>
                        <div className="text-xs mt-0.5 opacity-70">{(r.price / 1000).toFixed(1)}K/м²</div>
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Finishing */}
                <Section icon="Paintbrush" title="Отделка">
                  <div className="flex flex-wrap gap-3">
                    {FINISHING.map(f => (
                      <button key={f.id} onClick={() => setFinishing(f.id)}
                        className="px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                        style={{
                          background: finishing === f.id ? "rgba(0,255,136,0.12)" : "rgba(255,255,255,0.04)",
                          border: finishing === f.id ? "1px solid var(--neon-green)" : "1px solid rgba(255,255,255,0.07)",
                          color: finishing === f.id ? "var(--neon-green)" : "rgba(255,255,255,0.6)",
                        }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Communications */}
                <Section icon="Zap" title="Коммуникации" badge={communications.length}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {COMMUNICATIONS.map(c => {
                      const active = communications.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleComm(c.id)}
                          className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: active ? "rgba(255,107,26,0.12)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div className="text-xl mb-2">{c.icon}</div>
                          <div className="text-xs font-semibold text-white">{c.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: active ? "var(--neon-orange)" : "rgba(255,255,255,0.3)" }}>
                            +{formatPrice(c.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Additional */}
                <Section icon="Plus" title="Дополнительные опции" badge={additionals.length}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ADDITIONAL.map(a => {
                      const active = additionals.includes(a.id);
                      return (
                        <button key={a.id} onClick={() => toggleAdditional(a.id)}
                          className="p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: active ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.07)",
                          }}>
                          <div className="text-xl mb-2">{a.icon}</div>
                          <div className="text-xs font-semibold text-white">{a.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: active ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                            +{formatPrice(a.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Region */}
                <Section icon="MapPin" title="Регион строительства">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Москва / МО", val: 1.35 },
                      { label: "Санкт-Петербург", val: 1.2 },
                      { label: "Города-миллионники", val: 1.1 },
                      { label: "Региональный центр", val: 1.0 },
                      { label: "Малые города", val: 0.9 },
                      { label: "Сельская местность", val: 0.8 },
                    ].map(r => (
                      <button key={r.val} onClick={() => setRegion(r.val)}
                        className="p-3 rounded-xl text-sm text-center transition-all duration-200"
                        style={{
                          background: region === r.val ? "rgba(255,107,26,0.12)" : "rgba(255,255,255,0.04)",
                          border: region === r.val ? "1px solid var(--neon-orange)" : "1px solid rgba(255,255,255,0.07)",
                          color: region === r.val ? "var(--neon-orange)" : "rgba(255,255,255,0.6)",
                        }}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </Section>

              </div>

              {/* Right: sticky result */}
              <div className="xl:col-span-1">
                <div className="sticky top-24 space-y-4">
                  {/* Total */}
                  <div className="rounded-2xl p-6 relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #111520 0%, #1a0f05 100%)",
                      border: "1px solid rgba(255,107,26,0.35)",
                    }}>
                    <div className="absolute inset-0 opacity-20"
                      style={{ background: "radial-gradient(circle at top right, var(--neon-orange), transparent 65%)" }} />
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                        Итоговая стоимость
                      </div>
                      <div key={animKey} className="font-display font-black text-3xl sm:text-4xl animate-counter"
                        style={{ color: "var(--neon-orange)", lineHeight: 1.1 }}>
                        {formatPrice(totalCost)}
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        ≈ {formatPrice(Math.round(totalCost / area))} за м²
                      </div>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="rounded-2xl p-5 space-y-3.5"
                    style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Детальный расчёт
                    </div>
                    {[
                      { label: "Строительство", val: baseConstruction, color: "var(--neon-orange)" },
                      { label: "Кровля", val: roofCost, color: "#A855F7" },
                      { label: "Фундамент", val: foundationCost, color: "var(--neon-cyan)" },
                      { label: "Отделка", val: finishingCost, color: "var(--neon-green)" },
                      ...(commsCost > 0 ? [{ label: "Коммуникации", val: commsCost, color: "#FBBF24" }] : []),
                      ...(additionalCost > 0 ? [{ label: "Дополнительно", val: additionalCost, color: "#EC4899" }] : []),
                    ].map((row, i) => {
                      const pct = Math.round((row.val / totalCost) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span style={{ color: "rgba(255,255,255,0.55)" }}>{row.label}</span>
                            <span className="font-semibold text-xs" style={{ color: row.color }}>{formatPrice(row.val)}</span>
                          </div>
                          <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-1 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: row.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini summary */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Площадь", val: `${area} м²`, icon: "Maximize2" },
                      { label: "Этажей", val: String(floors), icon: "Layers" },
                      { label: "Тип дома", val: houseTypeData.label, icon: "Home" },
                      { label: "Отделка", val: finishingData.label, icon: "Paintbrush" },
                    ].map((p, i) => (
                      <div key={i} className="rounded-xl p-3 flex items-center gap-2"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Icon name={p.icon} size={13} style={{ color: "var(--neon-orange)", flexShrink: 0 }} />
                        <div className="min-w-0">
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{p.label}</div>
                          <div className="text-xs font-semibold text-white truncate">{p.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <button className="w-full py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(135deg, var(--neon-orange), #FF3D00)",
                      color: "#fff",
                      boxShadow: "0 0 30px rgba(255,107,26,0.45)",
                    }}>
                    Получить коммерческое предложение
                  </button>
                  <button className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                    💾 Сохранить расчёт
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS TAB ── */}
        {activeTab === "projects" && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-orange)" }}>
                Каталог проектов
              </div>
              <h2 className="font-display text-3xl font-bold text-white">Готовые проекты домов</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Нажмите на иконку <Icon name="GitCompare" size={13} style={{ display: "inline", color: "var(--neon-cyan)" }} /> для сравнения до 3 проектов
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROJECTS.map((p, i) => (
                <div key={p.id}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    background: "var(--card-bg)",
                    border: selectedProject === p.id ? `1px solid ${p.tagColor}` : "1px solid var(--card-border)",
                    boxShadow: selectedProject === p.id ? `0 0 30px ${p.tagColor}44` : "none",
                    animation: `fadeInUp 0.5s ease-out ${i * 0.07}s both`,
                  }}
                  onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}>
                  <div className="px-5 pt-5 flex items-start justify-between">
                    <div className="px-3 py-1 rounded-full text-xs font-semibold font-display"
                      style={{ background: `${p.tagColor}22`, color: p.tagColor, border: `1px solid ${p.tagColor}44` }}>
                      {p.tag}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleCompare(p.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                      title="Сравнить"
                      style={{
                        background: compareList.includes(p.id) ? "var(--neon-cyan)" : "rgba(255,255,255,0.07)",
                        color: compareList.includes(p.id) ? "#000" : "rgba(255,255,255,0.4)",
                      }}>
                      <Icon name="GitCompare" size={13} />
                    </button>
                  </div>

                  <div className="px-5 py-4">
                    <h3 className="font-display font-bold text-xl text-white">{p.name}</h3>
                    <p className="text-xs mt-1 mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{p.desc}</p>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { icon: "Maximize2", val: `${p.area} м²`, label: "Площадь" },
                        { icon: "Layers", val: `${p.floors} эт.`, label: "Этажей" },
                        { icon: "BedDouble", val: `${p.rooms} комн.`, label: "Комнат" },
                      ].map((s, j) => (
                        <div key={j} className="rounded-xl p-2 text-center"
                          style={{ background: "rgba(255,255,255,0.04)" }}>
                          <Icon name={s.icon} size={12} style={{ color: p.tagColor, margin: "0 auto 3px" }} />
                          <div className="font-bold text-xs text-white">{s.val}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {p.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.tagColor }} />
                          {f}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Стоимость от</div>
                        <div className="font-display font-bold text-xl" style={{ color: p.tagColor }}>
                          {formatPrice(p.price)}
                        </div>
                      </div>
                      <button className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                        style={{ background: `${p.tagColor}22`, color: p.tagColor, border: `1px solid ${p.tagColor}44` }}>
                        Подробнее
                      </button>
                    </div>

                    {selectedProject === p.id && (
                      <div className="mt-4 rounded-xl p-4 animate-scale-in"
                        style={{ background: `${p.tagColor}11`, border: `1px solid ${p.tagColor}33` }}>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Цена за м²
                        </div>
                        <div className="font-display text-lg font-bold" style={{ color: p.tagColor }}>
                          {formatPrice(Math.round(p.price / p.area))} / м²
                        </div>
                        <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {p.type} · {p.area} м² · {p.floors} этаж(а)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {activeTab === "compare" && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-cyan)" }}>
                Сравнение
              </div>
              <h2 className="font-display text-3xl font-bold text-white">Сравнение проектов</h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Добавьте до 3 проектов через вкладку «Проекты»
              </p>
            </div>

            {compareList.length === 0 ? (
              <div className="rounded-2xl p-16 text-center"
                style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="text-6xl mb-4">⚖️</div>
                <div className="font-display text-xl text-white mb-2">Нет проектов для сравнения</div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Перейдите в «Проекты» и нажмите иконку сравнения на карточках
                </p>
                <button onClick={() => setActiveTab("projects")}
                  className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                  style={{ background: "var(--neon-cyan)", color: "#0A0D14", boxShadow: "0 0 20px rgba(0,212,255,0.4)" }}>
                  Перейти к проектам
                </button>
              </div>
            ) : (
              <div>
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left p-5 text-sm font-medium w-40"
                          style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)" }}>
                          Параметр
                        </th>
                        {compareList.map(id => {
                          const p = PROJECTS.find(pr => pr.id === id)!;
                          return (
                            <th key={id} className="p-5 text-center"
                              style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--card-border)" }}>
                              <div className="font-display font-bold text-white text-lg">{p.name}</div>
                              <div className="text-xs mt-0.5 font-semibold" style={{ color: p.tagColor }}>{p.tag}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Тип строения", render: (p: typeof PROJECTS[0]) => p.type },
                        { label: "Площадь", render: (p: typeof PROJECTS[0]) => `${p.area} м²` },
                        { label: "Этажей", render: (p: typeof PROJECTS[0]) => String(p.floors) },
                        { label: "Комнат", render: (p: typeof PROJECTS[0]) => String(p.rooms) },
                        { label: "Стоимость от", render: (p: typeof PROJECTS[0]) => formatPrice(p.price), highlight: true },
                        { label: "Цена / м²", render: (p: typeof PROJECTS[0]) => formatPrice(Math.round(p.price / p.area)) },
                      ].map((row, i) => (
                        <tr key={i}>
                          <td className="p-5 text-sm"
                            style={{
                              color: "rgba(255,255,255,0.45)",
                              background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                              borderBottom: "1px solid var(--card-border)",
                            }}>
                            {row.label}
                          </td>
                          {compareList.map(id => {
                            const p = PROJECTS.find(pr => pr.id === id)!;
                            return (
                              <td key={id} className="p-5 text-center"
                                style={{
                                  background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent",
                                  borderBottom: "1px solid var(--card-border)",
                                  color: row.highlight ? p.tagColor : "rgba(255,255,255,0.85)",
                                  fontWeight: row.highlight ? 700 : 500,
                                  fontFamily: row.highlight ? "Oswald, sans-serif" : "inherit",
                                }}>
                                {row.render(p)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap">
                  {compareList.map(id => {
                    const p = PROJECTS.find(pr => pr.id === id)!;
                    return (
                      <button key={id} onClick={() => toggleCompare(id)}
                        className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all hover:bg-white/10"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Icon name="X" size={11} />
                        Убрать «{p.name}»
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ── SMETA TAB ── */}
        {activeTab === "smeta" && (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--neon-green)" }}>
                  Детализация
                </div>
                <h2 className="font-display text-3xl font-bold text-white">Смета строительства</h2>
                <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {area} м² · {floors} эт. · {houseTypeData.label} · Отделка: {finishingData.label}
                </p>
              </div>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, var(--neon-green), #00cc66)",
                  color: "#0A0D14",
                  boxShadow: "0 0 25px rgba(0,255,136,0.35)",
                }}>
                <Icon name="Download" size={16} />
                Скачать PDF
              </button>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
              {[
                { label: "Позиций в смете", val: String(smetaGroups.reduce((s, g) => s + g.items.length, 0)), color: "var(--neon-cyan)" },
                { label: "Разделов", val: String(smetaGroups.length), color: "#A855F7" },
                { label: "Итого по смете", val: formatPrice(smetaTotal), color: "var(--neon-green)" },
                { label: "Цена / м²", val: formatPrice(Math.round(smetaTotal / area)), color: "var(--neon-orange)" },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl p-4"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                  <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
                  <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Groups */}
            <div className="space-y-4">
              {smetaGroups.map((group, gi) => (
                <SmetaGroup key={gi} group={group} index={gi} />
              ))}
            </div>

            {/* Total */}
            <div className="mt-6 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                background: "linear-gradient(135deg, #0d1a12, #111520)",
                border: "1px solid rgba(0,255,136,0.3)",
                boxShadow: "0 0 30px rgba(0,255,136,0.1)",
              }}>
              <div>
                <div className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>ИТОГО ПО СМЕТЕ</div>
                <div className="font-display font-black text-4xl" style={{ color: "var(--neon-green)" }}>
                  {formatNum(smetaTotal)} ₽
                </div>
                <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  * Ориентировочные цены. Фактические могут отличаться в зависимости от региона и поставщиков.
                </div>
              </div>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-8 py-4 rounded-xl font-display font-semibold text-base tracking-wide transition-all hover:scale-105 whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, var(--neon-green), #00cc66)",
                  color: "#0A0D14",
                  boxShadow: "0 0 25px rgba(0,255,136,0.4)",
                }}>
                <Icon name="FileDown" size={18} />
                Скачать PDF-смету
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t py-8 text-center"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
        СтройКалькулятор · Автоматический расчёт стоимости строительства · 2026
      </footer>

      <ChatWidget role="visitor" />
    </div>
  );
}

// ─── SmetaGroup component ─────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Земляные работы": "#A855F7",
  "Фундамент": "#00D4FF",
  "Стены и перекрытия": "#FF6B1A",
  "Кровля": "#FBBF24",
  "Окна и двери": "#00FF88",
  "Утепление и фасад": "#EC4899",
  "Черновые полы": "#6366F1",
  "Чистовые полы": "#14B8A6",
  "Отделка стен и потолков": "#F97316",
  "Электрика": "#EAB308",
  "Сантехника": "#3B82F6",
};

function SmetaGroup({ group, index }: { group: SmetaGroupData; index: number }) {
  const [open, setOpen] = useState(index < 2);
  const color = CATEGORY_COLORS[group.category] || "var(--neon-orange)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)", animation: `fadeInUp 0.4s ease-out ${index * 0.04}s both` }}>
      {/* Group header — clickable */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 sm:p-5 transition-all hover:bg-white/5"
        style={{ background: "rgba(255,255,255,0.03)" }}>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="font-display font-semibold text-sm sm:text-base text-white tracking-wide">{group.category}</span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
            {group.items.length} поз.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-base sm:text-lg" style={{ color }}>
            {formatNum(group.groupTotal)} ₽
          </span>
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
        </div>
      </button>

      {/* Items table */}
      {open && (
        <div className="overflow-x-auto animate-fade-in">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Наименование</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold w-16" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Ед.</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold w-20" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Кол-во</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold w-28" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Цена/ед., ₽</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold w-32" style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Сумма, ₽</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <td className="px-4 py-2.5" style={{ color: "rgba(255,255,255,0.8)" }}>{item.name}</td>
                  <td className="px-3 py-2.5 text-center text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item.unit}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: "rgba(255,255,255,0.7)" }}>{item.totalQty}</td>
                  <td className="px-3 py-2.5 text-right" style={{ color: "rgba(255,255,255,0.5)" }}>{formatNum(item.pricePerUnit)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color }}>{formatNum(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: `${color}11`, borderTop: `1px solid ${color}33` }}>
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Итого по разделу</td>
                <td colSpan={2} className="px-4 py-3 text-right font-display font-bold text-base" style={{ color }}>{formatNum(group.groupTotal)} ₽</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, badge, children }: { icon: string; title: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 gradient-border">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(255,107,26,0.14)" }}>
          <Icon name={icon} size={16} style={{ color: "var(--neon-orange)" }} />
        </div>
        <h2 className="font-display font-semibold text-base text-white tracking-wide">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: "var(--neon-orange)", color: "#fff" }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}