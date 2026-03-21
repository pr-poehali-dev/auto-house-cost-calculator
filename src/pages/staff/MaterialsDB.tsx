import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { MAT_URL, AI_URL, fmt, apiFetch, Material, AiItem, StaffUser, TYPE_COLORS, TYPE_LABELS } from "./materials-types";
import OffersPanel from "./OffersPanel";
import SpecUploader from "./SpecUploader";

// suppress unused
void AI_URL;

export default function MaterialsDB({ user, token, onImportToSpec }: {
  user: StaffUser; token: string; onImportToSpec?: (items: AiItem[]) => void;
}) {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState("Все");
  const [filterType, setFilterType] = useState("Все");
  const [search, setSearch] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<Material[] | null>(null);
  const [aiReply, setAiReply] = useState("");
  const [aiSearching, setAiSearching] = useState(false);
  const [openOffers, setOpenOffers] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<Material>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ item_type: "material", category: "", name: "", unit: "шт", price_per_unit: 0, qty_formula: "", article: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [tab, setTab] = useState<"db" | "ai">("db");

  const role = user.role_code;
  const canEdit = ["constructor", "architect", "supply"].includes(role);
  const canCreate = ["constructor", "architect"].includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const [matRes, catRes] = await Promise.all([
      apiFetch(`${MAT_URL}?action=list&with_offers=1`, {}, token),
      apiFetch(`${MAT_URL}?action=categories`, {}, token),
    ]);
    setItems(matRes.items || []);
    setCategories(catRes.categories || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const doAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiSearching(true); setAiReply(""); setAiResult(null);
    const res = await apiFetch(`${MAT_URL}?action=ai_search`, { method: "POST", body: JSON.stringify({ query: aiQuery }) }, token);
    setAiSearching(false);
    if (res.items) { setAiResult(res.items); setAiReply(res.ai_reply || ""); }
  };

  const clearAiSearch = () => { setAiResult(null); setAiReply(""); setAiQuery(""); };

  const displayItems = aiResult !== null ? aiResult : items;

  const filtered = displayItems.filter(it => {
    if (aiResult !== null) return true;
    if (filterCat !== "Все" && it.category !== filterCat) return false;
    if (filterType !== "Все" && it.item_type !== filterType) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase()) && !it.article.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const saveEdit = async (id: number) => {
    setSaving(true);
    await apiFetch(`${MAT_URL}?action=update`, { method: "POST", body: JSON.stringify({ id, ...editBuf }) }, token);
    setSaving(false); setEditingId(null); load();
  };

  const createItem = async () => {
    if (!addForm.category || !addForm.name || !addForm.unit) { setMsg("Заполните обязательные поля"); return; }
    setSaving(true);
    const r = await apiFetch(`${MAT_URL}?action=create`, { method: "POST", body: JSON.stringify(addForm) }, token);
    setSaving(false);
    if (r.ok) { setMsg("Добавлено!"); setShowAdd(false); load(); setAddForm({ item_type: "material", category: "", name: "", unit: "шт", price_per_unit: 0, qty_formula: "", article: "", description: "" }); }
    else setMsg(r.error || "Ошибка");
  };

  const inpCls = "w-full px-3 py-2 rounded-xl text-sm text-white outline-none";
  const inpSty = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" };

  const totalMaterials = items.filter(i => i.item_type === "material").length;
  const totalWorks = items.filter(i => i.item_type === "work").length;
  const withOffers = items.filter(i => (i.offers?.length || 0) > 0 || i.best_price !== null).length;

  // suppress unused
  void showAI; void setShowAI;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#A855F7" }}>База данных</div>
          <h2 className="font-display text-2xl font-bold text-white">Материалы и работы</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {totalMaterials} материалов · {totalWorks} видов работ · {withOffers} с ценами поставщиков
          </p>
        </div>
        <div className="flex gap-2">
          {onImportToSpec && (
            <button onClick={() => setTab("ai")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,107,26,0.12)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.25)" }}>
              <Icon name="Sparkles" size={14} />
              AI-загрузка
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "#A855F7", color: "#fff", boxShadow: "0 0 20px rgba(168,85,247,0.35)" }}>
              <Icon name="Plus" size={14} />
              Добавить
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {onImportToSpec && (
        <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          {[{ id: "db", label: "База материалов", icon: "Database" }, { id: "ai", label: "AI-загрузка спецификации", icon: "Sparkles" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as "db" | "ai")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: tab === t.id ? "#A855F7" : "transparent", color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)" }}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* AI tab */}
      {tab === "ai" && onImportToSpec && (
        <SpecUploader token={token} onImport={items => { onImportToSpec(items); setTab("db"); }} />
      )}

      {/* DB tab */}
      {tab === "db" && (
        <>
          {/* Add form */}
          {showAdd && canCreate && (
            <div className="rounded-2xl p-5 mb-6 animate-scale-in" style={{ background: "var(--card-bg)", border: "1px solid rgba(168,85,247,0.25)" }}>
              <h3 className="font-display font-semibold text-base text-white mb-4">Новая позиция</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Тип *</div>
                  <select value={addForm.item_type} onChange={e => setAddForm(p => ({ ...p, item_type: e.target.value }))}
                    className={inpCls} style={{ ...inpSty, background: "#1a1f2e" }}>
                    <option value="material">Материал</option>
                    <option value="work">Работа</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Категория *</div>
                  <input list="cats" value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
                    placeholder="Фундамент" className={inpCls} style={inpSty} />
                  <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="col-span-2">
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Наименование *</div>
                  <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Бетон М300" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Ед. изм. *</div>
                  <input value={addForm.unit} onChange={e => setAddForm(p => ({ ...p, unit: e.target.value }))}
                    placeholder="м³" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Цена, ₽</div>
                  <input type="number" value={addForm.price_per_unit} onChange={e => setAddForm(p => ({ ...p, price_per_unit: +e.target.value }))}
                    className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Артикул</div>
                  <input value={addForm.article} onChange={e => setAddForm(p => ({ ...p, article: e.target.value }))}
                    placeholder="ФН-001" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Формула кол-ва</div>
                  <input value={addForm.qty_formula} onChange={e => setAddForm(p => ({ ...p, qty_formula: e.target.value }))}
                    placeholder="area*0.25" className={inpCls} style={inpSty} />
                </div>
              </div>
              {msg && <div className="mt-3 text-sm" style={{ color: msg === "Добавлено!" ? "var(--neon-green)" : "#ef4444" }}>{msg}</div>}
              <div className="flex gap-2 mt-4">
                <button onClick={createItem} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-all hover:scale-105"
                  style={{ background: "#A855F7", color: "#fff" }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-5 py-2 rounded-xl text-sm hover:bg-white/10"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* AI-поиск */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(0,212,255,0.05))", border: "1px solid rgba(168,85,247,0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Sparkles" size={14} style={{ color: "#a78bfa" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#a78bfa" }}>AI-ассистент поиска</span>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl flex-1" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(168,85,247,0.3)" }}>
                <Icon name="MessageCircle" size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doAiSearch()}
                  placeholder="Опишите что ищете... например: «утеплитель для фасада 50мм» или «крепёж для кровли»"
                  className="bg-transparent outline-none text-sm flex-1"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                />
                {aiQuery && <button onClick={clearAiSearch} style={{ color: "rgba(255,255,255,0.25)" }}><Icon name="X" size={13} /></button>}
              </div>
              <button onClick={doAiSearch} disabled={aiSearching || !aiQuery.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", boxShadow: "0 0 16px rgba(168,85,247,0.3)" }}>
                <Icon name={aiSearching ? "Loader" : "Search"} size={14} />
                {aiSearching ? "Ищу..." : "Найти"}
              </button>
            </div>
            {aiReply && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                <Icon name="Bot" size={14} style={{ color: "#a78bfa", marginTop: 2, flexShrink: 0 }} />
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{aiReply}</span>
              </div>
            )}
            {aiResult !== null && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Найдено: <b style={{ color: "#a78bfa" }}>{aiResult.length}</b> позиций</span>
                <button onClick={clearAiSearch} className="text-xs underline transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Сбросить и показать всё
                </button>
              </div>
            )}
          </div>

          {/* Доп. фильтры (только когда AI не активен) */}
          {aiResult === null && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-48" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Icon name="Search" size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Быстрый поиск по названию..." className="bg-transparent outline-none text-sm text-white flex-1"
                  style={{ color: "rgba(255,255,255,0.8)" }} />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="Все">Все типы</option>
                <option value="material">Материалы</option>
                <option value="work">Работы</option>
              </select>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="Все">Все категории</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
            {aiResult !== null
              ? <span>AI нашёл <b>{filtered.length}</b> позиций · <span style={{ color: "rgba(255,255,255,0.2)" }}>всего в базе: {items.length}</span></span>
              : <span>Показано: {filtered.length} из {items.length}</span>
            }
          </div>

          {loading ? (
            <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка базы...</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Тип", "Категория", "Наименование", "Артикул", "Ед.", "Цена базовая", "Лучшая цена", "Поставщики", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <>
                      <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: `${TYPE_COLORS[item.item_type]}15`, color: TYPE_COLORS[item.item_type], border: `1px solid ${TYPE_COLORS[item.item_type]}30` }}>
                            {TYPE_LABELS[item.item_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{item.category}</td>
                        <td className="px-4 py-3">
                          {editingId === item.id ? (
                            <input defaultValue={item.name} onChange={e => setEditBuf(b => ({ ...b, name: e.target.value }))}
                              className="px-2 py-1 rounded text-xs text-white outline-none w-full"
                              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(168,85,247,0.4)" }} />
                          ) : (
                            <div>
                              <div className="text-white font-medium">{item.name}</div>
                              {item.description && <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{item.description}</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{item.article}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                        <td className="px-4 py-3">
                          {editingId === item.id ? (
                            <input type="number" defaultValue={item.price_per_unit} onChange={e => setEditBuf(b => ({ ...b, price_per_unit: +e.target.value }))}
                              className="px-2 py-1 rounded text-xs text-white outline-none w-24"
                              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(168,85,247,0.4)" }} />
                          ) : (
                            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>{fmt(item.price_per_unit)} ₽</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.best_price ? (
                            <div>
                              <div className="font-display font-bold text-sm" style={{ color: "var(--neon-green)" }}>{fmt(item.best_price)} ₽</div>
                              {item.best_price < item.price_per_unit && (
                                <div className="text-xs" style={{ color: "var(--neon-green)" }}>
                                  −{fmt(item.price_per_unit - item.best_price)}
                                </div>
                              )}
                              {item.best_price_supplier && (
                                <div className="text-xs mt-0.5 truncate max-w-28" style={{ color: "rgba(255,255,255,0.35)" }}>{item.best_price_supplier}</div>
                              )}
                              {item.best_price_updated_at && (
                                <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                                  {new Date(item.best_price_updated_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setOpenOffers(openOffers === item.id ? null : item.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all hover:scale-105"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <Icon name="TrendingDown" size={11} />
                            Цены
                            {openOffers === item.id && <Icon name="ChevronUp" size={11} />}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          {canEdit && (
                            editingId === item.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => saveEdit(item.id)} disabled={saving}
                                  className="w-6 h-6 rounded flex items-center justify-center"
                                  style={{ background: "var(--neon-green)", color: "#000" }}>
                                  <Icon name="Check" size={11} />
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                                  style={{ color: "rgba(255,255,255,0.4)" }}>
                                  <Icon name="X" size={11} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingId(item.id); setEditBuf({}); }}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                                style={{ color: "rgba(255,255,255,0.3)" }}>
                                <Icon name="Pencil" size={12} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                      {openOffers === item.id && (
                        <tr key={`offers-${item.id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td colSpan={9} className="px-6 py-3" style={{ background: "rgba(0,255,136,0.02)" }}>
                            <OffersPanel material={item} token={token} role={role} onAccept={() => { setOpenOffers(null); load(); }} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
