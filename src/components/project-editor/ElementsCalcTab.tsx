import { useState, useId } from "react";
import Icon from "@/components/ui/icon";
import type { ObjectInfo } from "./ObjectInfoTab";

// ─── Типы ВОР ─────────────────────────────────────────────────────────────────

export interface VorRow {
  id: string;
  section: string;
  name: string;
  unit: string;
  qty: number;
  note?: string;
  is_work: boolean; // true = работа, false = материал
  price_per_unit?: number; // цена за единицу (необязательное, вводится вручную)
}

// ─── Типы элементов ───────────────────────────────────────────────────────────

type ElementKind =
  | "screw_pile" | "bored_pile" | "driven_pile"
  | "strip_foundation" | "slab_foundation"
  | "wall_layer" | "jb_belt"
  | "floor_slab_deck" | "floor_slab_hollow" | "floor_slab_mono" | "floor_slab_wood"
  | "window" | "door"
  | "roof_pitched" | "roof_flat" | "roof_mansard"
  | "drainage"
  | "elec_power" | "elec_equipment" | "elec_lighting"
  | "custom";

interface PlacedElement {
  id: string;
  kind: ElementKind;
  label: string;
  params: Record<string, number | string | boolean>;
  vor: VorRow[];
}

// ─── Библиотека элементов (описание) ─────────────────────────────────────────

