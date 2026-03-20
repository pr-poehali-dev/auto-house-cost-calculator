// ─── Справочники калькулятора ─────────────────────────────────────────────────

export const HOUSE_TYPES = [
  { id: "brick", label: "Кирпичный", icon: "🧱", multiplier: 1.4 },
  { id: "frame", label: "Каркасный", icon: "🏗️", multiplier: 0.85 },
  { id: "concrete", label: "Монолитный", icon: "🏢", multiplier: 1.6 },
  { id: "wood", label: "Деревянный", icon: "🪵", multiplier: 1.0 },
  { id: "aerated", label: "Газобетон", icon: "🟫", multiplier: 1.1 },
  { id: "modular", label: "Модульный", icon: "📦", multiplier: 0.75 },
];

export const ROOF_TYPES = [
  { id: "flat", label: "Плоская", multiplier: 1.0, price: 2500 },
  { id: "gable", label: "Двускатная", multiplier: 1.15, price: 3200 },
  { id: "hip", label: "Вальмовая", multiplier: 1.3, price: 4200 },
  { id: "mansard", label: "Мансардная", multiplier: 1.45, price: 5500 },
  { id: "complex", label: "Сложная", multiplier: 1.6, price: 7000 },
];

export const FOUNDATION_TYPES = [
  { id: "tape", label: "Ленточный", price: 8000, icon: "━" },
  { id: "pile", label: "Свайный", price: 5500, icon: "┃" },
  { id: "slab", label: "Плитный", price: 12000, icon: "▬" },
  { id: "combined", label: "Комбинированный", price: 14000, icon: "▨" },
];

export const FINISHING = [
  { id: "none", label: "Без отделки", multiplier: 0 },
  { id: "rough", label: "Черновая", multiplier: 0.15 },
  { id: "standard", label: "Стандартная", multiplier: 0.3 },
  { id: "premium", label: "Премиум", multiplier: 0.55 },
  { id: "luxury", label: "Люкс", multiplier: 0.85 },
];

export const COMMUNICATIONS = [
  { id: "electricity", label: "Электричество", price: 180000, icon: "⚡" },
  { id: "water", label: "Водоснабжение", price: 250000, icon: "💧" },
  { id: "sewage", label: "Канализация", price: 200000, icon: "🔧" },
  { id: "gas", label: "Газификация", price: 450000, icon: "🔥" },
  { id: "heating", label: "Отопление", price: 350000, icon: "♨️" },
  { id: "ventilation", label: "Вентиляция", price: 280000, icon: "💨" },
  { id: "internet", label: "Интернет", price: 45000, icon: "📡" },
  { id: "security", label: "Безопасность", price: 120000, icon: "🔐" },
];

export const ADDITIONAL = [
  { id: "garage", label: "Гараж", price: 650000, icon: "🚗" },
  { id: "terrace", label: "Терраса", price: 180000, icon: "🏡" },
  { id: "pool", label: "Бассейн", price: 1200000, icon: "🏊" },
  { id: "sauna", label: "Баня/Сауна", price: 380000, icon: "🧖" },
  { id: "fence", label: "Забор", price: 220000, icon: "🚧" },
  { id: "landscaping", label: "Ландшафт", price: 350000, icon: "🌿" },
  { id: "solar", label: "Солнечные панели", price: 480000, icon: "☀️" },
  { id: "smart", label: "Умный дом", price: 320000, icon: "🏠" },
];

export const PROJECTS = [
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/002d667c-3c75-4f59-93e9-07ddef3336d0.jpg",
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/6873e7d8-5b67-49ca-93b4-7aee48e80bb9.jpg",
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/91919a41-e34e-43ad-bed9-f3f928ab8ff8.jpg",
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/441eb3d3-681e-4169-8441-9725fb56b00d.jpg",
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/3341174f-aa1f-4029-bea4-97a935b4ed71.jpg",
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
    image: "https://cdn.poehali.dev/projects/75f2cb20-c283-4e27-9d0d-76895755032c/files/ba93f6ea-768b-441f-b7c2-c54d27dafc72.jpg",
  },
];

// ─── Смета ─────────────────────────────────────────────────────────────────────

export interface SmetaItem {
  name: string;
  unit: string;
  qty: (area: number, floors: number) => number;
  pricePerUnit: number;
  category: string;
}

