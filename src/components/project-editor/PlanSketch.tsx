import { useRef, useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface Wall {
  id: string;
  type: "outer" | "inner";
  points: Point[];
  closed: boolean;
  label: string;
}

export interface SketchResult {
  outerPerimeter: number;
  innerTotal: number;
  totalLength: number;
  wallSegments: { label: string; length: number; type: string }[];
}

interface PlanSketchProps {
  scale?: number;
  onResult: (r: SketchResult) => void;
  backgroundUrl?: string;
}

interface DragState {
  wallId: string;
  pointIdx: number;
  startX: number;
  startY: number;
}

// ─── Константы ────────────────────────────────────────────────────────────────

const GRID = 20;
const SNAP_PT_RADIUS = 14;
const DRAG_RADIUS = 10;
const CANVAS_W = 720;
const CANVAS_H = 500;

const C = {
  outer: "#00D4FF",
  inner: "#FF6B1A",
  bg: "#0d1117",
  grid: "rgba(255,255,255,0.04)",
  gridBold: "rgba(255,255,255,0.09)",
  gridMeter: "rgba(255,255,255,0.16)",
  pt: "#fff",
  ptDrag: "#FBBF24",
  ptHover: "#FBBF24",
  ptSelected: "#00FF88",
  dimBg: "rgba(10,13,20,0.82)",
  closedFill: "rgba(0,212,255,0.06)",
  innerFill: "rgba(255,107,26,0.05)",
  orthoLine: "rgba(255,255,255,0.15)",
};

// ─── Утилиты ──────────────────────────────────────────────────────────────────

const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const lenM = (a: Point, b: Point, s: number) => dist(a, b) * s;
const mid  = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function toGrid(p: Point, subgrid = 1): Point {
  const g = GRID / subgrid;
  return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
}

/** Применяет ortho-режим: фиксирует горизонталь или вертикаль */
function ortho(from: Point, to: Point): Point {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

function snapToExisting(p: Point, walls: Wall[], ignoreWallId?: string, ignoreIdx?: number): Point | null {
  for (const w of walls) {
    if (w.id === ignoreWallId) continue;
    for (const pt of w.points) {
      if (dist(p, pt) < SNAP_PT_RADIUS) return { ...pt };
    }
  }
  return null;
}

function snapToDriving(p: Point, walls: Wall[], ignoreWallId: string, ignoreIdx: number): Point | null {
  for (const w of walls) {
    for (let i = 0; i < w.points.length; i++) {
      if (w.id === ignoreWallId && i === ignoreIdx) continue;
      const pt = w.points[i];
      if (dist(p, pt) < SNAP_PT_RADIUS) return { ...pt };
    }
  }
  return null;
}

function findPointAt(p: Point, walls: Wall[]): { wallId: string; idx: number } | null {
  for (const w of walls) {
    for (let i = 0; i < w.points.length; i++) {
      if (dist(p, w.points[i]) < DRAG_RADIUS) return { wallId: w.id, idx: i };
    }
  }
  return null;
}

function getRaw(e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Point {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function PlanSketch({ scale = 0.05, onResult, backgroundUrl }: PlanSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [walls, setWalls]           = useState<Wall[]>([]);
  const [mode, setMode]             = useState<"outer" | "inner">("outer");
  const [drawing, setDrawing]       = useState<Point[]>([]);
  const [cursor, setCursor]         = useState<Point | null>(null);
  const [hoverPt, setHoverPt]       = useState<Point | null>(null);
  const [drag, setDrag]             = useState<DragState | null>(null);
  const [selectedPt, setSelectedPt] = useState<{ wallId: string; idx: number } | null>(null);
  const [userScale, setUserScale]   = useState(scale);
  const [subgrid, setSubgrid]       = useState(2);   // 1=GRID, 2=GRID/2, 4=GRID/4
  const [isOrtho, setIsOrtho]       = useState(true);
  const [showDims, setShowDims]     = useState(true);
  const [bgImage, setBgImage]       = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity]   = useState(0.3);
  const bgRef = useRef<HTMLImageElement | null>(null);
  // Ввод точных координат
  const [inputMode, setInputMode]   = useState(false);
  const [inputX, setInputX]         = useState("");
  const [inputY, setInputY]         = useState("");
  // Редактирование координат выбранной точки
  const [editCoord, setEditCoord]   = useState<{ wx: string; wy: string } | null>(null);
  const isOrthoRef = useRef(isOrtho);
  useEffect(() => { isOrthoRef.current = isOrtho; }, [isOrtho]);

  // Подложка
  useEffect(() => {
    if (!backgroundUrl) return;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { setBgImage(img); bgRef.current = img; };
    img.src = backgroundUrl;
  }, [backgroundUrl]);

  // Экспорт результата
  useEffect(() => {
    let outerPerimeter = 0; let innerTotal = 0;
    const segments: SketchResult["wallSegments"] = [];
    for (const w of walls) {
      const pts = w.closed ? [...w.points, w.points[0]] : w.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = lenM(pts[i], pts[i + 1], userScale);
        if (w.type === "outer") outerPerimeter += l;
        else innerTotal += l;
        segments.push({ label: `${w.label} #${i + 1}`, length: +l.toFixed(3), type: w.type });
      }
    }
    onResult({
      outerPerimeter: +outerPerimeter.toFixed(3),
      innerTotal: +innerTotal.toFixed(3),
      totalLength: +(outerPerimeter + innerTotal).toFixed(3),
      wallSegments: segments,
    });
  }, [walls, userScale, onResult]);

  // ─── Отрисовка ──────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width; const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // Подложка
    if (bgRef.current) {
      ctx.globalAlpha = bgOpacity;
      ctx.drawImage(bgRef.current, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Сетка
    const g = GRID / subgrid;
    const gM = g * userScale;
    for (let x = 0; x <= W; x += g) {
      const isBold = x % (GRID * 5) === 0;
      const isMeter = Math.abs((x / GRID) % (1 / userScale / GRID)) < 0.01;
      ctx.strokeStyle = isBold ? (isMeter ? C.gridMeter : C.gridBold) : C.grid;
      ctx.lineWidth = isBold ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += g) {
      const isBold = y % (GRID * 5) === 0;
      ctx.strokeStyle = isBold ? C.gridBold : C.grid;
      ctx.lineWidth = isBold ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Легенда масштаба
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "10px monospace";
    ctx.fillText(`шаг сетки: ${gM.toFixed(2)}м`, 8, H - 8);

    // Ortho-направляющие от последней точки рисования
    if (isOrtho && drawing.length > 0 && cursor) {
      const last = drawing[drawing.length - 1];
      ctx.strokeStyle = C.orthoLine; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(last.x, 0); ctx.lineTo(last.x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, last.y); ctx.lineTo(W, last.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Нарисованные стены
    for (const wall of walls) {
      if (!wall.points.length) continue;
      const color = wall.type === "outer" ? C.outer : C.inner;

      // Заливка
      if (wall.closed && wall.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(wall.points[0].x, wall.points[0].y);
        wall.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = wall.type === "outer" ? C.closedFill : C.innerFill;
        ctx.fill();
      }

      // Линия
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(wall.points[0].x, wall.points[0].y);
      wall.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      if (wall.closed) ctx.closePath();
      ctx.stroke();

      // Размерные подписи
      if (showDims) {
        const pts = wall.closed ? [...wall.points, wall.points[0]] : wall.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]; const b = pts[i + 1];
          const lm = lenM(a, b, userScale);
          if (lm < 0.05) continue;
          const m = mid(a, b);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const txt = `${lm.toFixed(2)}м`;
          ctx.save();
          ctx.translate(m.x, m.y); ctx.rotate(ang);
          ctx.font = "bold 11px sans-serif";
          const tw = ctx.measureText(txt).width;
          // Перпендикулярный отступ
          const flip = ang > Math.PI / 2 || ang < -Math.PI / 2 ? 1 : -1;
          const oy = flip * 14;
          ctx.fillStyle = C.dimBg;
          ctx.fillRect(-tw / 2 - 3, oy - 12, tw + 6, 14);
          ctx.fillStyle = color; ctx.textAlign = "center";
          ctx.fillText(txt, 0, oy);
          ctx.restore();
        }
      }

      // Точки
      for (let i = 0; i < wall.points.length; i++) {
        const pt = wall.points[i];
        const isSelected = selectedPt?.wallId === wall.id && selectedPt?.idx === i;
        const isHover = !drag && hoverPt && dist(pt, hoverPt) < DRAG_RADIUS;
        const isDragging = drag?.wallId === wall.id && drag?.pointIdx === i;
        const r = (isSelected || isDragging) ? 8 : isHover ? 7 : 5;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? C.ptSelected : isDragging ? C.ptDrag : isHover ? C.ptHover : C.pt;
        ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
        // Координаты при hover
        if ((isHover || isSelected) && showDims) {
          const xM = (pt.x * userScale).toFixed(2);
          const yM = (pt.y * userScale).toFixed(2);
          const lbl = `(${xM}, ${yM})`;
          ctx.font = "10px monospace";
          const tw = ctx.measureText(lbl).width;
          ctx.fillStyle = C.dimBg;
          ctx.fillRect(pt.x + 10, pt.y - 20, tw + 6, 14);
          ctx.fillStyle = isSelected ? C.ptSelected : C.ptHover;
          ctx.fillText(lbl, pt.x + 13, pt.y - 9);
        }
      }
    }

    // Рисуемый контур (preview)
    if (drawing.length > 0 && cursor) {
      const color = mode === "outer" ? C.outer : C.inner;
      // Уже поставленные точки
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(drawing[0].x, drawing[0].y);
      drawing.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      // Rubber-band к курсору
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(drawing[drawing.length - 1].x, drawing[drawing.length - 1].y);
      ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Длина текущего отрезка
      const curLen = lenM(drawing[drawing.length - 1], cursor, userScale);
      ctx.font = "bold 12px sans-serif"; ctx.fillStyle = color;
      ctx.fillText(`${curLen.toFixed(2)}м`, cursor.x + 12, cursor.y - 6);
      // Суммарная длина
      let tot = 0;
      for (let i = 0; i < drawing.length - 1; i++) tot += lenM(drawing[i], drawing[i + 1], userScale);
      if (tot > 0) {
        ctx.font = "10px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(`Σ ${(tot + curLen).toFixed(2)}м`, cursor.x + 12, cursor.y + 8);
      }
      // Замыкание
      if (drawing.length >= 3 && dist(cursor, drawing[0]) < SNAP_PT_RADIUS * 1.5) {
        ctx.beginPath(); ctx.arc(drawing[0].x, drawing[0].y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = "#00FF88"; ctx.lineWidth = 2.5; ctx.stroke();
      }
      // Точки
      drawing.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.pt; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      });
    }

    // Курсор-крестик (не в режиме перетаскивания)
    if (!drag && cursor) {
      const color = mode === "outer" ? C.outer : C.inner;
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cursor.x, 0); ctx.lineTo(cursor.x, CANVAS_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cursor.y); ctx.lineTo(CANVAS_W, cursor.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }, [walls, drawing, cursor, hoverPt, drag, selectedPt, mode, userScale, subgrid, isOrtho, showDims, bgOpacity]);

  useEffect(() => { draw(); }, [draw]);

  // ─── Обработчики мыши ────────────────────────────────────────────────────

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const raw = getRaw(e, canvasRef.current!);
    return toGrid(raw, subgrid);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const raw = getRaw(e, canvasRef.current!);
    let snapped = toGrid(raw, subgrid);

    if (drag) {
      // Перетаскивание точки
      const snap = snapToDriving(snapped, walls, drag.wallId, drag.pointIdx);
      const pos = snap || snapped;
      setWalls(prev => prev.map(w =>
        w.id !== drag.wallId ? w : {
          ...w,
          points: w.points.map((p, i) => i === drag.pointIdx ? pos : p),
        }
      ));
      setCursor(pos);
      return;
    }

    // Привязка к существующим точкам
    const snapPt = snapToExisting(snapped, walls);
    if (snapPt) { snapped = snapPt; }
    else if (isOrtho && drawing.length > 0) {
      snapped = ortho(drawing[drawing.length - 1], snapped);
    }

    setCursor(snapped);
    setHoverPt(findPointAt(raw, walls) ? raw : null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const raw = getRaw(e, canvasRef.current!);
    // Ищем точку под курсором для drag
    const found = findPointAt(raw, walls);
    if (found && drawing.length === 0) {
      setDrag({ wallId: found.wallId, pointIdx: found.idx, startX: raw.x, startY: raw.y });
      setSelectedPt(found);
      e.preventDefault();
    }
  };

  const handleMouseUp = () => { setDrag(null); };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drag) return; // Завершили drag — не ставим точку
    const raw = getRaw(e, canvasRef.current!);

    // Клик по существующей точке = выбор для редактирования
    const found = findPointAt(raw, walls);
    if (found && drawing.length === 0) {
      setSelectedPt(found);
      const w = walls.find(w => w.id === found.wallId)!;
      const pt = w.points[found.idx];
      setEditCoord({ wx: (pt.x * userScale).toFixed(3), wy: (pt.y * userScale).toFixed(3) });
      return;
    }

    // Снять выбор
    if (!found && drawing.length === 0) { setSelectedPt(null); setEditCoord(null); }

    let snapped = getPoint(e);
    const snapPt = snapToExisting(snapped, walls);
    if (snapPt) snapped = snapPt;
    else if (isOrtho && drawing.length > 0) snapped = ortho(drawing[drawing.length - 1], snapped);

    if (drawing.length === 0) { setDrawing([snapped]); return; }

    // Замыкание
    if (drawing.length >= 3 && dist(snapped, drawing[0]) < SNAP_PT_RADIUS * 1.5) {
      finishWall(drawing, true);
      return;
    }
    setDrawing(prev => [...prev, snapped]);
  };

  const handleDblClick = () => {
    if (drawing.length >= 2) finishWall(drawing, false);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // ПКМ = удалить последнюю точку или отменить
    if (drawing.length > 1) { setDrawing(prev => prev.slice(0, -1)); }
    else { setDrawing([]); }
  };

  const finishWall = (pts: Point[], closed: boolean) => {
    if (pts.length < 2) return;
    const id = `wall_${Date.now()}`;
    const wallCount = walls.filter(w => w.type === mode).length;
    setWalls(prev => [...prev, {
      id, type: mode, points: pts, closed,
      label: mode === "outer" ? `Нар.контур ${wallCount + 1}` : `Внутр.стена ${wallCount + 1}`,
    }]);
    setDrawing([]);
  };

  // Клавиши
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { setDrawing([]); setSelectedPt(null); setEditCoord(null); }
    if ((e.key === "z" || e.key === "я") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (drawing.length > 1) setDrawing(prev => prev.slice(0, -1));
      else setWalls(prev => prev.slice(0, -1));
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedPt) {
        setWalls(prev => prev.map(w => {
          if (w.id !== selectedPt.wallId) return w;
          const pts = w.points.filter((_, i) => i !== selectedPt.idx);
          if (pts.length < 2) return null!;
          return { ...w, points: pts };
        }).filter(Boolean));
        setSelectedPt(null); setEditCoord(null);
      }
    }
    if (e.shiftKey) setIsOrtho(true);
  }, [drawing.length, selectedPt]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Shift") setIsOrtho(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Добавить точку по точным координатам
  const addByCoords = () => {
    const x = parseFloat(inputX) / userScale;
    const y = parseFloat(inputY) / userScale;
    if (isNaN(x) || isNaN(y)) return;
    const pt: Point = { x, y };
    setDrawing(prev => [...prev, pt]);
    setInputX(""); setInputY("");
  };

  // Обновить координаты выбранной точки
  const applyEditCoord = () => {
    if (!selectedPt || !editCoord) return;
    const x = parseFloat(editCoord.wx) / userScale;
    const y = parseFloat(editCoord.wy) / userScale;
    if (isNaN(x) || isNaN(y)) return;
    setWalls(prev => prev.map(w =>
      w.id !== selectedPt.wallId ? w : {
        ...w, points: w.points.map((p, i) => i === selectedPt.idx ? { x, y } : p),
      }
    ));
  };

  const clearAll = () => { setWalls([]); setDrawing([]); setSelectedPt(null); setEditCoord(null); };
  const removeWall = (id: string) => setWalls(prev => prev.filter(w => w.id !== id));

  // Итоги
  let outerPerimeter = 0, innerTotal = 0;
  for (const w of walls) {
    const pts = w.closed ? [...w.points, w.points[0]] : w.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = lenM(pts[i], pts[i + 1], userScale);
      if (w.type === "outer") outerPerimeter += l; else innerTotal += l;
    }
  }

  return (
    <div className="space-y-3" ref={containerRef}>

      {/* ── Панель инструментов ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Режим */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          {(["outer","inner"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === m ? (m === "outer" ? "#00D4FF22" : "#FF6B1A22") : "transparent",
                color: mode === m ? (m === "outer" ? C.outer : C.inner) : "rgba(255,255,255,0.4)",
                borderRight: m === "outer" ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: m === "outer" ? C.outer : C.inner }} />
              {m === "outer" ? "Нар. контур" : "Внутр. стена"}
            </button>
          ))}
        </div>

        {/* Ortho */}
        <button onClick={() => setIsOrtho(v => !v)}
          title="Или удерживай Shift"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: isOrtho ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isOrtho ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.1)"}`,
            color: isOrtho ? C.outer : "rgba(255,255,255,0.4)",
          }}>
          <Icon name="Minus" size={12} />
          Ortho
        </button>

        {/* Шаг сетки */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="Grid3x3" size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Шаг:</span>
          <select value={subgrid} onChange={e => setSubgrid(+e.target.value)}
            className="bg-transparent text-white outline-none text-xs">
            <option value={1}>{(GRID * userScale).toFixed(2)}м</option>
            <option value={2}>{(GRID * userScale / 2).toFixed(3)}м</option>
            <option value={4}>{(GRID * userScale / 4).toFixed(3)}м</option>
            <option value={10}>{(GRID * userScale / 10).toFixed(3)}м (свободно)</option>
          </select>
        </div>

        {/* Масштаб */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="Ruler" size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
          <select value={userScale} onChange={e => setUserScale(+e.target.value)}
            className="bg-transparent text-white outline-none text-xs">
            <option value={0.025}>1px=2.5см</option>
            <option value={0.05}>1px=5см</option>
            <option value={0.10}>1px=10см</option>
            <option value={0.20}>1px=20см</option>
          </select>
        </div>

        {/* Размеры */}
        <button onClick={() => setShowDims(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-all"
          style={{
            background: showDims ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${showDims ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.1)"}`,
            color: showDims ? C.outer : "rgba(255,255,255,0.4)",
          }}>
          <Icon name="Ruler" size={12} />
          Размеры
        </button>

        {/* Подложка */}
        <label className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs cursor-pointer hover:bg-white/10 transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <Icon name="Image" size={12} />
          Подложка
          <input type="file" accept="image/*" className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = URL.createObjectURL(f);
              const img = new Image();
              img.onload = () => { setBgImage(img); bgRef.current = img; };
              img.src = url;
            }} />
        </label>

        {bgImage && (
          <input type="range" min={0.05} max={0.9} step={0.05} value={bgOpacity}
            onChange={e => setBgOpacity(+e.target.value)}
            className="w-20 h-1 accent-cyan-400" title="Прозрачность подложки" />
        )}

        <div className="ml-auto flex gap-2">
          {drawing.length > 0 && (
            <button onClick={() => setDrawing(prev => prev.slice(0, -1))}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(251,191,36,0.1)", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.2)" }}>
              <Icon name="Undo2" size={12} /> Отмена точки
            </button>
          )}
          <button onClick={clearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs hover:bg-red-500/20 transition-all"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Icon name="Trash2" size={12} /> Очистить
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Canvas */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={CANVAS_W} height={CANVAS_H}
            className="rounded-xl w-full"
            style={{ border: "1px solid rgba(255,255,255,0.08)", display: "block", cursor: drag ? "grabbing" : "crosshair" }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            onDoubleClick={handleDblClick}
            onContextMenu={handleRightClick}
            onMouseLeave={() => { setCursor(null); setHoverPt(null); if (!drag) setDrag(null); }}
          />

          {/* Строка статуса */}
          <div className="mt-1.5 flex items-center gap-3 text-xs px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            {cursor && (
              <span>X: <b style={{ color: "rgba(255,255,255,0.7)" }}>{(cursor.x * userScale).toFixed(2)}м</b> &nbsp;
                   Y: <b style={{ color: "rgba(255,255,255,0.7)" }}>{(cursor.y * userScale).toFixed(2)}м</b></span>
            )}
            {drawing.length > 0 && (
              <span style={{ color: "#FBBF24" }}>{drawing.length} точек · ПКМ = отменить · ×2клик = завершить · Esc = сброс</span>
            )}
            {!drawing.length && (
              <span>Клик = добавить точку · Drag = переместить · ПКМ = удалить последнюю</span>
            )}
          </div>
        </div>

        {/* ── Правая панель ── */}
        <div className="w-56 flex-shrink-0 space-y-2">

          {/* Ввод точных координат */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                Точные координаты
              </span>
              <button onClick={() => setInputMode(v => !v)}
                className="text-xs px-2 py-0.5 rounded"
                style={{ background: inputMode ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.06)", color: inputMode ? C.outer : "rgba(255,255,255,0.4)" }}>
                {inputMode ? "скрыть" : "ввод"}
              </button>
            </div>
            {inputMode && (
              <div className="space-y-1.5">
                {[["X", inputX, setInputX], ["Y", inputY, setInputY]].map(([lbl, val, setter]) => (
                  <div key={lbl as string} className="flex items-center gap-1.5">
                    <span className="text-xs w-4" style={{ color: "rgba(255,255,255,0.4)" }}>{lbl}:</span>
                    <input
                      type="number" step="0.01" value={val as string}
                      placeholder="м"
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addByCoords()}
                      className="flex-1 px-2 py-1 rounded-lg text-xs text-white outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                  </div>
                ))}
                <button onClick={addByCoords}
                  className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "rgba(0,212,255,0.15)", color: C.outer, border: "1px solid rgba(0,212,255,0.25)" }}>
                  + Добавить точку
                </button>
              </div>
            )}
          </div>

          {/* Редактирование выбранной точки */}
          {selectedPt && editCoord && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <div className="text-xs font-semibold" style={{ color: "#00FF88" }}>
                ✏️ Точка {selectedPt.idx + 1}
              </div>
              {[["X", "wx"], ["Y", "wy"]].map(([lbl, field]) => (
                <div key={lbl} className="flex items-center gap-1.5">
                  <span className="text-xs w-4" style={{ color: "rgba(255,255,255,0.4)" }}>{lbl}:</span>
                  <input
                    type="number" step="0.01"
                    value={editCoord[field as "wx" | "wy"]}
                    onChange={e => setEditCoord(prev => prev ? { ...prev, [field]: e.target.value } : null)}
                    onKeyDown={e => e.key === "Enter" && applyEditCoord()}
                    className="flex-1 px-2 py-1 rounded-lg text-xs text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(0,255,136,0.3)" }}
                  />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>м</span>
                </div>
              ))}
              <div className="flex gap-1.5">
                <button onClick={applyEditCoord}
                  className="flex-1 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(0,255,136,0.15)", color: "#00FF88" }}>
                  Применить
                </button>
                <button
                  onClick={() => {
                    setWalls(prev => prev.map(w =>
                      w.id !== selectedPt.wallId ? w : {
                        ...w,
                        points: w.points.filter((_, i) => i !== selectedPt.idx),
                      }
                    ).filter(w => w.points.length >= 2));
                    setSelectedPt(null); setEditCoord(null);
                  }}
                  className="px-2 py-1 rounded-lg text-xs"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                  <Icon name="Trash2" size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Итоги */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>Итого</div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: C.outer }}>Нар. периметр</span>
              <span className="text-sm font-bold text-white">{outerPerimeter.toFixed(2)} м</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: C.inner }}>Внутр. стены</span>
              <span className="text-sm font-bold text-white">{innerTotal.toFixed(2)} м</span>
            </div>
            <div className="pt-1.5 mt-0.5 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs font-semibold text-white">Всего лент</span>
              <span className="text-base font-bold" style={{ color: "#00FF88" }}>{(outerPerimeter + innerTotal).toFixed(2)} м</span>
            </div>
          </div>

          {/* Список контуров */}
          {walls.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Контуры</div>
              {walls.map(w => {
                const pts = w.closed ? [...w.points, w.points[0]] : w.points;
                let wLen = 0;
                for (let i = 0; i < pts.length - 1; i++) wLen += lenM(pts[i], pts[i + 1], userScale);
                return (
                  <div key={w.id} className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: w.type === "outer" ? C.outer : C.inner }} />
                      <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{w.label}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-bold" style={{ color: w.type === "outer" ? C.outer : C.inner }}>{wLen.toFixed(1)}м</span>
                      <button onClick={() => removeWall(w.id)}
                        className="w-4 h-4 flex items-center justify-center hover:text-red-400 transition-colors"
                        style={{ color: "rgba(255,255,255,0.2)" }}>
                        <Icon name="X" size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Клавиши */}
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>Клавиши</div>
            <div className="space-y-1">
              {[
                ["Shift", "Ortho on/off"],
                ["ПКМ", "удалить точку"],
                ["×2клик", "завершить"],
                ["Ctrl+Z", "отменить"],
                ["Del", "удалить выбр."],
                ["Esc", "сброс"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs gap-2">
                  <span className="px-1.5 py-0.5 rounded font-mono flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 10 }}>{k}</span>
                  <span className="truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