interface LibItem {
  kind: ElementKind;
  group: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const LIBRARY: LibItem[] = [
  // Фундаменты
  { kind: "screw_pile",      group: "Фундамент", label: "Свая винтовая",       icon: "Drill",        color: "#3b82f6", description: "Металлическая свая с лопастью" },
  { kind: "bored_pile",      group: "Фундамент", label: "Свая буронабивная",   icon: "CircleDot",    color: "#3b82f6", description: "Железобетонная буронабивная свая" },
  { kind: "driven_pile",     group: "Фундамент", label: "Свая забивная",       icon: "ArrowDown",    color: "#3b82f6", description: "Сборная ЖБ забивная свая" },
  { kind: "strip_foundation",group: "Фундамент", label: "Лента",               icon: "Minus",        color: "#3b82f6", description: "Монолитный ленточный фундамент" },
  { kind: "slab_foundation", group: "Фундамент", label: "Плита",               icon: "Square",       color: "#3b82f6", description: "Монолитная фундаментная плита" },
  // Стены
  { kind: "wall_layer",      group: "Стены",     label: "Стена (слои)",        icon: "Layers",       color: "#f59e0b", description: "Стена с послойным заполнением материалов" },
  { kind: "jb_belt",         group: "Стены",     label: "ЖБ пояс",             icon: "AlignJustify", color: "#f59e0b", description: "Железобетонный армированный пояс" },
  // Перекрытия
  { kind: "floor_slab_deck", group: "Перекрытия",label: "Плита по опалубке",   icon: "LayoutGrid",   color: "#a855f7", description: "По несъёмной профлист-опалубке" },
  { kind: "floor_slab_hollow",group:"Перекрытия",label: "Плита многопустотная",icon: "Grid3x3",      color: "#a855f7", description: "Сборная многопустотная плита" },
  { kind: "floor_slab_mono", group: "Перекрытия",label: "Плита монолитная",    icon: "Box",          color: "#a855f7", description: "Монолитная ж/б плита перекрытия" },
  { kind: "floor_slab_wood", group: "Перекрытия",label: "Перекрытие деревянное",icon:"Columns2",     color: "#a855f7", description: "По деревянным балкам" },
  // Проёмы
  { kind: "window",          group: "Проёмы",    label: "Оконный блок",        icon: "AppWindow",    color: "#10b981", description: "Окно с перемычкой" },
  { kind: "door",            group: "Проёмы",    label: "Дверной блок",        icon: "DoorOpen",     color: "#10b981", description: "Дверь с перемычкой" },
  // Кровля
  { kind: "roof_pitched",    group: "Кровля",    label: "Кровля скатная",      icon: "Home",         color: "#ef4444", description: "Двускатная / вальмовая кровля" },
  { kind: "roof_flat",       group: "Кровля",    label: "Кровля плоская",      icon: "Minus",        color: "#ef4444", description: "Плоская эксплуатируемая / неэксплуатируемая" },
  { kind: "roof_mansard",    group: "Кровля",    label: "Кровля мансардная",   icon: "TrendingUp",   color: "#ef4444", description: "Ломаная мансардная кровля" },
  { kind: "drainage",        group: "Кровля",    label: "Водосточная система",  icon: "Droplets",     color: "#ef4444", description: "Желоба, трубы, воронки, держатели" },
  // Электрика
  { kind: "elec_power",     group: "Электрика", label: "Электроснабжение",     icon: "Zap",          color: "#eab308", description: "Ввод, кабели питания, заземление" },
  { kind: "elec_equipment", group: "Электрика", label: "Силовое оборудование", icon: "CircuitBoard",  color: "#eab308", description: "Щиты, автоматы, УЗО, розетки" },
  { kind: "elec_lighting",  group: "Электрика", label: "Электроосвещение",     icon: "Lightbulb",    color: "#eab308", description: "Светильники, выключатели, кабели освещения" },
];

const GROUP_ORDER = ["Фундамент", "Стены", "Перекрытия", "Проёмы", "Кровля", "Электрика"];
const GROUP_COLORS: Record<string, string> = {
  "Фундамент":  "#3b82f6",
  "Стены":      "#f59e0b",
  "Перекрытия": "#a855f7",
  "Проёмы":     "#10b981",
  "Кровля":     "#ef4444",
  "Электрика":  "#eab308",
};

// ─── Дефолтные параметры по виду ─────────────────────────────────────────────

function defaultParams(kind: ElementKind, info: ObjectInfo): Record<string, number | string | boolean> {
  const wallLen = info.ext_wall_thickness > 0 ? 0 : 0; // placeholder
  const area = info.house_area || 0;
  const floors = info.floors || 1;
  const ceilH = info.ceiling_height || 3;

  switch (kind) {
    case "screw_pile":
      return { diameter_stem: 0.108, stem_thickness: 4, blade_diameter: 0.3, blade_thickness: 8, capacity: 3, length: 2.5, weight: 60, pile_step: 2.5, wall_len_ext: wallLen, wall_len_int: 0 };
    case "bored_pile":
      return { diameter: 0.3, length: 3, rebar_count: 6, rebar_dia: 12, rebar_overlap: 0.4, stirrup_dia: 8, stirrup_step: 0.2, pile_step: 2.5, wall_len_ext: wallLen, wall_len_int: 0 };
    case "driven_pile":
      return { length: 6, width: 0.3, thickness: 0.3, mark: "С60.30", pile_step: 2, wall_len_ext: wallLen, wall_len_int: 0 };
    case "strip_foundation":
      return { width: 0.5, height: 0.8, height_above: 0.2, rebar_dia: 12, rebar_count: 4, stirrup_dia: 8, stirrup_step: 0.3, backfill_material: "Щебень", backfill_thickness: 0.1, wall_len_ext: wallLen, wall_len_int: 0 };
    case "slab_foundation":
      return { area: area || 100, thickness: 0.2, mesh_count: 2, mesh_step: 0.2, rebar_dia: 12, backfill_material: "Щебень", backfill_thickness: 0.1 };
    case "wall_layer":
      return { wall_len: wallLen || 0, wall_height: ceilH * floors, layers_json: "[]", wall_type: "Внешняя несущая" };
    case "jb_belt":
      return { width: 0.3, height: 0.2, rebar_dia: 12, rebar_count: 4, stirrup_dia: 8, stirrup_step: 0.2, wall_len: wallLen || 0 };
    case "floor_slab_deck":
      return { area: area || 0, slab_thickness: 0.12, deck_thickness: 0.8, rebar_dia: 10, mesh_step: 0.2, concrete_class: "B25" };
    case "floor_slab_hollow":
      return { area: area || 0, slab_thickness: 0.22 };
    case "floor_slab_mono":
      return { area: area || 0, thickness: 0.2, mesh_count: 2, rebar_dia: 12, mesh_step: 0.2, concrete_class: "B25" };
    case "floor_slab_wood":
      return { area: area || 0, beam_section_w: 0.1, beam_section_h: 0.2, beam_step: 0.6 };
    case "window":
      return { width: 1.2, height: 1.4, material: "ПВХ", profile_thickness: 70, chambers: 2, leaves: 2, opening: "Откидное", count: 1, floor: 1 };
    case "door":
      return { width: 0.9, height: 2.1, type: "Входная", material: "Металл", count: 1, floor: 1 };
    case "roof_pitched":
      return { roof_area: area ? area * 1.25 : 0, slope_angle: 35, roofing_material: "Металлочерепица", insulation_thickness: 0.15, rafter_section_w: 0.05, rafter_section_h: 0.2, rafter_step: 0.6, ridge_len: 0, eaves_len: 0 };
    case "roof_flat":
      return { roof_area: area || 0, roofing_material: "Мембрана ПВХ", insulation_thickness: 0.2, screed_thickness: 0.05, slope_layer: "Керамзит" };
    case "roof_mansard":
      return { roof_area: area ? area * 1.4 : 0, roofing_material: "Металлочерепица", insulation_thickness: 0.2, rafter_section_w: 0.05, rafter_section_h: 0.2, rafter_step: 0.6 };
    case "drainage":
      return { eaves_perimeter: 0, material: "Сталь оцинкованная", gutter_dia: 125, pipe_dia: 90, downpipe_count: 2, gutter_color: "RAL 8017 Коричневый" };
    case "elec_power":
      return { house_area: area || 0, cable_type: "ВВГнг-LS", input_cable_section: 16, input_cable_len: 25, grounding_type: "TN-C-S", ground_electrode_count: 3, ground_electrode_len: 3, input_power_kw: 15 };
    case "elec_equipment":
      return { house_area: area || 0, rooms: info.bedrooms + info.bathrooms + 2 || 5, panel_phases: 1, circuit_count: 12, socket_count_per_room: 4, switch_count_per_room: 2, has_bathroom_uzo: true };
    case "elec_lighting":
      return { house_area: area || 0, rooms: info.bedrooms + info.bathrooms + 2 || 5, lamp_type: "LED", lamp_count_per_room: 4, cable_section: 1.5, switch_type: "Одноклавишный" };
    default:
      return {};
  }
}

// ─── Расчёт ВОР для каждого элемента ─────────────────────────────────────────

function calcVor(kind: ElementKind, p: Record<string, number | string | boolean>): VorRow[] {
  const id = () => Math.random().toString(36).slice(2);
  const n = (k: string) => Number(p[k]) || 0;

  switch (kind) {

    case "screw_pile": {
      const wallLen = n("wall_len_ext") + n("wall_len_int");
      const step = n("pile_step") || 2.5;
      const count = wallLen > 0 ? Math.ceil(wallLen / step) : 0;
      const length = n("length");
      return [
        { id: id(), section: "Фундамент", name: `Свая винтовая Ø${n("diameter_stem")*1000}×${n("stem_thickness")} L=${length}м`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Фундамент", name: "Монтаж свай винтовых", unit: "шт", qty: count, note: `L=${length}м`, is_work: true },
      ];
    }

    case "bored_pile": {
      const wallLen = n("wall_len_ext") + n("wall_len_int");
      const step = n("pile_step") || 2.5;
      const count = wallLen > 0 ? Math.ceil(wallLen / step) : 0;
      const dia = n("diameter");
      const len = n("length");
      const vol1 = Math.PI * (dia/2) ** 2 * len;
      const volTotal = vol1 * count;
      const rebarDia = n("rebar_dia");
      const rebarLen = len + n("rebar_overlap");
      const rebarCount = n("rebar_count");
      const rebarTotal = rebarLen * rebarCount * count;
      const stirrupCirc = Math.PI * dia;
      const stirrupCount = Math.ceil(len / n("stirrup_step"));
      const stirrupTotal = stirrupCirc * stirrupCount * count;
      const rebarWeightPer = rebarDia === 12 ? 0.888 : rebarDia === 14 ? 1.208 : rebarDia === 16 ? 1.578 : 0.617;
      const stirrupWeightPer = n("stirrup_dia") === 8 ? 0.395 : 0.617;
      return [
        { id: id(), section: "Фундамент", name: `Бетон ${n("concrete_class") || "B25"} (сваи Ø${dia*1000})`, unit: "м³", qty: +volTotal.toFixed(3), is_work: false },
        { id: id(), section: "Фундамент", name: `Арматура основная Ø${rebarDia} А500С`, unit: "т", qty: +(rebarTotal * rebarWeightPer / 1000).toFixed(3), note: `${rebarTotal.toFixed(1)} п.м`, is_work: false },
        { id: id(), section: "Фундамент", name: `Арматура хомут Ø${n("stirrup_dia")} А240`, unit: "т", qty: +(stirrupTotal * stirrupWeightPer / 1000).toFixed(3), note: `${stirrupTotal.toFixed(1)} п.м`, is_work: false },
        { id: id(), section: "Фундамент", name: `Бурение скважин Ø${dia*1000}мм`, unit: "м", qty: +(len * count).toFixed(1), is_work: true },
        { id: id(), section: "Фундамент", name: "Бетонирование буронабивных свай", unit: "м³", qty: +volTotal.toFixed(3), is_work: true },
      ];
    }

    case "driven_pile": {
      const wallLen = n("wall_len_ext") + n("wall_len_int");
      const step = n("pile_step") || 2;
      const count = wallLen > 0 ? Math.ceil(wallLen / step) : 0;
      const length = n("length");
      return [
        { id: id(), section: "Фундамент", name: `Свая забивная ${p["mark"]} ${n("width")*1000}×${n("thickness")*1000} L=${length}м`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Фундамент", name: "Погружение свай", unit: "м", qty: +(length * count).toFixed(1), note: `${count} свай по ${length}м`, is_work: true },
      ];
    }

    case "strip_foundation": {
      const totalLen = n("wall_len_ext") + n("wall_len_int");
      const w = n("width");
      const h = n("height");
      const hAbove = n("height_above");
      const hBelow = h - hAbove;
      const vol = totalLen * w * h;
      const rebarDia = n("rebar_dia");
      const rebarCount = n("rebar_count");
      const overlap = rebarDia <= 12 ? 0.48 : 0.56;
      const rawLen = totalLen * rebarCount;
      const rebarLen = rawLen * (1 + overlap / 11.7);
      const rebarWeightPer = rebarDia === 12 ? 0.888 : rebarDia === 14 ? 1.208 : rebarDia === 16 ? 1.578 : 0.617;
      const stirrupDia = n("stirrup_dia");
      const stirrupCirc = 2 * (w + h) + 0.1;
      const stirrupCount = Math.ceil(totalLen / n("stirrup_step"));
      const stirrupLen = stirrupCirc * stirrupCount;
      const stirrupWeightPer = stirrupDia === 8 ? 0.395 : 0.617;
      const hydro = 2 * (h + w) * totalLen;
      const backfillVol = totalLen * w * n("backfill_thickness");
      const earthVol = totalLen * (w + 0.2) * (hBelow + n("backfill_thickness"));
      return [
        { id: id(), section: "Фундамент", name: "Бетон B25 (лента)", unit: "м³", qty: +vol.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: `Арматура Ø${rebarDia} А500С (лента)`, unit: "т", qty: +(rebarLen * rebarWeightPer / 1000).toFixed(3), note: `${rebarLen.toFixed(1)} п.м`, is_work: false },
        { id: id(), section: "Фундамент", name: `Хомут Ø${stirrupDia} А240 (лента)`, unit: "т", qty: +(stirrupLen * stirrupWeightPer / 1000).toFixed(3), note: `${stirrupLen.toFixed(1)} п.м`, is_work: false },
        { id: id(), section: "Фундамент", name: `Подсыпка ${p["backfill_material"]}`, unit: "м³", qty: +backfillVol.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: "Гидроизоляция ленты (рулонная)", unit: "м²", qty: +hydro.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: "Земляные работы (траншея)", unit: "м³", qty: +earthVol.toFixed(2), is_work: true },
        { id: id(), section: "Фундамент", name: "Устройство ленточного фундамента", unit: "м³", qty: +vol.toFixed(2), is_work: true },
        { id: id(), section: "Фундамент", name: "Послойная трамбовка подсыпки", unit: "м³", qty: +backfillVol.toFixed(2), is_work: true },
      ];
    }

    case "slab_foundation": {
      const area = n("area");
      const thick = n("thickness");
      const vol = area * thick;
      const meshCount = n("mesh_count");
      const meshStep = n("mesh_step") || 0.2;
      const rebarDia = n("rebar_dia");
      const rowsX = Math.ceil(Math.sqrt(area) / meshStep);
      const rowsY = rowsX;
      const rebarLen = (rowsX + rowsY) * Math.sqrt(area) * meshCount;
      const weightPer = rebarDia === 12 ? 0.888 : rebarDia === 14 ? 1.208 : 0.617;
      const hydro = area * 1.1;
      const backfillVol = area * n("backfill_thickness");
      return [
        { id: id(), section: "Фундамент", name: `Бетон B25 (плита h=${thick*100}см)`, unit: "м³", qty: +vol.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: `Арматура Ø${rebarDia} А500С (плита)`, unit: "т", qty: +(rebarLen * weightPer / 1000).toFixed(3), note: `${rebarLen.toFixed(0)} п.м`, is_work: false },
        { id: id(), section: "Фундамент", name: `Подсыпка ${p["backfill_material"]}`, unit: "м³", qty: +backfillVol.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: "Гидроизоляция под плитой", unit: "м²", qty: +hydro.toFixed(2), is_work: false },
        { id: id(), section: "Фундамент", name: "Устройство монолитной плиты", unit: "м³", qty: +vol.toFixed(2), is_work: true },
        { id: id(), section: "Фундамент", name: "Послойная трамбовка подсыпки", unit: "м³", qty: +backfillVol.toFixed(2), is_work: true },
      ];
    }

    case "wall_layer": {
      const wallLen = n("wall_len");
      const wallH = n("wall_height");
      let layers: { name: string; thickness: number }[] = [];
      try { layers = JSON.parse(String(p["layers_json"] || "[]")); } catch { layers = []; }
      const rows: VorRow[] = [];
      for (const layer of layers) {
        if (!layer.name || !layer.thickness) continue;
        const vol = wallLen * wallH * layer.thickness;
        rows.push({ id: id(), section: "Стены", name: layer.name, unit: "м³", qty: +vol.toFixed(2), note: `т=${layer.thickness*1000}мм`, is_work: false });
      }
      if (wallLen > 0 && wallH > 0) {
        rows.push({ id: id(), section: "Стены", name: `Кладка стен (${p["wall_type"]})`, unit: "м²", qty: +(wallLen * wallH).toFixed(2), is_work: true });
        const hydroArea = wallLen * (layers.reduce((s, l) => s + l.thickness, 0) + 0.1);
        rows.push({ id: id(), section: "Стены", name: "Гидроизоляция под стену (рулонная)", unit: "м²", qty: +hydroArea.toFixed(2), is_work: false });
      }
      return rows;
    }

    case "jb_belt": {
      const wallLen = n("wall_len");
      const w = n("width");
      const h = n("height");
      const vol = wallLen * w * h;
      const rebarDia = n("rebar_dia");
      const rebarCount = n("rebar_count");
      const rebarLen = wallLen * rebarCount * 1.1;
      const weightPer = rebarDia === 12 ? 0.888 : rebarDia === 14 ? 1.208 : 0.617;
      const stirrupCirc = 2 * (w + h) + 0.1;
      const stirrupCount = Math.ceil(wallLen / n("stirrup_step"));
      const stirrupLen = stirrupCirc * stirrupCount;
      const stirrupWeight = stirrupLen * (n("stirrup_dia") === 8 ? 0.395 : 0.617) / 1000;
      return [
        { id: id(), section: "Стены", name: "Бетон B25 (ЖБ пояс)", unit: "м³", qty: +vol.toFixed(2), is_work: false },
        { id: id(), section: "Стены", name: `Арматура Ø${rebarDia} А500С (пояс)`, unit: "т", qty: +(rebarLen * weightPer / 1000).toFixed(3), is_work: false },
        { id: id(), section: "Стены", name: `Хомут Ø${n("stirrup_dia")} (пояс)`, unit: "т", qty: +stirrupWeight.toFixed(3), is_work: false },
        { id: id(), section: "Стены", name: "Устройство ЖБ пояса", unit: "м³", qty: +vol.toFixed(2), is_work: true },
      ];
    }

    case "floor_slab_deck": {
      const area = n("area");
      const thick = n("slab_thickness");
      const deckThick = n("deck_thickness");
      const vol = area * thick;
      const rebarDia = n("rebar_dia");
      const meshStep = n("mesh_step") || 0.2;
      const rows = Math.ceil(Math.sqrt(area) / meshStep) * 2;
      const rebarLen = rows * Math.sqrt(area);
      const weightPer = rebarDia === 10 ? 0.617 : rebarDia === 12 ? 0.888 : 0.617;
      return [
        { id: id(), section: "Перекрытие", name: `Профлист δ=${deckThick}мм`, unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Перекрытие", name: `Бетон ${p["concrete_class"]} (плита по опалубке)`, unit: "м³", qty: +vol.toFixed(2), is_work: false },
        { id: id(), section: "Перекрытие", name: `Арматура Ø${rebarDia} А500С`, unit: "т", qty: +(rebarLen * weightPer / 1000).toFixed(3), is_work: false },
        { id: id(), section: "Перекрытие", name: "Устройство плиты по несъёмной опалубке", unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "floor_slab_hollow": {
      const area = n("area");
      return [
        { id: id(), section: "Перекрытие", name: `Плита многопустотная h=${n("slab_thickness")*100}см`, unit: "м²", qty: +(area * 1.02).toFixed(2), note: "включая обрезку", is_work: false },
        { id: id(), section: "Перекрытие", name: "Монтаж многопустотных плит", unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "floor_slab_mono": {
      const area = n("area");
      const thick = n("thickness");
      const vol = area * thick;
      const meshCount = n("mesh_count");
      const meshStep = n("mesh_step") || 0.2;
      const rebarDia = n("rebar_dia");
      const rows = Math.ceil(Math.sqrt(area) / meshStep) * 2;
      const rebarLen = rows * Math.sqrt(area) * meshCount;
      const weightPer = rebarDia === 12 ? 0.888 : 0.617;
      return [
        { id: id(), section: "Перекрытие", name: `Бетон ${p["concrete_class"]} (монолит h=${thick*100}см)`, unit: "м³", qty: +vol.toFixed(2), is_work: false },
        { id: id(), section: "Перекрытие", name: `Арматура Ø${rebarDia} А500С`, unit: "т", qty: +(rebarLen * weightPer / 1000).toFixed(3), is_work: false },
        { id: id(), section: "Перекрытие", name: "Опалубка инвентарная", unit: "м²", qty: +area.toFixed(2), is_work: true },
        { id: id(), section: "Перекрытие", name: "Бетонирование монолитной плиты", unit: "м³", qty: +vol.toFixed(2), is_work: true },
      ];
    }

    case "floor_slab_wood": {
      const area = n("area");
      const bW = n("beam_section_w");
      const bH = n("beam_section_h");
      const bStep = n("beam_step") || 0.6;
      const beamLen = Math.sqrt(area);
      const beamCount = Math.ceil(area / bStep / beamLen);
      const beamVol = bW * bH * beamLen * beamCount;
      return [
        { id: id(), section: "Перекрытие", name: `Балка деревянная ${bW*1000}×${bH*1000}мм`, unit: "м³", qty: +beamVol.toFixed(3), note: `${beamCount} шт`, is_work: false },
        { id: id(), section: "Перекрытие", name: "Монтаж деревянных балок перекрытия", unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "window": {
      const count = n("count");
      const w = n("width");
      const h = n("height");
      const area = w * h * count;
      const lintelLen = (w + 0.3) * count;
      return [
        { id: id(), section: "Проёмы", name: `Окно ${p["material"]} ${w*1000}×${h*1000} (${p["leaves"]}ств., ${p["chambers"]}кам.)`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Проёмы", name: `Перемычка оконная L=${((w+0.3)*1000).toFixed(0)}мм`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Проёмы", name: "Монтаж оконных блоков", unit: "м²", qty: +area.toFixed(2), note: `${count} шт`, is_work: true },
        { id: id(), section: "Проёмы", name: "Установка перемычек оконных", unit: "п.м", qty: +lintelLen.toFixed(2), is_work: true },
      ];
    }

    case "door": {
      const count = n("count");
      const w = n("width");
      const h = n("height");
      const area = w * h * count;
      const lintelLen = (w + 0.3) * count;
      return [
        { id: id(), section: "Проёмы", name: `Дверь ${p["type"]} ${p["material"]} ${w*1000}×${h*1000}мм`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Проёмы", name: `Перемычка дверная L=${((w+0.3)*1000).toFixed(0)}мм`, unit: "шт", qty: count, is_work: false },
        { id: id(), section: "Проёмы", name: "Монтаж дверных блоков", unit: "м²", qty: +area.toFixed(2), note: `${count} шт`, is_work: true },
        { id: id(), section: "Проёмы", name: "Установка перемычек дверных", unit: "п.м", qty: +lintelLen.toFixed(2), is_work: true },
      ];
    }

    case "roof_pitched": {
      const area = n("roof_area");
      const rafterW = n("rafter_section_w");
      const rafterH = n("rafter_section_h");
      const rafterStep = n("rafter_step") || 0.6;
      const insul = n("insulation_thickness");
      const rafterCount = area > 0 ? Math.ceil(Math.sqrt(area) / rafterStep) * 2 : 0;
      const rafterLen = Math.sqrt(area / 2) / Math.cos((n("slope_angle") * Math.PI) / 180);
      const rafterVol = rafterW * rafterH * rafterLen * rafterCount;
      return [
        { id: id(), section: "Кровля", name: `Кровельное покрытие ${p["roofing_material"]}`, unit: "м²", qty: +(area * 1.05).toFixed(2), note: "с учётом нахлёста", is_work: false },
        { id: id(), section: "Кровля", name: `Утеплитель кровли δ=${insul * 1000}мм`, unit: "м²", qty: +area.toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Гидро-ветрозащитная плёнка", unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Пароизоляционная плёнка", unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Стропила ${rafterW * 1000}×${rafterH * 1000}мм`, unit: "м³", qty: +rafterVol.toFixed(3), note: `${rafterCount} шт`, is_work: false },
        { id: id(), section: "Кровля", name: "Обрешётка (доска 25×100мм)", unit: "м²", qty: +area.toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Монтаж кровельного покрытия ${p["roofing_material"]}`, unit: "м²", qty: +area.toFixed(2), is_work: true },
        { id: id(), section: "Кровля", name: "Устройство стропильной системы", unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "roof_flat": {
      const area = n("roof_area");
      const insul = n("insulation_thickness");
      const screed = n("screed_thickness");
      const screedVol = area * screed;
      return [
        { id: id(), section: "Кровля", name: `Кровельная мембрана (${p["roofing_material"]})`, unit: "м²", qty: +(area * 1.1).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Утеплитель плоской кровли δ=${insul * 1000}мм`, unit: "м²", qty: +area.toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Уклонообразующий слой (${p["slope_layer"]})`, unit: "м³", qty: +(area * 0.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Цементно-песчаная стяжка кровли", unit: "м³", qty: +screedVol.toFixed(3), is_work: false },
        { id: id(), section: "Кровля", name: "Пароизоляционная плёнка", unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Устройство плоской кровли (мембрана)", unit: "м²", qty: +area.toFixed(2), is_work: true },
        { id: id(), section: "Кровля", name: "Устройство теплоизоляции кровли", unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "roof_mansard": {
      const area = n("roof_area");
      const rafterW = n("rafter_section_w");
      const rafterH = n("rafter_section_h");
      const rafterStep = n("rafter_step") || 0.6;
      const insul = n("insulation_thickness");
      const rafterCount = area > 0 ? Math.ceil(Math.sqrt(area) / rafterStep) * 2 : 0;
      const rafterLen = Math.sqrt(area / 2);
      const rafterVol = rafterW * rafterH * rafterLen * rafterCount;
      return [
        { id: id(), section: "Кровля", name: `Кровельное покрытие ${p["roofing_material"]} (мансарда)`, unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Утеплитель мансарды δ=${insul * 1000}мм`, unit: "м²", qty: +area.toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Гидро-ветрозащитная плёнка", unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Пароизоляционная плёнка", unit: "м²", qty: +(area * 1.05).toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: `Стропила мансарды ${rafterW * 1000}×${rafterH * 1000}мм`, unit: "м³", qty: +rafterVol.toFixed(3), note: `${rafterCount} шт`, is_work: false },
        { id: id(), section: "Кровля", name: "Обрешётка мансардная", unit: "м²", qty: +area.toFixed(2), is_work: false },
        { id: id(), section: "Кровля", name: "Монтаж стропильной системы мансарды", unit: "м²", qty: +area.toFixed(2), is_work: true },
        { id: id(), section: "Кровля", name: `Монтаж кровли ${p["roofing_material"]}`, unit: "м²", qty: +area.toFixed(2), is_work: true },
      ];
    }

    case "drainage": {
      const perim = n("eaves_perimeter");
      const pipes = n("downpipe_count") || 2;
      const floorH = 3;
      const floors = 2;
      const pipeLen = pipes * floorH * floors;
      const bracketCount = Math.ceil(perim / 0.6);
      const clampCount = pipes * Math.ceil(floorH * floors / 1.5);
      const funnelCount = pipes;
      const capCount = Math.ceil(perim / 6) * 2;
      return [
        { id: id(), section: "Водосток", name: `Желоб Ø${n("gutter_dia")}мм (${p["material"]})`, unit: "п.м", qty: +(perim * 1.05).toFixed(2), note: "с нахлёстом", is_work: false },
        { id: id(), section: "Водосток", name: `Труба водосточная Ø${n("pipe_dia")}мм`, unit: "п.м", qty: +pipeLen.toFixed(2), note: `${pipes} труб`, is_work: false },
        { id: id(), section: "Водосток", name: "Держатель желоба", unit: "шт", qty: bracketCount, is_work: false },
        { id: id(), section: "Водосток", name: "Кронштейн трубы", unit: "шт", qty: clampCount, is_work: false },
        { id: id(), section: "Водосток", name: "Воронка водосборная", unit: "шт", qty: funnelCount, is_work: false },
        { id: id(), section: "Водосток", name: "Заглушка желоба", unit: "шт", qty: capCount, is_work: false },
        { id: id(), section: "Водосток", name: "Угол желоба 90°", unit: "шт", qty: Math.ceil(perim / 10) + 2, is_work: false },
        { id: id(), section: "Водосток", name: "Монтаж водосточной системы", unit: "п.м", qty: +(perim + pipeLen).toFixed(2), is_work: true },
      ];
    }

    case "elec_power": {
      const cableLen = n("input_cable_len");
      const cableSection = n("input_cable_section");
      const electrodeCount = n("ground_electrode_count");
      const electrodeLen = n("ground_electrode_len");
      const stripLen = electrodeCount * 1.5 + 6;
      return [
        { id: id(), section: "Электроснабжение", name: `Кабель вводной ${p["cable_type"]} ${cableSection}мм² (ввод в дом)`, unit: "п.м", qty: +cableLen.toFixed(1), is_work: false },
        { id: id(), section: "Электроснабжение", name: `Электрод заземления Ø16мм L=${electrodeLen}м`, unit: "шт", qty: electrodeCount, is_work: false },
        { id: id(), section: "Электроснабжение", name: "Полоса заземления 40×4мм", unit: "п.м", qty: +stripLen.toFixed(1), is_work: false },
        { id: id(), section: "Электроснабжение", name: "Муфта соединительная герметичная", unit: "шт", qty: 2, is_work: false },
        { id: id(), section: "Электроснабжение", name: `Прокладка вводного кабеля ${p["cable_type"]} ${cableSection}мм²`, unit: "п.м", qty: +cableLen.toFixed(1), is_work: true },
        { id: id(), section: "Электроснабжение", name: `Устройство контура заземления (${p["grounding_type"]})`, unit: "компл", qty: 1, is_work: true },
        { id: id(), section: "Электроснабжение", name: "Монтаж вводно-распределительного устройства (ВРУ)", unit: "шт", qty: 1, is_work: true },
      ];
    }

    case "elec_equipment": {
      const circuits = n("circuit_count");
      const rooms = n("rooms") || 5;
      const socketCount = n("socket_count_per_room") * rooms;
      const switchCount = n("switch_count_per_room") * rooms;
      const phases = n("panel_phases");
      const cableLen = socketCount * 8;
      return [
        { id: id(), section: "Силовое оборудование", name: `Щит распределительный ${phases}ф на ${circuits} групп`, unit: "шт", qty: 1, is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Автоматический выключатель 16А", unit: "шт", qty: circuits, is_work: false },
        { id: id(), section: "Силовое оборудование", name: "УЗО 25А/30мА (ванные, кухня)", unit: "шт", qty: Math.ceil(rooms / 3), is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Розетка 2P+E 16А (IP20)", unit: "шт", qty: socketCount, is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Розетка влагозащищённая IP44 (ванная)", unit: "шт", qty: Math.ceil(rooms * 0.2), is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Кабель ВВГнг-LS 3×2.5мм² (розеточные группы)", unit: "п.м", qty: +cableLen.toFixed(0), is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Гофротруба ПВХ 20мм", unit: "п.м", qty: +(cableLen * 1.1).toFixed(0), is_work: false },
        { id: id(), section: "Силовое оборудование", name: "Монтаж щита распределительного", unit: "шт", qty: 1, is_work: true },
        { id: id(), section: "Силовое оборудование", name: "Установка розеток", unit: "шт", qty: socketCount, is_work: true },
        { id: id(), section: "Силовое оборудование", name: "Прокладка кабеля розеточных групп", unit: "п.м", qty: +cableLen.toFixed(0), is_work: true },
      ];
    }

    case "elec_lighting": {
      const rooms = n("rooms") || 5;
      const lampsPerRoom = n("lamp_count_per_room");
      const totalLamps = lampsPerRoom * rooms;
      const switchCount = rooms;
      const cableLen = totalLamps * 5;
      return [
        { id: id(), section: "Электроосвещение", name: `Светильник потолочный ${p["lamp_type"]} (встраиваемый)`, unit: "шт", qty: totalLamps, is_work: false },
        { id: id(), section: "Электроосвещение", name: `Выключатель ${p["switch_type"]}`, unit: "шт", qty: switchCount, is_work: false },
        { id: id(), section: "Электроосвещение", name: `Кабель ВВГнг-LS 3×${n("cable_section")}мм² (освещение)`, unit: "п.м", qty: +cableLen.toFixed(0), is_work: false },
        { id: id(), section: "Электроосвещение", name: "Гофротруба ПВХ 16мм", unit: "п.м", qty: +(cableLen * 1.05).toFixed(0), is_work: false },
        { id: id(), section: "Электроосвещение", name: "Клеммная колодка (распред. коробка)", unit: "шт", qty: rooms * 2, is_work: false },
        { id: id(), section: "Электроосвещение", name: "Монтаж светильников", unit: "шт", qty: totalLamps, is_work: true },
        { id: id(), section: "Электроосвещение", name: "Установка выключателей", unit: "шт", qty: switchCount, is_work: true },
        { id: id(), section: "Электроосвещение", name: "Прокладка кабеля осветительных групп", unit: "п.м", qty: +cableLen.toFixed(0), is_work: true },
      ];
    }

    default:
      return [];
  }
}

// ─── Формы параметров по виду ────────────────────────────────────────────────

function ParamField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</div>
      {children}
    </div>
  );
}

const inp = "w-full px-2.5 py-2 rounded-lg text-sm text-white outline-none";
const inpSty = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" };
const selSty = { ...inpSty, background: "#1a2235" };

function numField(label: string, key: string, unit: string, p: Record<string, number|string|boolean>, upd: (k: string, v: number|string|boolean) => void) {
  return (
    <ParamField key={key} label={`${label} (${unit})`}>
      <div className="relative">
        <input type="number" value={Number(p[key]) || ""} onChange={e => upd(key, +e.target.value)}
          className={inp} style={{ ...inpSty, paddingRight: "2.5rem" }} />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{unit}</span>
      </div>
    </ParamField>
  );
}

// Слои стен
function WallLayersEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [layers, setLayers] = useState<{ name: string; thickness: number }[]>(() => {
    try { return JSON.parse(value || "[]"); } catch { return []; }
  });

  const push = () => { const n = [...layers, { name: "", thickness: 0.1 }]; setLayers(n); onChange(JSON.stringify(n)); };
  const upd = (i: number, k: "name" | "thickness", v: string | number) => {
    const n = layers.map((l, j) => j === i ? { ...l, [k]: v } : l);
    setLayers(n); onChange(JSON.stringify(n));
  };
  const del = (i: number) => { const n = layers.filter((_, j) => j !== i); setLayers(n); onChange(JSON.stringify(n)); };

  return (
    <div>
      <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>Слои стены (снаружи → внутри)</div>
      <div className="space-y-1.5 mb-2">
        {layers.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 font-bold" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>{i+1}</div>
            <input value={l.name} onChange={e => upd(i, "name", e.target.value)}
              placeholder="Материал (напр. Газоблок D400)" className={`flex-1 ${inp}`} style={inpSty} />
            <div className="relative w-24 flex-shrink-0">
              <input type="number" value={l.thickness || ""} onChange={e => upd(i, "thickness", +e.target.value)}
                step="0.01" className={inp} style={{ ...inpSty, paddingRight: "2.2rem" }} />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>м</span>
            </div>
            <button onClick={() => del(i)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20" style={{ color: "rgba(255,255,255,0.3)" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={push} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:scale-105"
        style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px dashed rgba(245,158,11,0.3)" }}>
        <Icon name="Plus" size={12} /> Добавить слой
      </button>
    </div>
  );
}

function ElementParamsForm({ el, onUpdate }: {
  el: PlacedElement;
  onUpdate: (params: Record<string, number | string | boolean>) => void;
}) {
  const p = el.params;
  const upd = (k: string, v: number | string | boolean) => onUpdate({ ...p, [k]: v });

  const selField = (label: string, key: string, opts: string[]) => (
    <ParamField key={key} label={label}>
      <select value={String(p[key])} onChange={e => upd(key, e.target.value)} className={`${inp} text-sm`} style={selSty}>
        {opts.map(o => <option key={o} value={o} style={{ background: "#1a2235" }}>{o}</option>)}
      </select>
    </ParamField>
  );

  const sharedWall = (
    <div className="grid grid-cols-2 gap-2 pt-1 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="col-span-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>Длины стен (из вкладки 1 или вручную)</div>
      {numField("Длина внешних стен", "wall_len_ext", "м", p, upd)}
      {numField("Длина внутр. несущих", "wall_len_int", "м", p, upd)}
      {numField("Шаг свай", "pile_step", "м", p, upd)}
    </div>
  );

  switch (el.kind) {
    case "screw_pile":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Диаметр ствола", "diameter_stem", "м", p, upd)}
        {numField("Толщина ствола", "stem_thickness", "мм", p, upd)}
        {numField("Диаметр лопасти", "blade_diameter", "м", p, upd)}
        {numField("Толщина лопасти", "blade_thickness", "мм", p, upd)}
        {numField("Несущая способность", "capacity", "т", p, upd)}
        {numField("Длина сваи", "length", "м", p, upd)}
        <div className="col-span-2">{sharedWall}</div>
      </div>;

    case "bored_pile":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Диаметр сваи", "diameter", "м", p, upd)}
        {numField("Длина сваи", "length", "м", p, upd)}
        {numField("Кол-во осн. арматуры", "rebar_count", "шт", p, upd)}
        {numField("Диаметр осн. арматуры", "rebar_dia", "мм", p, upd)}
        {numField("Выпуск арматуры", "rebar_overlap", "м", p, upd)}
        {numField("Диаметр хомута", "stirrup_dia", "мм", p, upd)}
        {numField("Шаг хомута", "stirrup_step", "м", p, upd)}
        <div className="col-span-2">{sharedWall}</div>
      </div>;

    case "driven_pile":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Длина сваи", "length", "м", p, upd)}
        {numField("Ширина сваи", "width", "м", p, upd)}
        {numField("Толщина сваи", "thickness", "м", p, upd)}
        {selField("Марка сваи", "mark", ["С60.30","С80.30","С100.30","С120.35","Другая"])}
        <div className="col-span-2">{sharedWall}</div>
      </div>;

    case "strip_foundation":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Ширина ленты", "width", "м", p, upd)}
        {numField("Высота ленты", "height", "м", p, upd)}
        {numField("Высота над землёй", "height_above", "м", p, upd)}
        {numField("Ø осн. арматуры", "rebar_dia", "мм", p, upd)}
        {numField("Кол-во стержней", "rebar_count", "шт", p, upd)}
        {numField("Ø хомута", "stirrup_dia", "мм", p, upd)}
        {numField("Шаг хомута", "stirrup_step", "м", p, upd)}
        {selField("Материал подсыпки", "backfill_material", ["Щебень","Песок","ПГС","Гравий"])}
        {numField("Толщина подсыпки", "backfill_thickness", "м", p, upd)}
        <div className="col-span-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Длины стен (из вкладки 1 или вручную)</div>
          <div className="grid grid-cols-2 gap-2">
            {numField("Длина внешних стен", "wall_len_ext", "м", p, upd)}
            {numField("Длина внутр. несущих", "wall_len_int", "м", p, upd)}
          </div>
        </div>
      </div>;

    case "slab_foundation":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь плиты", "area", "м²", p, upd)}
        {numField("Толщина плиты", "thickness", "м", p, upd)}
        {numField("Кол-во сеток", "mesh_count", "шт", p, upd)}
        {numField("Шаг сетки", "mesh_step", "м", p, upd)}
        {numField("Ø арматуры", "rebar_dia", "мм", p, upd)}
        {selField("Материал подсыпки", "backfill_material", ["Щебень","Песок","ПГС","Гравий"])}
        {numField("Толщина подсыпки", "backfill_thickness", "м", p, upd)}
      </div>;

    case "wall_layer":
      return <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {selField("Вид стены", "wall_type", ["Внешняя несущая","Внутренняя несущая","Перегородка"])}
          {numField("Длина стен этого вида", "wall_len", "м", p, upd)}
          {numField("Высота стены", "wall_height", "м", p, upd)}
        </div>
        <WallLayersEditor value={String(p["layers_json"] || "[]")} onChange={v => upd("layers_json", v)} />
      </div>;

    case "jb_belt":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Ширина пояса", "width", "м", p, upd)}
        {numField("Высота пояса", "height", "м", p, upd)}
        {numField("Ø осн. арматуры", "rebar_dia", "мм", p, upd)}
        {numField("Кол-во стержней", "rebar_count", "шт", p, upd)}
        {numField("Ø хомута", "stirrup_dia", "мм", p, upd)}
        {numField("Шаг хомута", "stirrup_step", "м", p, upd)}
        {numField("Длина (периметр стен)", "wall_len", "м", p, upd)}
      </div>;

    case "floor_slab_deck":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь перекрытия", "area", "м²", p, upd)}
        {numField("Толщина плиты", "slab_thickness", "м", p, upd)}
        {numField("Толщина профлиста", "deck_thickness", "мм", p, upd)}
        {numField("Ø арматуры", "rebar_dia", "мм", p, upd)}
        {numField("Шаг армирования", "mesh_step", "м", p, upd)}
        {selField("Класс бетона", "concrete_class", ["B20","B25","B30"])}
      </div>;

    case "floor_slab_hollow":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь перекрытия", "area", "м²", p, upd)}
        {numField("Толщина плиты", "slab_thickness", "м", p, upd)}
      </div>;

    case "floor_slab_mono":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь перекрытия", "area", "м²", p, upd)}
        {numField("Толщина плиты", "thickness", "м", p, upd)}
        {numField("Кол-во сеток", "mesh_count", "шт", p, upd)}
        {numField("Ø арматуры", "rebar_dia", "мм", p, upd)}
        {numField("Шаг армирования", "mesh_step", "м", p, upd)}
        {selField("Класс бетона", "concrete_class", ["B20","B25","B30"])}
      </div>;

    case "floor_slab_wood":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь перекрытия", "area", "м²", p, upd)}
        {numField("Ширина балки", "beam_section_w", "м", p, upd)}
        {numField("Высота балки", "beam_section_h", "м", p, upd)}
        {numField("Шаг балок", "beam_step", "м", p, upd)}
      </div>;

    case "window":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Ширина окна", "width", "м", p, upd)}
        {numField("Высота окна", "height", "м", p, upd)}
        {selField("Материал профиля", "material", ["ПВХ","Алюминий","Дерево","Дерево-алюминий"])}
        {numField("Толщина профиля", "profile_thickness", "мм", p, upd)}
        {numField("Кол-во камер", "chambers", "шт", p, upd)}
        {numField("Кол-во створок", "leaves", "шт", p, upd)}
        {selField("Тип открывания", "opening", ["Откидное","Поворотно-откидное","Глухое","Раздвижное"])}
        {numField("Количество окон", "count", "шт", p, upd)}
        {numField("Этаж", "floor", "эт", p, upd)}
      </div>;

    case "door":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Ширина", "width", "м", p, upd)}
        {numField("Высота", "height", "м", p, upd)}
        {selField("Вид двери", "type", ["Входная","Межкомнатная","Техническая"])}
        {selField("Материал", "material", ["Металл","Дерево","МДФ","Стекло","Алюминий"])}
        {numField("Количество дверей", "count", "шт", p, upd)}
        {numField("Этаж", "floor", "эт", p, upd)}
      </div>;

    case "roof_pitched":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь кровли", "roof_area", "м²", p, upd)}
        {numField("Угол наклона", "slope_angle", "°", p, upd)}
        {selField("Кровельный материал", "roofing_material", ["Металлочерепица","Профнастил","Гибкая черепица","Керамическая черепица","Сланец","Фальцевая кровля"])}
        {numField("Толщина утеплителя", "insulation_thickness", "м", p, upd)}
        {numField("Сечение стропил (ш)", "rafter_section_w", "м", p, upd)}
        {numField("Сечение стропил (в)", "rafter_section_h", "м", p, upd)}
        {numField("Шаг стропил", "rafter_step", "м", p, upd)}
        {numField("Длина конька", "ridge_len", "м", p, upd)}
        {numField("Длина карниза", "eaves_len", "м", p, upd)}
      </div>;

    case "roof_flat":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь кровли", "roof_area", "м²", p, upd)}
        {selField("Кровельный материал", "roofing_material", ["Мембрана ПВХ","Мембрана ЭПДМ","Мембрана ТПО","Рулонная (еврорубероид)","Напыляемая гидроизоляция"])}
        {numField("Толщина утеплителя", "insulation_thickness", "м", p, upd)}
        {numField("Толщина стяжки", "screed_thickness", "м", p, upd)}
        {selField("Уклонообразующий слой", "slope_layer", ["Керамзит","Перлит","Клиновидный утеплитель","Бетонная стяжка"])}
      </div>;

    case "roof_mansard":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь кровли", "roof_area", "м²", p, upd)}
        {selField("Кровельный материал", "roofing_material", ["Металлочерепица","Профнастил","Гибкая черепица","Керамическая черепица","Фальцевая кровля"])}
        {numField("Толщина утеплителя", "insulation_thickness", "м", p, upd)}
        {numField("Сечение стропил (ш)", "rafter_section_w", "м", p, upd)}
        {numField("Сечение стропил (в)", "rafter_section_h", "м", p, upd)}
        {numField("Шаг стропил", "rafter_step", "м", p, upd)}
      </div>;

    case "drainage":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Периметр карниза", "eaves_perimeter", "п.м", p, upd)}
        {selField("Материал системы", "material", ["Сталь оцинкованная","Сталь с полимерным покрытием","Медь","Алюминий","Пластик ПВХ"])}
        {numField("Диаметр желоба", "gutter_dia", "мм", p, upd)}
        {numField("Диаметр трубы", "pipe_dia", "мм", p, upd)}
        {numField("Кол-во водосточных труб", "downpipe_count", "шт", p, upd)}
        {selField("Цвет", "gutter_color", ["RAL 8017 Коричневый","RAL 9003 Белый","RAL 7024 Графит","RAL 3005 Бордо","RAL 6005 Зелёный","RAL 8004 Медно-коричневый"])}
      </div>;

    case "elec_power":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь дома", "house_area", "м²", p, upd)}
        {numField("Мощность ввода", "input_power_kw", "кВт", p, upd)}
        {selField("Тип кабеля", "cable_type", ["ВВГнг-LS","NYM","КВВГнг","ВБбШв"])}
        {numField("Сечение вводного кабеля", "input_cable_section", "мм²", p, upd)}
        {numField("Длина вводного кабеля", "input_cable_len", "п.м", p, upd)}
        {selField("Схема заземления", "grounding_type", ["TN-C-S","TN-S","TT"])}
        {numField("Кол-во электродов заземления", "ground_electrode_count", "шт", p, upd)}
        {numField("Длина электрода", "ground_electrode_len", "м", p, upd)}
      </div>;

    case "elec_equipment":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь дома", "house_area", "м²", p, upd)}
        {numField("Количество комнат", "rooms", "шт", p, upd)}
        {selField("Фазность щита", "panel_phases", ["1","3"])}
        {numField("Кол-во групп в щите", "circuit_count", "гр", p, upd)}
        {numField("Розеток на комнату", "socket_count_per_room", "шт", p, upd)}
        {numField("Выключателей на комнату", "switch_count_per_room", "шт", p, upd)}
      </div>;

    case "elec_lighting":
      return <div className="grid grid-cols-2 gap-2">
        {numField("Площадь дома", "house_area", "м²", p, upd)}
        {numField("Количество комнат", "rooms", "шт", p, upd)}
        {selField("Тип светильника", "lamp_type", ["LED","Люминесцентный","Галогенный","Накаливания"])}
        {numField("Светильников на комнату", "lamp_count_per_room", "шт", p, upd)}
        {numField("Сечение кабеля", "cable_section", "мм²", p, upd)}
        {selField("Тип выключателя", "switch_type", ["Одноклавишный","Двухклавишный","Проходной","Диммер"])}
      </div>;

    default:
      return null;
  }
}

// ─── ВОР таблица ─────────────────────────────────────────────────────────────

function VorTable({ rows }: { rows: VorRow[] }) {
  if (!rows.length) return (
    <div className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.25)" }}>
      Заполните параметры — расчёт появится автоматически
    </div>
  );
  const materials = rows.filter(r => !r.is_work);
  const works = rows.filter(r => r.is_work);
  return (
    <div className="space-y-3">
      {[{ label: "Материалы", rows: materials, color: "#00D4FF" }, { label: "Работы", rows: works, color: "#FF6B1A" }]
        .filter(g => g.rows.length > 0)
        .map(g => (
          <div key={g.label}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5" style={{ color: g.color }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} /> {g.label}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>Наименование</th>
                    <th className="text-center px-2 py-2 font-medium w-12" style={{ color: "rgba(255,255,255,0.35)" }}>Ед.</th>
                    <th className="text-right px-3 py-2 font-medium w-16" style={{ color: "rgba(255,255,255,0.35)" }}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(r => (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-3 py-2 text-white">
                        {r.name}
                        {r.note && <span className="ml-1 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>({r.note})</span>}
                      </td>
                      <td className="px-2 py-2 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>{r.unit}</td>
                      <td className="px-3 py-2 text-right font-semibold font-mono" style={{ color: g.color }}>
                        {r.qty % 1 === 0 ? r.qty : r.qty.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── Карточка размещённого элемента ──────────────────────────────────────────

// ─── Редактор состава ВОР ─────────────────────────────────────────────────────

const UNITS_VOR = ["шт","м²","м³","п.м","м","кг","т","уп","компл","рул","л"];

function VorEditor({ rows, onChange }: {
  rows: VorRow[];
  onChange: (rows: VorRow[]) => void;
}) {
  const newId = () => Math.random().toString(36).slice(2);

  const addRow = (is_work: boolean) => {
    onChange([...rows, { id: newId(), section: rows[0]?.section || "Прочее", name: "", unit: "шт", qty: 0, is_work }]);
  };

  const upd = (id: string, patch: Partial<VorRow>) => {
    onChange(rows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const del = (id: string) => onChange(rows.filter(r => r.id !== id));

  const inp = "w-full px-2 py-1.5 rounded-lg text-xs text-white outline-none bg-transparent";
  const inpSty = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" };

  const materials = rows.filter(r => !r.is_work);
  const works = rows.filter(r => r.is_work);

  return (
    <div className="space-y-4">
      {[
        { label: "Материалы", items: materials, is_work: false, color: "#00D4FF" },
        { label: "Работы",    items: works,     is_work: true,  color: "#FF6B1A" },
      ].map(group => (
        <div key={group.label}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: group.color }}>{group.label}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>({group.items.length})</span>
            </div>
            <button onClick={() => addRow(group.is_work)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{ background: `${group.color}15`, color: group.color, border: `1px dashed ${group.color}44` }}>
              <Icon name="Plus" size={11} /> Добавить
            </button>
          </div>

          {group.items.length === 0 ? (
            <div className="text-xs py-3 text-center rounded-xl" style={{ border: "1px dashed rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }}>
              Нет позиций — нажмите «Добавить»
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>Наименование</th>
                    <th className="text-center px-1 py-2 font-medium w-20" style={{ color: "rgba(255,255,255,0.3)" }}>Ед.</th>
                    <th className="text-right px-2 py-2 font-medium w-20" style={{ color: "rgba(255,255,255,0.3)" }}>Кол-во</th>
                    <th className="w-7" />
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(r => (
                    <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.name}
                          onChange={e => upd(r.id, { name: e.target.value })}
                          placeholder="Наименование материала / работы"
                          className={inp} style={inpSty}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select value={r.unit} onChange={e => upd(r.id, { unit: e.target.value })}
                          className={inp} style={{ ...inpSty, background: "#1a2235" }}>
                          {UNITS_VOR.map(u => <option key={u} value={u} style={{ background: "#1a2235" }}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={r.qty || ""}
                          onChange={e => upd(r.id, { qty: +e.target.value })}
                          placeholder="0"
                          className={`${inp} text-right font-mono font-semibold`}
                          style={{ ...inpSty, color: group.color }}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button onClick={() => del(r.id)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                          style={{ color: "rgba(255,255,255,0.25)" }}>
                          <Icon name="X" size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Карточка размещённого элемента ──────────────────────────────────────────

function PlacedCard({
  el, libItem, onUpdate, onRemove, onRename, onVorOverride,
}: {
  el: PlacedElement;
  libItem: LibItem;
  onUpdate: (params: Record<string, number | string | boolean>) => void;
  onRemove: () => void;
  onRename: (label: string) => void;
  onVorOverride: (rows: VorRow[]) => void;
}) {
  const isCustom = el.kind === "custom";
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"params" | "vor" | "edit">(isCustom ? "edit" : "params");
  const [editingLabel, setEditingLabel] = useState(isCustom);
  const [labelBuf, setLabelBuf] = useState(el.label);

  // Если vor в элементе заполнен — используем его (кастомный), иначе считаем из параметров
  const calcedVor = calcVor(el.kind, el.params);
  const isOverridden = el.vor.length > 0;
  const vor = isOverridden ? el.vor : calcedVor;
  const hasData = vor.length > 0 && vor.some(r => r.qty > 0);

  const resetToCalc = () => onVorOverride([]);

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ border: `1px solid ${libItem.color}33`, background: "rgba(255,255,255,0.02)" }}>
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${libItem.color}0d` }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setOpen(v => !v)}
          style={{ background: `${libItem.color}20` }}>
          <Icon name={libItem.icon} size={15} style={{ color: libItem.color }} />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(v => !v)}>
          {editingLabel ? (
            <input autoFocus value={labelBuf}
              onChange={e => setLabelBuf(e.target.value)}
              onBlur={() => { onRename(labelBuf.trim() || el.label); setEditingLabel(false); }}
              onKeyDown={e => { if (e.key === "Enter") { onRename(labelBuf.trim() || el.label); setEditingLabel(false); } if (e.key === "Escape") { setLabelBuf(el.label); setEditingLabel(false); } }}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold text-white bg-transparent outline-none border-b w-full"
              style={{ borderColor: libItem.color }}
            />
          ) : (
            <div className="text-sm font-semibold text-white">{el.label}</div>
          )}
          {hasData && (
            <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span>{vor.filter(r => !r.is_work).length} матер. · {vor.filter(r => r.is_work).length} работ</span>
              {isOverridden && (
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontSize: 10 }}>
                  ✎ изменён
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasData && <div className="w-2 h-2 rounded-full mr-1" style={{ background: "#00FF88" }} title="Расчёт готов" />}
          <button onClick={e => { e.stopPropagation(); setLabelBuf(el.label); setEditingLabel(true); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }} title="Переименовать">
            <Icon name="Pencil" size={12} />
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            <Icon name="Trash2" size={13} />
          </button>
          <button onClick={() => setOpen(v => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10">
            <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
          </button>
        </div>
      </div>

      {/* Тело */}
      {open && (
        <div className="px-4 pb-4 pt-3">
          {/* Переключатель вкладок */}
          <div className="flex gap-1 p-0.5 rounded-lg mb-4 w-fit" style={{ background: "rgba(255,255,255,0.04)" }}>
            {(["params", "vor", "edit"] as const)
              .filter(t => !(isCustom && t === "params"))
              .map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: tab === t ? libItem.color : "transparent",
                    color: tab === t ? "#fff" : "rgba(255,255,255,0.45)",
                  }}>
                  {t === "params" ? "Параметры"
                    : t === "vor" ? `ВОР (${vor.length})`
                    : <span className="flex items-center gap-1"><Icon name="ListChecks" size={11} />Состав</span>}
                </button>
              ))}
          </div>

          {tab === "params" && <ElementParamsForm el={el} onUpdate={onUpdate} />}

          {tab === "vor" && <VorTable rows={vor} />}

          {tab === "edit" && (
            <div>
              {isOverridden && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  <span className="text-xs" style={{ color: "#FBBF24" }}>Состав изменён вручную</span>
                  <button onClick={resetToCalc}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24" }}>
                    Сбросить к расчёту
                  </button>
                </div>
              )}
              {!isOverridden && calcedVor.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Icon name="Info" size={13} style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Редактируете — состав будет сохранён независимо от параметров
                  </span>
                  <button onClick={() => onVorOverride([...calcedVor])}
                    className="ml-auto text-xs px-2.5 py-1 rounded-lg flex-shrink-0 transition-all hover:scale-105"
                    style={{ background: `${libItem.color}18`, color: libItem.color, border: `1px solid ${libItem.color}33` }}>
                    Начать редактирование
                  </button>
                </div>
              )}
              <VorEditor
                rows={isOverridden ? el.vor : []}
                onChange={rows => onVorOverride(rows)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Полная ВОР со сметой ─────────────────────────────────────────────────────

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }

const MATERIALS_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";

interface PriceMatch {
  vor_id: string;
  vor_name: string;
  matched_name: string | null;
  matched_unit: string;
  category: string;
  price: number | null;
  best_price: number | null;
  base_price: number | null;
  supplier_name: string | null;
  updated_at: string | null;
  score: number;
}

function FullVorTable({ rows, onPriceChange, token }: {
  rows: VorRow[];
  onPriceChange: (id: string, price: number) => void;
  token: string;
}) {
  const [showPrices, setShowPrices] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<PriceMatch[]>([]);
  const [matchMsg, setMatchMsg] = useState("");
  const sections = [...new Set(rows.map(r => r.section))];

  const fetchPricesFromDB = async () => {
    if (!rows.length) return;
    setMatching(true);
    setMatchMsg("");
    setMatchResults([]);
    const items = rows.map(r => ({ id: r.id, name: r.name, unit: r.unit }));
    const res = await fetch(`${MATERIALS_URL}?action=price_match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token },
      body: JSON.stringify({ items }),
    }).then(r => r.json());
    setMatching(false);
    const matches: PriceMatch[] = res.matches || [];
    setMatchResults(matches);
    const found = matches.filter(m => m.price && m.price > 0);
    if (found.length === 0) {
      setMatchMsg("Совпадений в базе не найдено — введите цены вручную");
      return;
    }
    setMatchMsg(`Найдено совпадений: ${found.length} из ${rows.length}`);
  };

  const applyAllMatched = () => {
    matchResults.forEach(m => {
      if (m.price && m.price > 0) onPriceChange(m.vor_id, m.price);
    });
    setMatchResults([]);
    setMatchMsg(`✓ Цены применены`);
  };

  const applyOne = (m: PriceMatch) => {
    if (m.price) onPriceChange(m.vor_id, m.price);
    setMatchResults(prev => prev.filter(r => r.vor_id !== m.vor_id));
  };

  const totalMat = rows.filter(r => !r.is_work).reduce((s, r) => s + r.qty * (r.price_per_unit || 0), 0);
  const totalWork = rows.filter(r => r.is_work).reduce((s, r) => s + r.qty * (r.price_per_unit || 0), 0);
  const totalAll = totalMat + totalWork;
  const hasPrices = rows.some(r => (r.price_per_unit || 0) > 0);

  const inp = "w-full px-2 py-1 rounded-lg text-xs text-right text-white outline-none font-mono";
  const inpSty = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  return (
    <div className="rounded-2xl overflow-hidden mt-6" style={{ border: "1px solid rgba(0,255,136,0.2)" }}>
      {/* Заголовок */}
      <div className="flex items-center justify-between px-5 py-4"
        style={{ background: "linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,212,255,0.05))", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,255,136,0.15)" }}>
            <Icon name="FileSpreadsheet" size={18} style={{ color: "#00FF88" }} />
          </div>
          <div>
            <div className="font-display font-bold text-white text-base">Ведомость объёмов работ</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {rows.length} позиций · {rows.filter(r => !r.is_work).length} материалов · {rows.filter(r => r.is_work).length} работ
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasPrices && (
            <div className="text-right">
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Итого смета</div>
              <div className="font-display font-bold text-lg" style={{ color: "#00FF88" }}>{fmt(totalAll)} ₽</div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPricesFromDB}
              disabled={matching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-60"
              style={{ background: "rgba(251,191,36,0.15)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}
              title="Подобрать цены из базы материалов автоматически">
              <Icon name={matching ? "Loader" : "Database"} size={12} className={matching ? "animate-spin" : ""} />
              {matching ? "Ищу..." : "Цены из базы"}
            </button>
            <button onClick={() => setShowPrices(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: showPrices ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.06)",
                color: showPrices ? "#00FF88" : "rgba(255,255,255,0.5)",
                border: `1px solid ${showPrices ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}`,
              }}>
              <Icon name={showPrices ? "EyeOff" : "Eye"} size={12} />
              {showPrices ? "Скрыть цены" : "Ввести цены"}
            </button>
          </div>
        </div>
      </div>

      {/* Панель результатов подбора цен */}
      {(matchMsg || matchResults.length > 0) && (
        <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(251,191,36,0.04)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: "#FBBF24" }}>
              {matchMsg}
            </span>
            {matchResults.filter(m => m.price && m.price > 0).length > 0 && (
              <button onClick={applyAllMatched}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                style={{ background: "#FBBF24", color: "#000" }}>
                <Icon name="CheckCheck" size={12} />
                Применить все ({matchResults.filter(m => m.price && m.price > 0).length})
              </button>
            )}
          </div>
          {matchResults.filter(m => m.price && m.price > 0).length > 0 && (
            <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {matchResults.filter(m => m.price && m.price > 0).map(m => (
                <div key={m.vor_id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{m.vor_name}</div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      → {m.matched_name}
                      {m.supplier_name && <span className="ml-1.5" style={{ color: "#00D4FF" }}>· {m.supplier_name}</span>}
                      {m.updated_at && <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>· {new Date(m.updated_at).toLocaleDateString("ru-RU")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono font-semibold text-xs" style={{ color: "#FBBF24" }}>
                      {fmt(m.price!)} ₽/{m.matched_unit}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}>
                      {Math.round(m.score * 100)}%
                    </span>
                    <button onClick={() => applyOne(m)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                      style={{ background: "rgba(251,191,36,0.2)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.3)" }}>
                      Применить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Таблица по разделам */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide w-8" style={{ color: "rgba(255,255,255,0.3)" }}>№</th>
              <th className="text-left px-3 py-2.5 font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>Наименование</th>
              <th className="text-center px-2 py-2.5 font-semibold uppercase tracking-wide w-14" style={{ color: "rgba(255,255,255,0.3)" }}>Ед.</th>
              <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wide w-20" style={{ color: "rgba(255,255,255,0.3)" }}>Кол-во</th>
              {showPrices && <>
                <th className="text-right px-3 py-2.5 font-semibold uppercase tracking-wide w-28" style={{ color: "rgba(255,255,255,0.3)" }}>Цена/ед., ₽</th>
                <th className="text-right px-4 py-2.5 font-semibold uppercase tracking-wide w-28" style={{ color: "rgba(255,255,255,0.3)" }}>Сумма, ₽</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => {
              const secRows = rows.filter(r => r.section === sec);
              const secMat = secRows.filter(r => !r.is_work).reduce((s, r) => s + r.qty * (r.price_per_unit || 0), 0);
              const secWork = secRows.filter(r => r.is_work).reduce((s, r) => s + r.qty * (r.price_per_unit || 0), 0);
              const secTotal = secMat + secWork;
              let rowNum = 0;
              return (
                <>
                  {/* Заголовок раздела */}
                  <tr key={`sec-${sec}`} style={{ background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td colSpan={showPrices ? 4 : 4} className="px-4 py-2">
                      <span className="font-bold text-white uppercase tracking-wide text-xs">{sec}</span>
                    </td>
                    {showPrices && (
                      <td colSpan={2} className="px-4 py-2 text-right">
                        {secTotal > 0 && (
                          <span className="font-semibold text-xs" style={{ color: "#FBBF24" }}>{fmt(secTotal)} ₽</span>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Материалы раздела */}
                  {secRows.filter(r => !r.is_work).length > 0 && (
                    <tr style={{ background: "rgba(0,212,255,0.03)" }}>
                      <td colSpan={showPrices ? 6 : 4} className="px-4 py-1.5">
                        <span className="text-xs font-semibold" style={{ color: "#00D4FF" }}>Материалы</span>
                      </td>
                    </tr>
                  )}
                  {secRows.filter(r => !r.is_work).map(r => {
                    rowNum++;
                    const total = r.qty * (r.price_per_unit || 0);
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <td className="px-4 py-2 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{rowNum}</td>
                        <td className="px-3 py-2 text-white">
                          {r.name}
                          {r.note && <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>({r.note})</span>}
                        </td>
                        <td className="px-2 py-2 text-center" style={{ color: "rgba(255,255,255,0.45)" }}>{r.unit}</td>
                        <td className="px-3 py-2 text-right font-semibold font-mono" style={{ color: "#00D4FF" }}>
                          {r.qty % 1 === 0 ? r.qty : r.qty.toFixed(3)}
                        </td>
                        {showPrices && <>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              value={r.price_per_unit || ""}
                              onChange={e => onPriceChange(r.id, +e.target.value)}
                              placeholder="0"
                              className={inp} style={inpSty}
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold font-mono" style={{ color: total > 0 ? "#00D4FF" : "rgba(255,255,255,0.15)" }}>
                            {total > 0 ? fmt(total) : "—"}
                          </td>
                        </>}
                      </tr>
                    );
                  })}

                  {/* Работы раздела */}
                  {secRows.filter(r => r.is_work).length > 0 && (
                    <tr style={{ background: "rgba(255,107,26,0.03)" }}>
                      <td colSpan={showPrices ? 6 : 4} className="px-4 py-1.5">
                        <span className="text-xs font-semibold" style={{ color: "#FF6B1A" }}>Работы</span>
                      </td>
                    </tr>
                  )}
                  {secRows.filter(r => r.is_work).map(r => {
                    rowNum++;
                    const total = r.qty * (r.price_per_unit || 0);
                    return (
                      <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <td className="px-4 py-2 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{rowNum}</td>
                        <td className="px-3 py-2 text-white">
                          {r.name}
                          {r.note && <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>({r.note})</span>}
                        </td>
                        <td className="px-2 py-2 text-center" style={{ color: "rgba(255,255,255,0.45)" }}>{r.unit}</td>
                        <td className="px-3 py-2 text-right font-semibold font-mono" style={{ color: "#FF6B1A" }}>
                          {r.qty % 1 === 0 ? r.qty : r.qty.toFixed(3)}
                        </td>
                        {showPrices && <>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              value={r.price_per_unit || ""}
                              onChange={e => onPriceChange(r.id, +e.target.value)}
                              placeholder="0"
                              className={inp} style={inpSty}
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold font-mono" style={{ color: total > 0 ? "#FF6B1A" : "rgba(255,255,255,0.15)" }}>
                            {total > 0 ? fmt(total) : "—"}
                          </td>
                        </>}
                      </tr>
                    );
                  })}

                  {/* Подитог раздела */}
                  {showPrices && secTotal > 0 && (
                    <tr key={`sub-${sec}`} style={{ background: "rgba(251,191,36,0.05)", borderTop: "1px solid rgba(251,191,36,0.15)" }}>
                      <td colSpan={4} className="px-4 py-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Итого по разделу «{sec}»
                        {secMat > 0 && <span className="ml-2" style={{ color: "#00D4FF" }}>мат: {fmt(secMat)} ₽</span>}
                        {secWork > 0 && <span className="ml-2" style={{ color: "#FF6B1A" }}>раб: {fmt(secWork)} ₽</span>}
                      </td>
                      <td />
                      <td className="px-4 py-2 text-right font-display font-bold text-sm" style={{ color: "#FBBF24" }}>
                        {fmt(secTotal)} ₽
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Итоговая смета */}
      {showPrices && (
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#00D4FF" }} />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Итого материалы</span>
              </div>
              <span className="font-semibold font-mono" style={{ color: hasPrices ? "#00D4FF" : "rgba(255,255,255,0.2)" }}>
                {hasPrices ? `${fmt(totalMat)} ₽` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#FF6B1A" }} />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Итого работы</span>
              </div>
              <span className="font-semibold font-mono" style={{ color: hasPrices ? "#FF6B1A" : "rgba(255,255,255,0.2)" }}>
                {hasPrices ? `${fmt(totalWork)} ₽` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="font-display font-bold text-white text-base">ИТОГО ПО СМЕТЕ</span>
              <span className="font-display font-black text-xl" style={{ color: hasPrices ? "#00FF88" : "rgba(255,255,255,0.2)" }}>
                {hasPrices ? `${fmt(totalAll)} ₽` : "Введите цены →"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function ElementsCalcTab({
  info,
  placed,
  onPlacedChange,
  token,
}: {
  info: ObjectInfo;
  placed: PlacedElement[];
  onPlacedChange: (els: PlacedElement[]) => void;
  token: string;
}) {
  const uid = useId();

  // Добавить элемент
  const addElement = (lib: LibItem) => {
    const el: PlacedElement = {
      id: `${uid}-${Date.now()}`,
      kind: lib.kind,
      label: lib.label,
      params: defaultParams(lib.kind, info),
      vor: [],
    };
    onPlacedChange([...placed, el]);
  };

  const addCustomElement = () => {
    const el: PlacedElement = {
      id: `${uid}-${Date.now()}`,
      kind: "custom" as ElementKind,
      label: "Новый элемент",
      params: {},
      vor: [
        { id: Math.random().toString(36).slice(2), section: "Прочее", name: "", unit: "шт", qty: 0, is_work: false },
      ],
    };
    onPlacedChange([...placed, el]);
  };

  const updateEl = (id: string, params: Record<string, number | string | boolean>) => {
    onPlacedChange(placed.map(e => e.id === id ? { ...e, params } : e));
  };

  const removeEl = (id: string) => {
    onPlacedChange(placed.filter(e => e.id !== id));
  };

  const renameEl = (id: string, label: string) => {
    onPlacedChange(placed.map(e => e.id === id ? { ...e, label } : e));
  };

  const overrideVor = (id: string, vor: VorRow[]) => {
    onPlacedChange(placed.map(e => e.id === id ? { ...e, vor } : e));
  };

  // Сводная ВОР: если у элемента есть кастомный vor — используем его, иначе считаем из параметров
  const allVor: VorRow[] = placed.flatMap(el => el.vor.length > 0 ? el.vor : calcVor(el.kind, el.params));

  // Обновить цену строки в ВОР — сохраняем в overrideVor элемента
  const handlePriceChange = (rowId: string, price: number) => {
    // Находим элемент которому принадлежит строка
    const el = placed.find(e => {
      const rows = e.vor.length > 0 ? e.vor : calcVor(e.kind, e.params);
      return rows.some(r => r.id === rowId);
    });
    if (!el) return;
    // Если кастомный vor уже есть — обновляем в нём
    // Иначе копируем рассчитанный и ставим цену
    const baseRows = el.vor.length > 0 ? el.vor : calcVor(el.kind, el.params);
    const updated = baseRows.map(r => r.id === rowId ? { ...r, price_per_unit: price } : r);
    overrideVor(el.id, updated);
  };

  // Группы библиотеки
  const groups = GROUP_ORDER.map(g => ({ group: g, items: LIBRARY.filter(l => l.group === g) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#FF6B1A" }}>Вкладка 2</div>
          <h3 className="font-display font-bold text-xl text-white">Расчёт по элементам</h3>
        </div>
        {allVor.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: "rgba(0,255,136,0.08)", color: "#00FF88", border: "1px solid rgba(0,255,136,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            ВОР рассчитана · {allVor.length} позиций
          </div>
        )}
      </div>

      <div className="flex gap-5" style={{ alignItems: "flex-start" }}>

        {/* ── Левая колонка: библиотека ── */}
        <div className="flex-shrink-0 w-64">
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Библиотека элементов</div>
          <div className="space-y-4">
            {groups.map(({ group, items }) => (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: GROUP_COLORS[group] }} />
                  <span className="text-xs font-semibold" style={{ color: GROUP_COLORS[group] }}>{group}</span>
                </div>
                <div className="space-y-1">
                  {items.map(lib => (
                    <button key={lib.kind} onClick={() => addElement(lib)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:scale-[1.02] group"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${lib.color}22` }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                        style={{ background: `${lib.color}18` }}>
                        <Icon name={lib.icon} size={13} style={{ color: lib.color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{lib.label}</div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{lib.description}</div>
                      </div>
                      <Icon name="Plus" size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: lib.color }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Свой элемент */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => addCustomElement()}
              className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all hover:scale-[1.02] group"
              style={{ border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.02)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <Icon name="Plus" size={14} style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Свой элемент</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>Заполнить состав вручную</div>
              </div>
            </button>
          </div>
        </div>

        {/* ── Правая колонка: размещённые элементы ── */}
        <div className="flex-1 min-w-0">
          {placed.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ border: "2px dashed rgba(255,255,255,0.08)" }}>
              <Icon name="MousePointerClick" size={36} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 12px" }} />
              <div className="text-white font-semibold mb-1">Добавьте элементы из библиотеки</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Нажмите на элемент слева — он появится здесь с формой параметров и автоматическим расчётом ВОР</div>
            </div>
          ) : (
            <>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                Состав проекта · {placed.length} элем.
              </div>
              {groups.map(({ group }) => {
                const els = placed.filter(e => LIBRARY.find(l => l.kind === e.kind)?.group === group);
                if (!els.length) return null;
                return (
                  <div key={group} className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: GROUP_COLORS[group] }} />
                      <span className="text-sm font-semibold" style={{ color: GROUP_COLORS[group] }}>{group}</span>
                    </div>
                    {els.map(el => {
                      const lib = LIBRARY.find(l => l.kind === el.kind)!;
                      return (
                        <PlacedCard key={el.id} el={el} libItem={lib}
                          onUpdate={p => updateEl(el.id, p)}
                          onRemove={() => removeEl(el.id)}
                          onRename={label => renameEl(el.id, label)}
                          onVorOverride={vor => overrideVor(el.id, vor)} />
                      );
                    })}
                  </div>
                );
              })}

              {/* Кастомные элементы */}
              {placed.filter(e => e.kind === "custom").length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.4)" }} />
                    <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Прочее</span>
                  </div>
                  {placed.filter(e => e.kind === "custom").map(el => (
                    <PlacedCard key={el.id} el={el}
                      libItem={{ kind: "custom", group: "Прочее", label: el.label, icon: "PenLine", color: "#9ca3af", description: "" }}
                      onUpdate={p => updateEl(el.id, p)}
                      onRemove={() => removeEl(el.id)}
                      onRename={label => renameEl(el.id, label)}
                      onVorOverride={vor => overrideVor(el.id, vor)} />
                  ))}
                </div>
              )}

              {/* Полная ВОР со сметой */}
              {allVor.length > 0 && (
                <FullVorTable rows={allVor} onPriceChange={handlePriceChange} token={token} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}