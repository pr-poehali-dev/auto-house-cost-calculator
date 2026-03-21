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
  outerPerimeter: number;   // п.м — периметр наружного контура
  innerTotal: number;       // п.м — суммарная длина внутренних лент
  totalLength: number;      // п.м — всего
  wallSegments: { label: string; length: number; type: string }[];
}

interface PlanSketchProps {
  /** Масштаб: сколько метров в 1 пикселе */
  scale?: number;
  onResult: (r: SketchResult) => void;
  backgroundUrl?: string;
}

// ─── Константы ────────────────────────────────────────────────────────────────

const GRID = 20;          // пикселей на ячейку сетки
const SNAP_RADIUS = 12;   // пикселей — радиус прилипания к точке

const COLORS = {
  outer: "#00D4FF",
  inner: "#FF6B1A",
  point: "#fff",
  pointHover: "#FBBF24",
  dim: "rgba(255,255,255,0.55)",
  grid: "rgba(255,255,255,0.05)",
  gridBold: "rgba(255,255,255,0.1)",
  bg: "#111827",
  closedFill: "rgba(0,212,255,0.07)",
  innerFill: "rgba(255,107,26,0.05)",
};

function dist(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function segmentLengthM(a: Point, b: Point, scale: number) {
  return dist(a, b) * scale;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function snapToGrid(p: Point): Point {
  return { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
}

function snapToPoints(p: Point, walls: Wall[], exclude?: Point): Point | null {
  for (const w of walls) {
    for (const pt of w.points) {
      if (exclude && pt.x === exclude.x && pt.y === exclude.y) continue;
      if (dist(p, pt) < SNAP_RADIUS) return pt;
    }
  }
  return null;
}

// ─── Компонент ───────────────────────────────────────────────────────────────

export default function PlanSketch({ scale = 0.05, onResult, backgroundUrl }: PlanSketchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [mode, setMode] = useState<"outer" | "inner">("outer");
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [userScale, setUserScale] = useState(scale);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgOpacity, setBgOpacity] = useState(0.35);
  const [showDims, setShowDims] = useState(true);
  const bgRef = useRef<HTMLImageElement | null>(null);

  // Загружаем подложку если есть
  useEffect(() => {
    if (!backgroundUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { setBgImage(img); bgRef.current = img; };
    img.src = backgroundUrl;
  }, [backgroundUrl]);

  // Вычисляем результаты при изменении стен
  useEffect(() => {
    const outer = walls.filter(w => w.type === "outer" && w.closed);
    const inner = walls.filter(w => w.type === "inner");

    let outerPerimeter = 0;
    const segments: { label: string; length: number; type: string }[] = [];

    for (const w of outer) {
      for (let i = 0; i < w.points.length; i++) {
        const a = w.points[i];
        const b = w.points[(i + 1) % w.points.length];
        const len = segmentLengthM(a, b, userScale);
        outerPerimeter += len;
        segments.push({ label: `Нар. ${i + 1}`, length: +len.toFixed(2), type: "outer" });
      }
    }

    let innerTotal = 0;
    for (const w of inner) {
      for (let i = 0; i < w.points.length - 1; i++) {
        const len = segmentLengthM(w.points[i], w.points[i + 1], userScale);
        innerTotal += len;
        segments.push({ label: `Вн. ${i + 1}`, length: +len.toFixed(2), type: "inner" });
      }
      if (w.closed && w.points.length > 2) {
        const len = segmentLengthM(w.points[w.points.length - 1], w.points[0], userScale);
        innerTotal += len;
      }
    }

    onResult({
      outerPerimeter: +outerPerimeter.toFixed(2),
      innerTotal: +innerTotal.toFixed(2),
      totalLength: +(outerPerimeter + innerTotal).toFixed(2),
      wallSegments: segments,
    });
  }, [walls, userScale, onResult]);

  // Рисуем на canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Подложка
    if (bgImage && bgRef.current) {
      ctx.globalAlpha = bgOpacity;
      ctx.drawImage(bgRef.current, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Сетка
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // Жирная сетка каждые 5 ячеек (5 × GRID = 1 м при масштабе 0.05)
    ctx.strokeStyle = COLORS.gridBold;
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += GRID * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Размер ячейки сетки
    const cellM = (GRID * userScale).toFixed(2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "10px monospace";
    ctx.fillText(`сетка: ${cellM}м`, 8, H - 8);

    // Нарисованные стены
    for (const wall of walls) {
      if (wall.points.length < 1) continue;
      const color = wall.type === "outer" ? COLORS.outer : COLORS.inner;

      // Заливка замкнутого контура
      if (wall.closed && wall.points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(wall.points[0].x, wall.points[0].y);
        for (let i = 1; i < wall.points.length; i++) ctx.lineTo(wall.points[i].x, wall.points[i].y);
        ctx.closePath();
        ctx.fillStyle = wall.type === "outer" ? COLORS.closedFill : COLORS.innerFill;
        ctx.fill();
      }

      // Линии
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.moveTo(wall.points[0].x, wall.points[0].y);
      for (let i = 1; i < wall.points.length; i++) ctx.lineTo(wall.points[i].x, wall.points[i].y);
      if (wall.closed) ctx.closePath();
      ctx.stroke();

      // Размерные подписи
      if (showDims) {
        const pts = wall.closed
          ? [...wall.points, wall.points[0]]
          : wall.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i]; const b = pts[i + 1];
          const lenM = segmentLengthM(a, b, userScale);
          if (lenM < 0.1) continue;
          const mid = midpoint(a, b);
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.save();
          ctx.translate(mid.x, mid.y);
          ctx.rotate(angle);
          const txt = `${lenM.toFixed(2)}м`;
          ctx.font = "bold 11px sans-serif";
          const tw = ctx.measureText(txt).width;
          ctx.fillStyle = "rgba(10,13,20,0.75)";
          ctx.fillRect(-tw / 2 - 3, -18, tw + 6, 14);
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.fillText(txt, 0, -7);
          ctx.restore();
        }
      }

      // Точки
      for (const pt of wall.points) {
        const isHover = hoverPoint && pt.x === hoverPoint.x && pt.y === hoverPoint.y;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isHover ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? COLORS.pointHover : COLORS.point;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Текущий рисуемый контур
    if (drawing.length > 0 && cursor) {
      const color = mode === "outer" ? COLORS.outer : COLORS.inner;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(drawing[drawing.length - 1].x, drawing[drawing.length - 1].y);
      ctx.lineTo(cursor.x, cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Длина текущего отрезка
      const curLen = segmentLengthM(drawing[drawing.length - 1], cursor, userScale);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = color;
      ctx.fillText(`${curLen.toFixed(2)}м`, cursor.x + 10, cursor.y - 8);

      // Уже нарисованные точки текущего контура
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(drawing[0].x, drawing[0].y);
      for (let i = 1; i < drawing.length; i++) ctx.lineTo(drawing[i].x, drawing[i].y);
      ctx.stroke();

      for (const pt of drawing) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.point;
        ctx.fill();
      }
    } else if (cursor && drawing.length === 0) {
      // Крестик курсора
      const color = mode === "outer" ? COLORS.outer : COLORS.inner;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(cursor.x - 8, cursor.y); ctx.lineTo(cursor.x + 8, cursor.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cursor.x, cursor.y - 8); ctx.lineTo(cursor.x, cursor.y + 8); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [walls, drawing, cursor, hoverPoint, mode, userScale, bgImage, bgOpacity, showDims]);

  useEffect(() => { draw(); }, [draw]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return snapToGrid({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const raw = getCanvasPoint(e);
    const snapped = snapToPoints(raw, walls) || raw;
    setCursor(snapped);
    setHoverPoint(snapToPoints(raw, walls));
  };

  const handleMouseLeave = () => { setCursor(null); setHoverPoint(null); };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const raw = getCanvasPoint(e);
    const snapped = snapToPoints(raw, walls) || raw;

    if (drawing.length === 0) {
      setDrawing([snapped]);
      return;
    }

    // Проверка замыкания на первую точку
    if (drawing.length >= 3 && dist(snapped, drawing[0]) < SNAP_RADIUS * 1.5) {
      const id = `wall_${Date.now()}`;
      setWalls(prev => [...prev, {
        id, type: mode, points: drawing, closed: true,
        label: mode === "outer" ? `Наружный контур ${prev.filter(w => w.type === "outer").length + 1}`
                                : `Внутренняя стена ${prev.filter(w => w.type === "inner").length + 1}`,
      }]);
      setDrawing([]);
      return;
    }

    setDrawing(prev => [...prev, snapped]);
  };

  const handleDblClick = () => {
    if (drawing.length < 2) return;
    const id = `wall_${Date.now()}`;
    setWalls(prev => [...prev, {
      id, type: mode, points: drawing, closed: false,
      label: `Внутренняя стена ${prev.filter(w => w.type === "inner").length + 1}`,
    }]);
    setDrawing([]);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setDrawing([]);
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      setWalls(prev => prev.slice(0, -1));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const clearAll = () => { setWalls([]); setDrawing([]); };

  const removeWall = (id: string) => setWalls(prev => prev.filter(w => w.id !== id));

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setBgImage(img); bgRef.current = img; };
    img.src = url;
  };

  // Результаты
  const outerWalls = walls.filter(w => w.type === "outer" && w.closed);
  const innerWalls = walls.filter(w => w.type === "inner");
  let outerPerimeter = 0;
  let innerTotal = 0;
  for (const w of outerWalls) {
    for (let i = 0; i < w.points.length; i++) {
      outerPerimeter += segmentLengthM(w.points[i], w.points[(i + 1) % w.points.length], userScale);
    }
  }
  for (const w of innerWalls) {
    for (let i = 0; i < w.points.length - 1; i++) {
      innerTotal += segmentLengthM(w.points[i], w.points[i + 1], userScale);
    }
    if (w.closed && w.points.length > 2) {
      innerTotal += segmentLengthM(w.points[w.points.length - 1], w.points[0], userScale);
    }
  }

  return (
    <div className="space-y-3">
      {/* Панель инструментов */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Режим */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          {(["outer", "inner"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === m ? (m === "outer" ? "#00D4FF22" : "#FF6B1A22") : "transparent",
                color: mode === m ? (m === "outer" ? "#00D4FF" : "#FF6B1A") : "rgba(255,255,255,0.4)",
                borderRight: m === "outer" ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: m === "outer" ? "#00D4FF" : "#FF6B1A" }} />
              {m === "outer" ? "Наружный контур" : "Внутренние стены"}
            </button>
          ))}
        </div>

        {/* Масштаб */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="Ruler" size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Масштаб:</span>
          <select value={userScale} onChange={e => setUserScale(+e.target.value)}
            className="bg-transparent text-white outline-none text-xs">
            <option value={0.025}>1 px = 2.5 см (1:40)</option>
            <option value={0.05}>1 px = 5 см (1:20)</option>
            <option value={0.10}>1 px = 10 см (1:10)</option>
            <option value={0.20}>1 px = 20 см (1:5)</option>
          </select>
        </div>

        {/* Подложка */}
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
          <Icon name="Image" size={12} />
          Подложка
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleBgUpload} />
        </label>

        {bgImage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Прозр.:</span>
            <input type="range" min={0.1} max={0.9} step={0.05} value={bgOpacity}
              onChange={e => setBgOpacity(+e.target.value)} className="w-20 h-1 accent-cyan-400" />
          </div>
        )}

        <button onClick={() => setShowDims(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
          style={{ background: showDims ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${showDims ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.1)"}`, color: showDims ? "#00D4FF" : "rgba(255,255,255,0.4)" }}>
          <Icon name="Ruler" size={12} />
          Размеры
        </button>

        <div className="ml-auto flex items-center gap-2">
          {drawing.length > 0 && (
            <button onClick={() => setDrawing([])}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              <Icon name="X" size={12} /> Отмена (Esc)
            </button>
          )}
          <button onClick={clearAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-all hover:bg-red-500/20"
            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Icon name="Trash2" size={12} /> Очистить
          </button>
        </div>
      </div>

      {/* Подсказка */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}>
        <Icon name="Info" size={12} />
        {drawing.length === 0
          ? mode === "outer"
            ? "Кликай по точкам контура. Замкни контур кликом на первую точку. Сетка = привязка к узлам."
            : "Кликай по точкам внутренней несущей стены. Двойной клик — завершить. Esc — отмена."
          : `${drawing.length} точек. ${mode === "outer" ? "Кликни на первую точку чтобы замкнуть" : "Двойной клик — завершить линию. Esc — отмена."}`}
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1">
          <canvas
            ref={canvasRef}
            width={680}
            height={460}
            className="rounded-xl cursor-crosshair w-full"
            style={{ border: "1px solid rgba(255,255,255,0.08)", display: "block" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDoubleClick={handleDblClick}
          />
        </div>

        {/* Правая панель — результаты */}
        <div className="w-52 flex-shrink-0 space-y-3">
          {/* Итоги */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Итого</div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#00D4FF" }}>Наружный контур</span>
              <span className="text-sm font-bold text-white">{outerPerimeter.toFixed(2)} м</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#FF6B1A" }}>Внутренние стены</span>
              <span className="text-sm font-bold text-white">{innerTotal.toFixed(2)} м</span>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Всего лент</span>
              <span className="text-base font-bold" style={{ color: "var(--neon-green)" }}>{(outerPerimeter + innerTotal).toFixed(2)} м</span>
            </div>
          </div>

          {/* Список нарисованных контуров */}
          {walls.length > 0 && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Контуры</div>
              {walls.map(w => {
                let wLen = 0;
                const pts = w.closed ? [...w.points, w.points[0]] : w.points;
                for (let i = 0; i < pts.length - 1; i++) wLen += segmentLengthM(pts[i], pts[i + 1], userScale);
                return (
                  <div key={w.id} className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: w.type === "outer" ? "#00D4FF" : "#FF6B1A" }} />
                      <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{w.label}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-bold" style={{ color: w.type === "outer" ? "#00D4FF" : "#FF6B1A" }}>{wLen.toFixed(1)}м</span>
                      <button onClick={() => removeWall(w.id)} className="w-4 h-4 flex items-center justify-center hover:text-red-400 transition-colors" style={{ color: "rgba(255,255,255,0.2)" }}>
                        <Icon name="X" size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Горячие клавиши */}
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>Клавиши</div>
            {[
              ["Клик", "добавить точку"],
              ["×2 клик", "завершить линию"],
              ["Esc", "отмена"],
              ["Ctrl+Z", "удалить посл."],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 10 }}>{k}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
