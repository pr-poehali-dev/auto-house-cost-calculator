import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/components/ui/icon";

const MAT_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";
const AI_URL = "https://functions.poehali.dev/8ecbdbca-904c-4ffc-a3b2-3279170e95ee";

function fmt(n: number) { return new Intl.NumberFormat("ru-RU").format(Math.round(n)); }


interface Material {
  id: number; item_type: string; category: string; name: string; unit: string;
  price_per_unit: number; qty_formula: string; article: string; description: string;
  best_price: number | null; best_price_updated_at: string | null;
  sort_order: number; is_active: boolean; updated_at: string;
  offers?: Offer[];
}

interface Offer {
  id: number; supplier_id: number; company: string; region?: string;
  price: number; location: string; note: string; updated_at: string;
}

interface AiItem {
  section: string; name: string; unit: string; qty: number; price_per_unit: number; note: string;
}

interface StaffUser { id: number; full_name: string; role_code: string; }

function apiFetch(url: string, opts: RequestInit = {}, token?: string) {
  return fetch(url, {
    ...opts,
    headers: { "Content-Type":"application/json", ...(token ? {"X-Auth-Token":token} : {}), ...(opts.headers||{}) },
  }).then(r => r.json());
}

const TYPE_COLORS: Record<string, string> = { material: "var(--neon-cyan)", work: "var(--neon-orange)" };
const TYPE_LABELS: Record<string, string> = { material: "Материал", work: "Работа" };

// ─── OffersPanel ──────────────────────────────────────────────────────────────

