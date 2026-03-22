import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { API, apiFetch, formatMoney, type SupplierUser, type MatItem, type PriceRow, type PriceVersion, UNITS, CATS } from "./supplier-types";
import PriceListArchive from "./PriceListArchive";
import PriceListUpload from "./PriceListUpload";
import PriceListTable from "./PriceListTable";

const MAT_URL = "https://functions.poehali.dev/713860f8-f36f-4cbb-a1ba-0aadf96ecec9";

// ─── SupplierPriceOffer ───────────────────────────────────────────────────────

export function SupplierPriceOffer({ token, user }: { token: string; user: SupplierUser }) {
  const [items, setItems] = useState<MatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("Все");
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [location, setLocation] = useState(user.region || "");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    apiFetch(MAT_URL + "?action=public", {}).then(r => {
      setItems(r.items || []); setLoading(false);
    });
  }, []);

  const cats = ["Все", ...Array.from(new Set(items.map(i => i.category)))];
  const filtered = items.filter(i => {
    if (filterCat !== "Все" && i.category !== filterCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const submitPrice = async (materialId: number) => {
    const price = parseFloat(prices[materialId] || "0");
    if (!price || price <= 0) return;
    setSaving(materialId);
    await apiFetch(MAT_URL + "?action=offer_price", {
      method: "POST",
      body: JSON.stringify({ material_id: materialId, price, location }),
    }, token);
    setSaving(null);
    setSaved(prev => new Set([...prev, materialId]));
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Ценообразование</div>
        <h2 className="font-display text-2xl font-bold text-white">Предложить свои цены</h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Укажите цены на материалы — лучшие предложения автоматически обновят базу
        </p>
      </div>

      <div className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center"
        style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
        <div>
          <div className="text-xs mb-1 font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>Регион поставки</div>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Москва и МО"
            className="px-3 py-2 rounded-xl text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", minWidth: 220 }} />
        </div>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Ваши предложения будут видны только в привязке к выбранному региону
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-48" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск материала..." className="bg-transparent outline-none text-sm flex-1" style={{ color: "rgba(255,255,255,0.8)" }} />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: "rgba(255,255,255,0.3)" }}>Загрузка базы материалов...</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--card-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Категория","Наименование","Ед.","Текущая лучшая цена","Ваша цена, ₽",""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i%2 ? "rgba(255,255,255,0.015)" : "transparent" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{item.category}</td>
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3 text-xs text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{item.unit}</td>
                  <td className="px-4 py-3">
                    {item.best_price
                      ? <span className="font-display font-bold text-sm" style={{ color: "var(--neon-green)" }}>{formatMoney(item.best_price)}</span>
                      : <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={prices[item.id] || ""}
                      onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value }))}
                      placeholder="Введите цену"
                      className="w-32 px-3 py-2 rounded-xl text-sm text-white outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${saved.has(item.id) ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.1)"}`,
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {saved.has(item.id) ? (
                      <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>✓ Отправлено</span>
                    ) : (
                      <button
                        onClick={() => submitPrice(item.id)}
                        disabled={!prices[item.id] || saving === item.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-40"
                        style={{ background: "var(--neon-cyan)", color: "#000" }}>
                        {saving === item.id ? "..." : "Отправить"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── PriceListTab ─────────────────────────────────────────────────────────────

export function PriceListTab({ token }: { token: string }) {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [keyGen, setKeyGen] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [searchQ, setSearchQ] = useState<Record<number, string>>({});
  const [searchRes, setSearchRes] = useState<Record<number, {id:number;name:string;unit:string;category:string}[]>>({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [versions, setVersions] = useState<PriceVersion[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveItems, setArchiveItems] = useState<PriceRow[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");

  const addRow = () => {
    const k = keyGen + 1;
    setKeyGen(k);
    setRows(prev => [...prev, { material_name:"", unit:"шт", price_per_unit:"", category:"Прочее", article:"", note:"", _key: k }]);
  };

  const removeRow = (k: number) => setRows(prev => prev.filter(r => r._key !== k));

  const updateRow = (k: number, field: keyof PriceRow, value: unknown) => {
    setRows(prev => prev.map(r => r._key === k ? { ...r, [field]: value } : r));
  };

  useEffect(() => {
    apiFetch(API + "?action=price_list_get", {}, token).then(res => {
      if (res.items?.length) {
        const loaded: PriceRow[] = res.items.map((it: PriceRow & { _key?: number }, i: number) => ({ ...it, _key: i + 1 }));
        setRows(loaded);
        setKeyGen(loaded.length + 1);
      }
      if (res.versions?.length) setVersions(res.versions);
      setLoadingExisting(false);
    });
  }, [token]);

  const loadArchiveVersion = async (versionId: number) => {
    setArchiveLoading(true);
    const res = await apiFetch(API + `?action=price_list_version_get&version_id=${versionId}`, {}, token);
    setArchiveLoading(false);
    if (res.items) setArchiveItems(res.items.map((it: PriceRow, i: number) => ({ ...it, _key: i + 1 })));
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const searchMaterial = async (k: number, q: string) => {
    setSearchQ(prev => ({ ...prev, [k]: q }));
    updateRow(k, "material_name", q);
    if (q.length < 2) { setSearchRes(prev => ({ ...prev, [k]: [] })); return; }
    const res = await apiFetch(API + "?action=materials_search", { method: "POST", body: JSON.stringify({ q }) }, token);
    setSearchRes(prev => ({ ...prev, [k]: res.materials || [] }));
  };

  const pickMaterial = (k: number, mat: {id:number;name:string;unit:string;category:string}) => {
    setRows(prev => prev.map(r => r._key === k ? { ...r, material_id: mat.id, material_name: mat.name, unit: mat.unit, category: mat.category, is_new_material: false } : r));
    setSearchRes(prev => ({ ...prev, [k]: [] }));
    setSearchQ(prev => ({ ...prev, [k]: "" }));
  };

  const clearSearch = (k: number) => {
    setSearchRes(prev => ({ ...prev, [k]: [] }));
    updateRow(k, "material_name", searchQ[k] || "");
    setSearchQ(prev => ({ ...prev, [k]: "" }));
  };

  const handleFile = async (file: File) => {
    setUploading(true); setUploadMsg(""); setCurrentFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      const res = await apiFetch(API + "?action=upload_kp_file", {
        method: "POST",
        body: JSON.stringify({ file_base64: b64, file_name: file.name }),
      }, token);
      setUploading(false);
      if (res.parsed_items?.length) {
        const baseKey = keyGen + 1;
        const newRows: PriceRow[] = res.parsed_items.map((it: { name: string; name_clean?: string; unit: string; price_per_unit: number; category?: string; qty?: number }, i: number) => ({
          material_name: it.name_clean || it.name,
          unit: it.unit || "шт",
          price_per_unit: it.price_per_unit || "",
          category: it.category || "Прочее",
          article: "",
          note: "",
          is_new_material: true,
          _key: baseKey + i,
        }));
        setRows(prev => [...prev, ...newRows]);
        setKeyGen(baseKey + newRows.length);
        setUploadMsg(`✓ Распознано ${newRows.length} позиций. AI определил категории автоматически.`);
      } else {
        setUploadMsg(res.error || "Файл загружен, но позиции не распознаны автоматически. Добавьте вручную.");
      }
    };
    reader.readAsDataURL(file);
  };

  const classifyWithAI = async () => {
    const toClassify = rows.filter(r => r.material_name.trim());
    if (!toClassify.length) return;
    setClassifying(true); setMsg("");
    const res = await apiFetch(API + "?action=ai_classify", {
      method: "POST",
      body: JSON.stringify({ items: toClassify.map(r => ({ material_name: r.material_name, unit: r.unit, category: r.category })) }),
    }, token);
    setClassifying(false);
    if (res.ok && res.items) {
      setRows(prev => prev.map((row, idx) => {
        const updated = res.items[idx];
        if (!updated) return row;
        return { ...row, category: updated.category || row.category, unit: updated.unit || row.unit, material_name: updated.name_clean || row.material_name };
      }));
      setMsg("✓ AI распознал категории для всех позиций");
    } else {
      setMsg(res.error || "Ошибка AI-распознавания");
    }
  };

  const savePriceList = async () => {
    const valid = rows.filter(r => r.material_name.trim() && parseFloat(String(r.price_per_unit)) > 0);
    if (!valid.length) { setMsg("Нет позиций с ценой"); return; }
    setSaving(true); setMsg("");
    const items = valid.map(r => ({
      id: r.id || null,
      material_id: r.material_id || null,
      material_name: r.material_name,
      unit: r.unit,
      price_per_unit: parseFloat(String(r.price_per_unit)),
      category: r.category,
      article: r.article,
      note: r.note,
    }));
    const res = await apiFetch(API + "?action=price_list_save", { method: "POST", body: JSON.stringify({ items, file_name: currentFileName }) }, token);
    setSaving(false);
    if (res.ok) {
      setMsg(`✓ Сохранено ${res.saved} позиций. Лучшие цены обновлены в базе.`);
      apiFetch(API + "?action=price_list_get", {}, token).then(r => { if (r.versions) setVersions(r.versions); });
    } else {
      setMsg(res.error || "Ошибка сохранения");
    }
  };

  const priceDate = rows.length > 0 ? rows.find(r => r.valid_from)?.valid_from : null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--neon-cyan)" }}>Прайс-лист</div>
          <h2 className="font-display text-2xl font-bold text-white">Мой прайс-лист</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Загрузите файл Excel/PDF или добавьте позиции вручную. Лучшие цены автоматически попадут в базу.
          </p>
        </div>
        {priceDate && (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)" }}>
              <Icon name="CalendarCheck" size={14} style={{ color: "var(--neon-green)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--neon-green)" }}>
                Цены актуальны на {formatDate(priceDate)}
              </span>
            </div>
            {versions.length > 0 && (
              <button onClick={() => { setShowArchive(v => !v); if (!showArchive && archiveItems.length === 0) loadArchiveVersion(versions[0].id); }}
                className="flex items-center gap-1.5 text-xs transition-all hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                <Icon name="History" size={12} />
                История ({versions.length} версий)
              </button>
            )}
          </div>
        )}
      </div>

      {showArchive && versions.length > 0 && (
        <PriceListArchive
          versions={versions}
          archiveItems={archiveItems}
          archiveLoading={archiveLoading}
          onLoadVersion={loadArchiveVersion}
        />
      )}

      <PriceListUpload
        uploading={uploading}
        uploadMsg={uploadMsg}
        onFile={handleFile}
      />

      <PriceListTable
        rows={rows}
        loadingExisting={loadingExisting}
        classifying={classifying}
        searchQ={searchQ}
        searchRes={searchRes}
        onAddRow={addRow}
        onRemoveRow={removeRow}
        onUpdateRow={updateRow}
        onSearchMaterial={searchMaterial}
        onPickMaterial={pickMaterial}
        onClearSearch={clearSearch}
        onClassifyWithAI={classifyWithAI}
      />

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: msg.startsWith("✓") ? "rgba(0,255,136,0.08)" : "rgba(239,68,68,0.1)", color: msg.startsWith("✓") ? "var(--neon-green)" : "#ef4444", border: `1px solid ${msg.startsWith("✓") ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.2)"}` }}>
          {msg}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={addRow}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Icon name="Plus" size={15} /> Добавить строку
        </button>
        <button onClick={savePriceList} disabled={saving || rows.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--neon-cyan), #0099cc)", color: "#000", boxShadow: "0 0 20px rgba(0,212,255,0.25)" }}>
          <Icon name={saving ? "Loader" : "Save"} size={15} />
          {saving ? "Сохранение..." : `Сохранить прайс (${rows.filter(r => parseFloat(String(r.price_per_unit)) > 0).length} позиций)`}
        </button>
      </div>
    </div>
  );
}