export const SMETA_ITEMS: SmetaItem[] = [
  { name: "Разработка грунта (экскаватор)", unit: "м³", qty: (a) => Math.round(a * 0.8), pricePerUnit: 850, category: "Земляные работы" },
  { name: "Вывоз грунта", unit: "м³", qty: (a) => Math.round(a * 0.5), pricePerUnit: 600, category: "Земляные работы" },
  { name: "Ручная доработка грунта", unit: "м³", qty: (a) => Math.round(a * 0.15), pricePerUnit: 1200, category: "Земляные работы" },
  { name: "Планировка территории", unit: "м²", qty: (a) => Math.round(a * 1.5), pricePerUnit: 180, category: "Земляные работы" },
  { name: "Опалубка фундамента", unit: "м²", qty: (a) => Math.round(a * 0.6), pricePerUnit: 1800, category: "Фундамент" },
  { name: "Арматура Ø12 AIII", unit: "т", qty: (a) => +(a * 0.012).toFixed(2), pricePerUnit: 75000, category: "Фундамент" },
  { name: "Бетон М300 (B22.5)", unit: "м³", qty: (a) => Math.round(a * 0.25), pricePerUnit: 6500, category: "Фундамент" },
  { name: "Гидроизоляция фундамента (рулонная)", unit: "м²", qty: (a) => Math.round(a * 0.7), pricePerUnit: 420, category: "Фундамент" },
  { name: "Утеплитель ЭППС 100мм", unit: "м²", qty: (a) => Math.round(a * 0.5), pricePerUnit: 680, category: "Фундамент" },
  { name: "Укладка бетонной подготовки", unit: "м²", qty: (a) => Math.round(a), pricePerUnit: 950, category: "Фундамент" },
  { name: "Кладка наружных стен (кирпич)", unit: "м³", qty: (a, fl) => Math.round(a * 0.18 * fl), pricePerUnit: 8500, category: "Стены и перекрытия" },
  { name: "Кирпич рядовой М150", unit: "тыс.шт", qty: (a, fl) => +(a * 0.05 * fl).toFixed(1), pricePerUnit: 18000, category: "Стены и перекрытия" },
  { name: "Раствор кладочный М75", unit: "м³", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 5200, category: "Стены и перекрытия" },
  { name: "Кладка внутренних перегородок", unit: "м²", qty: (a, fl) => Math.round(a * 0.8 * fl), pricePerUnit: 1800, category: "Стены и перекрытия" },
  { name: "Монтаж перемычек оконных/дверных", unit: "шт", qty: (a, fl) => Math.round(a * 0.08 * fl), pricePerUnit: 2500, category: "Стены и перекрытия" },
  { name: "Плиты перекрытия ПК", unit: "шт", qty: (a, fl) => Math.round(a / 12 * fl), pricePerUnit: 14000, category: "Стены и перекрытия" },
  { name: "Монтаж плит перекрытия (кран)", unit: "шт", qty: (a, fl) => Math.round(a / 12 * fl), pricePerUnit: 2200, category: "Стены и перекрытия" },
  { name: "Армопояс (бетон М300)", unit: "м³", qty: (a, fl) => +(a * 0.015 * fl).toFixed(2), pricePerUnit: 12000, category: "Стены и перекрытия" },
  { name: "Стропильная система (брус 150×50)", unit: "м³", qty: (a) => +(a * 0.025).toFixed(2), pricePerUnit: 32000, category: "Кровля" },
  { name: "Монтаж стропильной системы", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 1400, category: "Кровля" },
  { name: "Обрешётка (доска 25×100)", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 380, category: "Кровля" },
  { name: "Гидроизоляционная плёнка", unit: "м²", qty: (a) => Math.round(a * 1.2), pricePerUnit: 280, category: "Кровля" },
  { name: "Металлочерепица (Монтеррей)", unit: "м²", qty: (a) => Math.round(a * 1.15), pricePerUnit: 850, category: "Кровля" },
  { name: "Конёк, торцевые планки", unit: "пм", qty: (a) => Math.round(Math.sqrt(a) * 2.5), pricePerUnit: 650, category: "Кровля" },
  { name: "Утеплитель кровли (минвата 200мм)", unit: "м²", qty: (a) => Math.round(a * 1.1), pricePerUnit: 520, category: "Кровля" },
  { name: "Пароизоляция кровли", unit: "м²", qty: (a) => Math.round(a * 1.1), pricePerUnit: 180, category: "Кровля" },
  { name: "Водосточная система", unit: "пм", qty: (a) => Math.round(Math.sqrt(a) * 4), pricePerUnit: 1200, category: "Кровля" },
  { name: "Окна ПВХ 2-камерный стеклопакет", unit: "м²", qty: (a, fl) => Math.round(a * 0.12 * fl), pricePerUnit: 12500, category: "Окна и двери" },
  { name: "Монтаж окон", unit: "шт", qty: (a, fl) => Math.round(a * 0.06 * fl), pricePerUnit: 3500, category: "Окна и двери" },
  { name: "Откосы оконные (ПВХ)", unit: "пм", qty: (a, fl) => Math.round(a * 0.18 * fl), pricePerUnit: 850, category: "Окна и двери" },
  { name: "Дверь входная (металл, утеплённая)", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 28000, category: "Окна и двери" },
  { name: "Двери межкомнатные (ПВХ)", unit: "шт", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 8500, category: "Окна и двери" },
  { name: "Монтаж дверей межкомнатных", unit: "шт", qty: (a, fl) => Math.round(a * 0.04 * fl), pricePerUnit: 2800, category: "Окна и двери" },
  { name: "Утеплитель фасадный (минвата 100мм)", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 680, category: "Утепление и фасад" },
  { name: "Крепёж (дюбель-гриб)", unit: "шт", qty: (a, fl) => Math.round(a * 3.5 * fl), pricePerUnit: 18, category: "Утепление и фасад" },
  { name: "Армирующая сетка фасадная", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 220, category: "Утепление и фасад" },
  { name: "Штукатурка фасадная декоративная", unit: "м²", qty: (a, fl) => Math.round(a * 0.7 * fl), pricePerUnit: 950, category: "Утепление и фасад" },
  { name: "Грунтовка фасадная", unit: "л", qty: (a, fl) => Math.round(a * 0.7 * fl * 0.3), pricePerUnit: 180, category: "Утепление и фасад" },
  { name: "Краска фасадная", unit: "л", qty: (a, fl) => Math.round(a * 0.7 * fl * 0.5), pricePerUnit: 320, category: "Утепление и фасад" },
  { name: "Стяжка цементно-песчаная 70мм", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 780, category: "Черновые полы" },
  { name: "Цемент М400 (мешок 50кг)", unit: "мешок", qty: (a, fl) => Math.round(a * fl * 0.18), pricePerUnit: 420, category: "Черновые полы" },
  { name: "Песок речной", unit: "т", qty: (a, fl) => +(a * fl * 0.12).toFixed(1), pricePerUnit: 1800, category: "Черновые полы" },
  { name: "Гидроизоляция пола (полиэтилен 200мкм)", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 45, category: "Черновые полы" },
  { name: "Утеплитель пола (ЭППС 50мм)", unit: "м²", qty: (a) => Math.round(a), pricePerUnit: 420, category: "Черновые полы" },
  { name: "Ламинат 33 класс (укладка)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.7), pricePerUnit: 1200, category: "Чистовые полы" },
  { name: "Ламинат 33 класс (материал)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.72), pricePerUnit: 850, category: "Чистовые полы" },
  { name: "Плитка керамогранит (санузлы, кухня)", unit: "м²", qty: (a, fl) => Math.round(a * fl * 0.2), pricePerUnit: 2800, category: "Чистовые полы" },
  { name: "Клей для плитки", unit: "мешок", qty: (a, fl) => Math.round(a * fl * 0.2 * 0.08), pricePerUnit: 380, category: "Чистовые полы" },
  { name: "Плинтус напольный МДФ", unit: "пм", qty: (a, fl) => Math.round(Math.sqrt(a) * 4 * fl), pricePerUnit: 280, category: "Чистовые полы" },
  { name: "Шпатлёвка стартовая", unit: "кг", qty: (a, fl) => Math.round(a * fl * 2.5), pricePerUnit: 28, category: "Отделка стен и потолков" },
  { name: "Шпатлёвка финишная", unit: "кг", qty: (a, fl) => Math.round(a * fl * 1.5), pricePerUnit: 42, category: "Отделка стен и потолков" },
  { name: "Грунтовка глубокого проникновения", unit: "л", qty: (a, fl) => Math.round(a * fl * 0.4), pricePerUnit: 85, category: "Отделка стен и потолков" },
  { name: "Краска интерьерная (потолок)", unit: "л", qty: (a, fl) => Math.round(a * fl * 0.25), pricePerUnit: 220, category: "Отделка стен и потолков" },
  { name: "Обои флизелиновые", unit: "рул", qty: (a, fl) => Math.round(a * fl * 0.07), pricePerUnit: 1800, category: "Отделка стен и потолков" },
  { name: "Клей для обоев", unit: "пач", qty: (a, fl) => Math.round(a * fl * 0.007), pricePerUnit: 320, category: "Отделка стен и потолков" },
  { name: "Работы по штукатурке стен", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.8), pricePerUnit: 650, category: "Отделка стен и потолков" },
  { name: "Работы по шпатлёвке стен", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.8), pricePerUnit: 480, category: "Отделка стен и потолков" },
  { name: "Поклейка обоев", unit: "м²", qty: (a, fl) => Math.round(a * fl * 2.0), pricePerUnit: 320, category: "Отделка стен и потолков" },
  { name: "Кабель ВВГнг 3×2.5 (освещение)", unit: "м", qty: (a, fl) => Math.round(a * fl * 1.8), pricePerUnit: 95, category: "Электрика" },
  { name: "Кабель ВВГнг 3×4 (розетки)", unit: "м", qty: (a, fl) => Math.round(a * fl * 2.2), pricePerUnit: 145, category: "Электрика" },
  { name: "Кабель ВВГнг 3×6 (силовые)", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.5), pricePerUnit: 220, category: "Электрика" },
  { name: "Щиток электрический на 24 модуля", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 4500, category: "Электрика" },
  { name: "Автоматы защиты (16А, 25А)", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.08), pricePerUnit: 380, category: "Электрика" },
  { name: "Розетки (двойные)", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.15), pricePerUnit: 620, category: "Электрика" },
  { name: "Выключатели", unit: "шт", qty: (a, fl) => Math.round(a * fl * 0.06), pricePerUnit: 480, category: "Электрика" },
  { name: "Монтаж электрики (разводка)", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 950, category: "Электрика" },
  { name: "Труба ПП 25мм (водоснабжение)", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.3), pricePerUnit: 85, category: "Сантехника" },
  { name: "Труба канализационная 110мм", unit: "м", qty: (a, fl) => Math.round(a * fl * 0.25), pricePerUnit: 320, category: "Сантехника" },
  { name: "Унитаз с инсталляцией", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 18500, category: "Сантехника" },
  { name: "Ванна акриловая 170×70", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 12000, category: "Сантехника" },
  { name: "Смеситель для ванны/душа", unit: "шт", qty: (_a, fl) => fl, pricePerUnit: 4800, category: "Сантехника" },
  { name: "Смеситель кухонный", unit: "шт", qty: () => 1, pricePerUnit: 3500, category: "Сантехника" },
  { name: "Мойка кухонная нержавейка", unit: "шт", qty: () => 1, pricePerUnit: 4200, category: "Сантехника" },
  { name: "Монтаж сантехники", unit: "м²", qty: (a, fl) => Math.round(a * fl), pricePerUnit: 680, category: "Сантехника" },
];

// ─── Типы для сметы ───────────────────────────────────────────────────────────

export type SmetaGroupData = {
  category: string;
  items: (SmetaItem & { totalQty: number; totalPrice: number })[];
  groupTotal: number;
};

export function buildSmeta(area: number, floors: number, finishingId: string): SmetaGroupData[] {
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

export function formatPrice(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " млн ₽";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + " тыс ₽";
  return n.toFixed(0) + " ₽";
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export const NAV_ITEMS = [
  { id: "calc", label: "Калькулятор", icon: "Calculator" },
  { id: "smeta", label: "Смета", icon: "FileText" },
  { id: "projects", label: "Проекты", icon: "LayoutGrid" },
  { id: "compare", label: "Сравнение", icon: "GitCompare" },
];

export const BASE_PRICE_PER_SQM = 45000;