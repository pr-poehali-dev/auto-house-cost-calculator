import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { AiItem } from "@/pages/staff/materials-types";

const BIM_URL = "https://functions.poehali.dev/396bc0ac-98b1-47c3-a0c6-438457c78d80";

interface BomItem {
  section: string;
  name: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  count?: number;
}

interface ParseResult {
  format: string;
  items: BomItem[];
  warnings: string[];
  elements_raw?: number;
  dwg_version?: string;
  file_size_kb?: number;
  text_preview?: string;
  text_fragments?: string[];
}

interface BimImporterProps {
  token: string;
  onImport: (items: AiItem[]) => void;
}

const FORMAT_INFO: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  IFC:   { label: "IFC",   icon: "Box",          color: "#00D4FF", desc: "BIM-модель из Renga, Revit, ArchiCAD — самый точный формат" },
  Excel: { label: "Excel", icon: "Table",         color: "#00FF88", desc: "Таблица ВОР или смета в формате .xlsx / .xls" },
  CSV:   { label: "CSV",   icon: "FileText",      color: "#10B981", desc: "Таблица ВОР в текстовом формате с разделителями" },
  PDF:   { label: "PDF",   icon: "FileText",      color: "#A855F7", desc: "Смета или ВОР в PDF — распознаётся через OCR" },
  DWG:   { label: "DWG",   icon: "PenTool",       color: "#FF6B1A", desc: "Чертёж AutoCAD — извлечение текстовых блоков (частичное)" },
};

const ACCEPT = ".ifc,.xlsx,.xls,.csv,.pdf,.dwg";