function OffersPanel({ material, token, role, onAccept }: { material: Material; token: string; role: string; onAccept: () => void }) {
  const [offers, setOffers] = useState<Offer[]>(material.offers || []);
  const [loading, setLoading] = useState(!material.offers);

  useEffect(() => {
    if (!material.offers) {
      apiFetch(`${MAT_URL}?action=offers&material_id=${material.id}`, {}, token)
        .then(r => { setOffers(r.offers || []); setLoading(false); });
    }
  }, [material, token]);

  const acceptBest = async () => {
    await apiFetch(`${MAT_URL}?action=accept_best_price`, {
      method: "POST", body: JSON.stringify({ material_id: material.id }),
    }, token);
    onAccept();
  };

  if (loading) return <div className="py-3 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка...</div>;
  if (!offers.length) return <div className="py-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Предложений от поставщиков нет</div>;

  const best = offers[0];
  const saving = best.price < material.price_per_unit ? material.price_per_unit - best.price : 0;

  return (
    <div className="space-y-2">
      {offers.map(o => (
        <div key={o.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{ background: o.id === best.id ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${o.id === best.id ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.06)"}` }}>
          <div>
            <div className="text-xs font-medium text-white">{o.company}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{o.location || o.region || "—"} {o.note ? `· ${o.note}` : ""}</div>
          </div>
          <div className="text-right">
            <div className="font-display font-bold text-sm" style={{ color: o.id === best.id ? "var(--neon-green)" : "rgba(255,255,255,0.7)" }}>
              {fmt(o.price)} ₽/{material.unit}
            </div>
            {o.id === best.id && <div className="text-xs" style={{ color: "var(--neon-green)" }}>Лучшая цена</div>}
          </div>
        </div>
      ))}
      {saving > 0 && role in {"constructor":1,"architect":1,"supply":1} && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Экономия vs текущей: <span style={{ color: "var(--neon-green)" }}>{fmt(saving)} ₽/{material.unit}</span>
          </div>
          <button onClick={acceptBest}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(0,255,136,0.15)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.3)" }}>
            Принять лучшую цену
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SpecUploader ─────────────────────────────────────────────────────────────

function SpecUploader({ token, projectId, specId, onImport }: {
  token: string; projectId?: number; specId?: number; onImport: (items: AiItem[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle"|"processing"|"done"|"error">("idle");
  const [result, setResult] = useState<AiItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true); setStatus("processing"); setResult([]); setErrorMsg("");
    try {
      // Шаг 1: получаем presigned URL для загрузки в S3
      const pre = await apiFetch(`${AI_URL}?action=presigned_spec`, {
        method: "POST",
        body: JSON.stringify({ file_name: file.name, project_id: projectId }),
      }, token);
      if (!pre.presigned_url) { setStatus("error"); setErrorMsg(pre.error || "Ошибка получения ссылки"); setUploading(false); return; }

      // Шаг 2: загружаем файл напрямую в S3
      await fetch(pre.presigned_url, {
        method: "PUT",
        body: file,
      });

      // Шаг 3: запускаем AI-разбор по s3_key
      const r = await apiFetch(`${AI_URL}?action=upload_spec`, {
        method: "POST",
        body: JSON.stringify({ s3_key: pre.s3_key, file_name: file.name, project_id: projectId, spec_id: specId }),
      }, token);

      if (r.status === "done" && r.items?.length) {
        setStatus("done");
        setResult(r.items);
        setSelected(new Set(r.items.map((_: AiItem, i: number) => i)));
      } else if (r.error) {
        setStatus("error"); setErrorMsg(r.error);
      } else {
        setStatus("error"); setErrorMsg("AI не распознал позиции в файле. Убедитесь что PDF содержит текст (не скан).");
      }
    } catch (e) {
      setStatus("error"); setErrorMsg(String(e));
    }
    setUploading(false);
  };

  const toggleSelect = (i: number) =>
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(i)) { s.delete(i); } else { s.add(i); }
      return s;
    });

  const importSelected = () => {
    const items = result.filter((_, i) => selected.has(i));
    onImport(items);
    setStatus("idle"); setResult([]);
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--neon-orange)" }}>AI-ассистент</div>
          <h3 className="font-display font-semibold text-lg text-white">Загрузка спецификации</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>PDF или Excel — AI извлечёт позиции и заполнит ВОР</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,107,26,0.15)", border: "1px solid rgba(255,107,26,0.3)" }}>
          <Icon name="Sparkles" size={20} style={{ color: "var(--neon-orange)" }} />
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
        onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

      {status === "idle" && (
        <button onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-all hover:border-orange-400/50 cursor-pointer"
          style={{ borderColor: "rgba(255,107,26,0.25)", color: "rgba(255,255,255,0.4)" }}>
          <Icon name="Upload" size={20} style={{ color: "var(--neon-orange)" }} />
          <span>Нажмите или перетащите файл спецификации</span>
          <span className="text-xs">(PDF, Excel)</span>
        </button>
      )}

      {status === "processing" && (
        <div className="py-10 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(255,107,26,0.1)", border: "1px solid rgba(255,107,26,0.3)" }}>
            <Icon name="Loader" size={24} style={{ color: "var(--neon-orange)", animation: "spin 1s linear infinite" }} />
          </div>
          <div className="text-white font-medium">AI анализирует файл...</div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Это займёт 10–30 секунд</div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-start gap-2">
            <Icon name="AlertCircle" size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
            <div>
              <div className="text-sm font-medium" style={{ color: "#ef4444" }}>Ошибка обработки</div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{errorMsg}</div>
            </div>
          </div>
          <button onClick={() => setStatus("idle")} className="mt-3 text-xs underline" style={{ color: "rgba(255,255,255,0.4)" }}>
            Попробовать снова
          </button>
        </div>
      )}

      {status === "done" && result.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              Найдено позиций: <span className="text-white font-semibold">{result.length}</span>
              {" · "}Выбрано: <span style={{ color: "var(--neon-green)" }}>{selected.size}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(result.map((_, i) => i)))}
                className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                Все
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                Снять
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden mb-4" style={{ border: "1px solid rgba(255,255,255,0.07)", maxHeight: 320, overflowY: "auto" }}>
            <table className="w-full text-xs">
              <thead style={{ position: "sticky", top: 0 }}>
                <tr style={{ background: "rgba(20,26,40,0.98)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Раздел</th>
                  <th className="p-2 text-left font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Наименование</th>
                  <th className="p-2 text-center font-semibold w-16" style={{ color: "rgba(255,255,255,0.4)" }}>Ед.</th>
                  <th className="p-2 text-right font-semibold w-16" style={{ color: "rgba(255,255,255,0.4)" }}>Кол-во</th>
                  <th className="p-2 text-right font-semibold w-24" style={{ color: "rgba(255,255,255,0.4)" }}>Цена ₽</th>
                </tr>
              </thead>
              <tbody>
                {result.map((item, i) => (
                  <tr key={i} onClick={() => toggleSelect(i)} className="cursor-pointer hover:bg-white/5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: selected.has(i) ? "rgba(0,212,255,0.04)" : "transparent" }}>
                    <td className="p-2 text-center">
                      <div className="w-4 h-4 rounded flex items-center justify-center mx-auto"
                        style={{ background: selected.has(i) ? "var(--neon-cyan)" : "rgba(255,255,255,0.1)" }}>
                        {selected.has(i) && <Icon name="Check" size={10} style={{ color: "#000" }} />}
                      </div>
                    </td>
                    <td className="p-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{item.section}</td>
                    <td className="p-2 text-white">{item.name}</td>
                    <td className="p-2 text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                    <td className="p-2 text-right" style={{ color: "rgba(255,255,255,0.7)" }}>{item.qty || "—"}</td>
                    <td className="p-2 text-right font-semibold" style={{ color: item.price_per_unit ? "var(--neon-green)" : "rgba(255,255,255,0.3)" }}>
                      {item.price_per_unit ? fmt(item.price_per_unit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={importSelected} disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--neon-green), #00cc66)", color: "#0A0D14", boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}>
              <Icon name="FileInput" size={15} />
              Импортировать в ВОР ({selected.size} поз.)
            </button>
            <button onClick={() => { setStatus("idle"); setResult([]); }}
              className="px-4 py-3 rounded-xl text-sm transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main MaterialsDB ─────────────────────────────────────────────────────────

export default function MaterialsDB({ user, token, onImportToSpec }: {
  user: StaffUser; token: string; onImportToSpec?: (items: AiItem[]) => void;
}) {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCat, setFilterCat] = useState("Все");
  const [filterType, setFilterType] = useState("Все");
  const [search, setSearch] = useState("");
  const [openOffers, setOpenOffers] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<Material>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ item_type:"material", category:"", name:"", unit:"шт", price_per_unit:0, qty_formula:"", article:"", description:"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [tab, setTab] = useState<"db"|"ai">("db");

  const role = user.role_code;
  const canEdit = ["constructor","architect","supply"].includes(role);
  const canCreate = ["constructor","architect"].includes(role);

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

  const filtered = items.filter(it => {
    if (filterCat !== "Все" && it.category !== filterCat) return false;
    if (filterType !== "Все" && it.item_type !== filterType) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase()) && !it.article.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const saveEdit = async (id: number) => {
    setSaving(true);
    await apiFetch(`${MAT_URL}?action=update`, { method:"POST", body:JSON.stringify({ id, ...editBuf }) }, token);
    setSaving(false); setEditingId(null); load();
  };

  const createItem = async () => {
    if (!addForm.category || !addForm.name || !addForm.unit) { setMsg("Заполните обязательные поля"); return; }
    setSaving(true);
    const r = await apiFetch(`${MAT_URL}?action=create`, { method:"POST", body:JSON.stringify(addForm) }, token);
    setSaving(false);
    if (r.ok) { setMsg("Добавлено!"); setShowAdd(false); load(); setAddForm({ item_type:"material", category:"", name:"", unit:"шт", price_per_unit:0, qty_formula:"", article:"", description:"" }); }
    else setMsg(r.error || "Ошибка");
  };

  const inpCls = "w-full px-3 py-2 rounded-xl text-sm text-white outline-none";
  const inpSty = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)" };

  const totalMaterials = items.filter(i => i.item_type === "material").length;
  const totalWorks = items.filter(i => i.item_type === "work").length;
  const withOffers = items.filter(i => (i.offers?.length || 0) > 0 || i.best_price !== null).length;

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
          {[{id:"db", label:"База материалов", icon:"Database"},{id:"ai", label:"AI-загрузка спецификации", icon:"Sparkles"}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as "db"|"ai")}
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
                  <select value={addForm.item_type} onChange={e => setAddForm(p => ({...p, item_type:e.target.value}))}
                    className={inpCls} style={{...inpSty, background:"#1a1f2e"}}>
                    <option value="material">Материал</option>
                    <option value="work">Работа</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Категория *</div>
                  <input list="cats" value={addForm.category} onChange={e => setAddForm(p => ({...p, category:e.target.value}))}
                    placeholder="Фундамент" className={inpCls} style={inpSty} />
                  <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="col-span-2">
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Наименование *</div>
                  <input value={addForm.name} onChange={e => setAddForm(p => ({...p, name:e.target.value}))}
                    placeholder="Бетон М300" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Ед. изм. *</div>
                  <input value={addForm.unit} onChange={e => setAddForm(p => ({...p, unit:e.target.value}))}
                    placeholder="м³" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Цена, ₽</div>
                  <input type="number" value={addForm.price_per_unit} onChange={e => setAddForm(p => ({...p, price_per_unit:+e.target.value}))}
                    className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Артикул</div>
                  <input value={addForm.article} onChange={e => setAddForm(p => ({...p, article:e.target.value}))}
                    placeholder="ФН-001" className={inpCls} style={inpSty} />
                </div>
                <div>
                  <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Формула кол-ва</div>
                  <input value={addForm.qty_formula} onChange={e => setAddForm(p => ({...p, qty_formula:e.target.value}))}
                    placeholder="area*0.25" className={inpCls} style={inpSty} />
                </div>
              </div>
              {msg && <div className="mt-3 text-sm" style={{ color: msg==="Добавлено!" ? "var(--neon-green)" : "#ef4444" }}>{msg}</div>}
              <div className="flex gap-2 mt-4">
                <button onClick={createItem} disabled={saving}
                  className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-all hover:scale-105"
                  style={{ background:"#A855F7", color:"#fff" }}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-5 py-2 rounded-xl text-sm hover:bg-white/10"
                  style={{ border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)" }}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-48" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <Icon name="Search" size={14} style={{ color:"rgba(255,255,255,0.3)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по названию или артикулу..." className="bg-transparent outline-none text-sm text-white flex-1"
                style={{ color:"rgba(255,255,255,0.8)" }} />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white outline-none"
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)" }}>
              <option value="Все">Все типы</option>
              <option value="material">Материалы</option>
              <option value="work">Работы</option>
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white outline-none"
              style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)" }}>
              <option value="Все">Все категории</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="text-xs mb-3" style={{ color:"rgba(255,255,255,0.35)" }}>Показано: {filtered.length} из {items.length}</div>

          {loading ? (
            <div className="text-center py-16" style={{ color:"rgba(255,255,255,0.3)" }}>Загрузка базы...</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border:"1px solid var(--card-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                    {["Тип","Категория","Наименование","Артикул","Ед.","Цена базовая","Лучшая цена","Поставщики",""].map((h,i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color:"rgba(255,255,255,0.35)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <>
                      <tr key={item.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?"rgba(255,255,255,0.015)":"transparent" }}>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background:`${TYPE_COLORS[item.item_type]}15`, color:TYPE_COLORS[item.item_type], border:`1px solid ${TYPE_COLORS[item.item_type]}30` }}>
                            {TYPE_LABELS[item.item_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color:"rgba(255,255,255,0.45)" }}>{item.category}</td>
                        <td className="px-4 py-3">
                          {editingId === item.id ? (
                            <input defaultValue={item.name} onChange={e => setEditBuf(b => ({...b, name:e.target.value}))}
                              className="px-2 py-1 rounded text-xs text-white outline-none w-full"
                              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(168,85,247,0.4)" }} />
                          ) : (
                            <div>
                              <div className="text-white font-medium">{item.name}</div>
                              {item.description && <div className="text-xs mt-0.5" style={{ color:"rgba(255,255,255,0.3)" }}>{item.description}</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color:"rgba(255,255,255,0.4)" }}>{item.article}</td>
                        <td className="px-4 py-3 text-xs" style={{ color:"rgba(255,255,255,0.5)" }}>{item.unit}</td>
                        <td className="px-4 py-3">
                          {editingId === item.id ? (
                            <input type="number" defaultValue={item.price_per_unit} onChange={e => setEditBuf(b => ({...b, price_per_unit:+e.target.value}))}
                              className="px-2 py-1 rounded text-xs text-white outline-none w-24"
                              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(168,85,247,0.4)" }} />
                          ) : (
                            <span className="font-semibold" style={{ color:"rgba(255,255,255,0.8)" }}>{fmt(item.price_per_unit)} ₽</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.best_price ? (
                            <div>
                              <div className="font-display font-bold text-sm" style={{ color:"var(--neon-green)" }}>{fmt(item.best_price)} ₽</div>
                              {item.best_price < item.price_per_unit && (
                                <div className="text-xs" style={{ color:"var(--neon-green)" }}>
                                  −{fmt(item.price_per_unit - item.best_price)}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-xs" style={{ color:"rgba(255,255,255,0.2)" }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setOpenOffers(openOffers === item.id ? null : item.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all hover:scale-105"
                            style={{ background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.08)" }}>
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
                                  style={{ background:"var(--neon-green)", color:"#000" }}>
                                  <Icon name="Check" size={11} />
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                                  style={{ color:"rgba(255,255,255,0.4)" }}>
                                  <Icon name="X" size={11} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingId(item.id); setEditBuf({}); }}
                                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10"
                                style={{ color:"rgba(255,255,255,0.3)" }}>
                                <Icon name="Pencil" size={12} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                      {openOffers === item.id && (
                        <tr key={`offers-${item.id}`} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                          <td colSpan={9} className="px-6 py-3" style={{ background:"rgba(0,255,136,0.02)" }}>
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