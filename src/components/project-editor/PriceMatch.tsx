import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

const PROJECTS_URL = "https://functions.poehali.dev/08f0cecd-b702-442e-8c9d-69c921c1b68e";

interface BomItem {
  section: string;
  name: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  note?: string;
}

interface PriceMatchResult {
  matched_name: string;
  unit: string;
  price_per_unit: number;
  company: string;
  supplier_id: number;
  score: number;
}

interface PriceMatchProps {
  token: string;
  items: BomItem[];
  onApply: (items: BomItem[]) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export default function PriceMatch({ token, items, onApply }: PriceMatchProps) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Record<string, PriceMatchResult | null> | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{ total: number; found: number } | null>(null);

  const runMatch = useCallback(async () => {
    setLoading(true);
    setMatches(null);
    setOverrides({});
    try {
      const names = [...new Set(items.map(it => it.name))];
      const res = await fetch(`${PROJECTS_URL}?action=price_match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ names }),
      });
      const data = await res.json();
      if (data.ok) {
        setMatches(data.matches);
        setStats({ total: data.total, found: data.found });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [token, items]);

  const getPrice = (name: string): number => {
    if (overrides[name] !== undefined) return overrides[name];
    return matches?.[name]?.price_per_unit ?? 0;
  };

  const handleApply = () => {
    const enriched = items.map(it => ({
      ...it,
      price_per_unit: getPrice(it.name) || it.price_per_unit,
    }));
    onApply(enriched);
  };

  // Группируем по разделу для отображения
  const grouped: Record<string, BomItem[]> = {};
  items.forEach(it => {
    if (!grouped[it.section]) grouped[it.section] = [];
    grouped[it.section].push(it);
  });

  // Итог
  const totalCost = items.reduce((sum, it) => sum + it.qty * getPrice(it.name), 0);
  const pricedCount = items.filter(it => getPrice(it.name) > 0).length;

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-white">Подбор цен поставщиков</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {items.length} позиций в ВОР · система найдёт совпадения в прайс-листах поставщиков
          </p>
        </div>
        <button
          onClick={runMatch}
          disabled={loading || items.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 flex-shrink-0"
          style={{ background: "var(--neon-orange)", color: "#000" }}>
          {loading
            ? <><Icon name="Loader2" size={15} className="animate-spin" /> Подбираю...</>
            : <><Icon name="Zap" size={15} /> {matches ? "Обновить" : "Подобрать цены"}</>
          }
        </button>
      </div>

      {/* Статистика после подбора */}
      {stats && matches && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.2)" }}>
            <div className="text-2xl font-bold" style={{ color: "var(--neon-green)" }}>{stats.found}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Найдено совпадений</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,107,26,0.07)", border: "1px solid rgba(255,107,26,0.2)" }}>
            <div className="text-2xl font-bold" style={{ color: "var(--neon-orange)" }}>{stats.total - stats.found}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Без совпадений</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)" }}>
            <div className="text-lg font-bold" style={{ color: "var(--neon-cyan)" }}>{fmt(totalCost)} ₽</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Предв. стоимость</div>
          </div>
        </div>
      )}

      {/* Таблица позиций */}
      {matches && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Шапка */}
          <div className="grid text-xs font-semibold px-3 py-2"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1fr", background: "rgba(20,26,40,0.95)", color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span>Наименование</span>
            <span className="text-right">Кол-во</span>
            <span className="text-right">Цена/ед.</span>
            <span className="text-center">Совпадение</span>
            <span className="text-right">Сумма</span>
          </div>

          <div className="max-h-[480px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {Object.entries(grouped).map(([section, sectionItems]) => (
              <div key={section}>
                {/* Заголовок раздела */}
                <div className="px-3 py-1.5 text-xs font-semibold sticky top-0"
                  style={{ background: "rgba(12,16,24,0.98)", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {section}
                </div>

                {sectionItems.map((item, i) => {
                  const match = matches[item.name];
                  const price = getPrice(item.name);
                  const sum = item.qty * price;
                  const hasOverride = overrides[item.name] !== undefined;
                  const confidence = match ? Math.min(100, Math.round(match.score * 10)) : 0;

                  return (
                    <div key={i}
                      className="grid items-center px-3 py-2.5 text-xs"
                      style={{
                        gridTemplateColumns: "2fr 1fr 1fr 1.5fr 1fr",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                        background: match ? "transparent" : "rgba(239,68,68,0.02)",
                      }}>

                      {/* Название */}
                      <div className="min-w-0 pr-2">
                        <div className="text-white font-medium truncate">{item.name}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {item.unit}
                          {item.note && <span className="ml-1">· {item.note}</span>}
                        </div>
                      </div>

                      {/* Количество */}
                      <div className="text-right font-bold" style={{ color: "rgba(255,255,255,0.8)" }}>
                        {item.qty.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
                        <span className="ml-1 font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>{item.unit}</span>
                      </div>

                      {/* Цена (редактируемая) */}
                      <div className="text-right">
                        <input
                          type="number"
                          value={price || ""}
                          placeholder="—"
                          onChange={e => setOverrides(prev => ({ ...prev, [item.name]: +e.target.value }))}
                          className="w-full text-right px-1.5 py-1 rounded-lg text-xs outline-none"
                          style={{
                            background: hasOverride ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${hasOverride ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                            color: price > 0 ? "var(--neon-green)" : "rgba(255,255,255,0.3)",
                          }}
                        />
                      </div>

                      {/* Совпадение */}
                      <div className="px-2">
                        {match ? (
                          <div>
                            <div className="truncate font-medium" style={{ color: confidence >= 60 ? "rgba(255,255,255,0.7)" : "rgba(255,165,0,0.8)" }}
                              title={match.matched_name}>
                              {match.matched_name.length > 30 ? match.matched_name.slice(0, 30) + "…" : match.matched_name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${confidence}%`, background: confidence >= 60 ? "var(--neon-green)" : "#FBBF24" }} />
                              </div>
                              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{confidence}%</span>
                              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{match.company.split(" ").slice(-1)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1" style={{ color: "rgba(239,68,68,0.6)" }}>
                            <Icon name="X" size={11} />
                            <span style={{ fontSize: 10 }}>не найдено</span>
                          </div>
                        )}
                      </div>

                      {/* Сумма */}
                      <div className="text-right font-bold">
                        {sum > 0
                          ? <span style={{ color: "var(--neon-cyan)" }}>{fmt(sum)} ₽</span>
                          : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Итог */}
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: "rgba(0,212,255,0.05)", borderTop: "1px solid rgba(0,212,255,0.15)" }}>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Проценён: <span className="font-bold text-white">{pricedCount}</span> из <span className="font-bold text-white">{items.length}</span> позиций
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Итого: </span>
                <span className="text-lg font-bold" style={{ color: "var(--neon-green)" }}>{fmt(totalCost)} ₽</span>
              </div>
              <button
                onClick={handleApply}
                disabled={pricedCount === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--neon-green)", color: "#000" }}>
                <Icon name="CheckCircle" size={15} />
                Применить цены
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Пустое состояние */}
      {!matches && !loading && (
        <div className="rounded-xl py-10 text-center" style={{ border: "2px dashed rgba(255,255,255,0.07)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(255,107,26,0.1)" }}>
            <Icon name="Zap" size={22} style={{ color: "var(--neon-orange)" }} />
          </div>
          <p className="text-white font-medium mb-1">Автоматический подбор цен</p>
          <p className="text-xs max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
            Нажми «Подобрать цены» — система сравнит {items.length} позиций ВОР с прайс-листами поставщиков
            и найдёт ближайшие совпадения по названию
          </p>
        </div>
      )}
    </div>
  );
}