export default function BimImporter({ token, onImport }: BimImporterProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setError("");
    setResult(null);
    setSelected(new Set());
    await upload(f);
  };

  const upload = async (f: File) => {
    setLoading(true);
    setProgress("Читаю файл...");

    try {
      const arrayBuf = await f.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let b64 = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        b64 += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
      }
      b64 = btoa(b64);

      setProgress("Отправляю на сервер...");

      const res = await fetch(BIM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ file_b64: b64, filename: f.name }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Ошибка обработки файла");
        setLoading(false);
        setProgress("");
        return;
      }

      const parsed = data as ParseResult & { ok: boolean; filename: string };
      setResult(parsed);
      // Выбираем все позиции по умолчанию
      setSelected(new Set(parsed.items.map((_, i) => i)));

    } catch (e) {
      setError("Не удалось загрузить файл. Проверьте соединение.");
    }

    setLoading(false);
    setProgress("");
  };

  const toggleItem = (i: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selected.size === result.items.length) setSelected(new Set());
    else setSelected(new Set(result.items.map((_, i) => i)));
  };

  const handleImport = () => {
    if (!result) return;
    const items: AiItem[] = result.items
      .filter((_, i) => selected.has(i))
      .map(it => ({
        section: it.section,
        name: it.name,
        unit: it.unit,
        qty: it.qty,
        price_per_unit: it.price_per_unit || 0,
        note: `${result.format} импорт`,
      }));
    onImport(items);
  };

  // Группируем по разделу
  const grouped: Record<string, { item: BomItem; idx: number }[]> = {};
  if (result) {
    result.items.forEach((item, idx) => {
      if (!grouped[item.section]) grouped[item.section] = [];
      grouped[item.section].push({ item, idx });
    });
  }

  const formatInfo = result ? FORMAT_INFO[result.format] || FORMAT_INFO["IFC"] : null;

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div>
        <h3 className="font-display font-bold text-lg text-white">Импорт из проектного файла</h3>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Загрузи IFC из Renga/Revit, Excel-смету, PDF или DWG — система извлечёт объёмы для ВОР
        </p>
      </div>

      {/* Форматы */}
      {!result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(FORMAT_INFO).map(([fmt, info]) => (
            <div key={fmt} className="rounded-xl p-3 space-y-1.5"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${info.color}20` }}>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${info.color}15` }}>
                  <Icon name={info.icon} size={13} style={{ color: info.color }} />
                </div>
                <span className="text-xs font-bold" style={{ color: info.color }}>{info.label}</span>
              </div>
              <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{info.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Зона загрузки */}
      {!result && !loading && (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}
          className="rounded-2xl p-10 text-center cursor-pointer transition-all group"
          style={{ border: "2px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors group-hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <Icon name="Upload" size={24} style={{ color: "rgba(255,255,255,0.4)" }} />
          </div>
          <p className="text-white font-medium mb-1">Перетащи файл или нажми</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            IFC · XLSX · XLS · CSV · PDF · DWG
          </p>
        </div>
      )}

      {/* Загрузка */}
      {loading && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)" }}>
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-white font-medium">{progress || "Обработка..."}</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {file?.name} · {file ? (file.size / 1024).toFixed(0) : 0} КБ
          </p>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="rounded-xl p-4 flex gap-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <Icon name="AlertCircle" size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-medium">Ошибка обработки</p>
            <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => { setError(""); setFile(null); }} className="ml-auto text-red-400 hover:text-red-300">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className="space-y-3">
          {/* Шапка результата */}
          <div className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: `${formatInfo?.color}0d`, border: `1px solid ${formatInfo?.color}25` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${formatInfo?.color}18` }}>
              <Icon name={formatInfo?.icon || "File"} size={18} style={{ color: formatInfo?.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm">{file?.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${formatInfo?.color}20`, color: formatInfo?.color }}>
                  {result.format}
                </span>
                {result.dwg_version && (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{result.dwg_version}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span className="font-bold" style={{ color: "#00FF88" }}>{result.items.length} позиций</span>
                {result.elements_raw && <span>{result.elements_raw} элементов в модели</span>}
                {result.file_size_kb && <span>{result.file_size_kb} КБ</span>}
              </div>
            </div>
            <button onClick={() => { setResult(null); setFile(null); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/10 flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Icon name="RotateCcw" size={12} /> Другой файл
            </button>
          </div>

          {/* Предупреждения */}
          {result.warnings.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs" style={{ color: "#FBBF24" }}>
                  <Icon name="AlertTriangle" size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Текстовые фрагменты DWG */}
          {result.text_fragments && result.text_fragments.length > 0 && (
            <details className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <summary className="px-3 py-2 text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.03)" }}>
                Извлечённые текстовые блоки ({result.text_fragments.length})
              </summary>
              <div className="p-3 grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                {result.text_fragments.map((t, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded truncate"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}>{t}</span>
                ))}
              </div>
            </details>
          )}

          {/* Текстовый превью PDF */}
          {result.text_preview && (
            <details className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <summary className="px-3 py-2 text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.03)" }}>
                Распознанный текст (OCR)
              </summary>
              <div className="p-3 text-xs font-mono max-h-32 overflow-y-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
                {result.text_preview}
              </div>
            </details>
          )}

          {/* Позиции */}
          {result.items.length > 0 ? (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Контрол-бар */}
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={toggleAll}>
                    <div className="w-4 h-4 rounded flex items-center justify-center"
                      style={{ background: selected.size === result.items.length ? "var(--neon-cyan)" : "rgba(255,255,255,0.08)", border: selected.size === result.items.length ? "none" : "1px solid rgba(255,255,255,0.2)" }}>
                      {selected.size === result.items.length && <Icon name="Check" size={10} style={{ color: "#000" }} />}
                    </div>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Выбрано {selected.size} из {result.items.length}
                    </span>
                  </label>
                </div>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: "var(--neon-green)", color: "#000" }}>
                  <Icon name="ArrowDownToLine" size={13} />
                  Импортировать в ВОР ({selected.size})
                </button>
              </div>

              {/* Таблица по разделам */}
              <div className="max-h-96 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {Object.entries(grouped).map(([section, rows]) => {
                  const sectionSelected = rows.filter(r => selected.has(r.idx)).length;
                  return (
                    <div key={section}>
                      {/* Заголовок раздела */}
                      <div className="px-4 py-2 flex items-center justify-between sticky top-0"
                        style={{ background: "rgba(15,20,30,0.97)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {section}
                        </span>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {sectionSelected}/{rows.length}
                        </span>
                      </div>
                      {/* Строки */}
                      {rows.map(({ item, idx }) => {
                        const sel = selected.has(idx);
                        return (
                          <div key={idx}
                            onClick={() => toggleItem(idx)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.03)",
                              background: sel ? "rgba(0,212,255,0.03)" : "transparent",
                            }}>
                            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: sel ? "var(--neon-cyan)" : "rgba(255,255,255,0.06)", border: sel ? "none" : "1px solid rgba(255,255,255,0.12)" }}>
                              {sel && <Icon name="Check" size={9} style={{ color: "#000" }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white font-medium truncate">{item.name}</div>
                              {item.count && item.count > 1 && (
                                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                                  {item.count} элементов
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                              <span className="font-bold" style={{ color: sel ? "var(--neon-cyan)" : "rgba(255,255,255,0.7)" }}>
                                {item.qty.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
                              </span>
                              <span className="w-10 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                                {item.unit}
                              </span>
                              {item.price_per_unit > 0 && (
                                <span style={{ color: "var(--neon-green)" }}>
                                  {item.price_per_unit.toLocaleString("ru-RU")} ₽/{item.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl py-12 text-center" style={{ border: "2px dashed rgba(255,255,255,0.07)" }}>
              <div className="text-3xl mb-3">📭</div>
              <p className="text-white font-medium mb-1">Позиции не найдены</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                Проверь что файл содержит таблицу с объёмами.<br />
                Для IFC убедись что включён экспорт QuantitySets.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
