import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";
import { AI_URL, fmt, apiFetch, AiItem } from "./materials-types";

export default function SpecUploader({ token, projectId, specId, onImport }: {
  token: string; projectId?: number; specId?: number; onImport: (items: AiItem[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<AiItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true); setStatus("processing"); setResult([]); setErrorMsg("");
    try {
      const pre = await apiFetch(`${AI_URL}?action=presigned_spec`, {
        method: "POST",
        body: JSON.stringify({ file_name: file.name, project_id: projectId }),
      }, token);
      if (!pre.presigned_url) { setStatus("error"); setErrorMsg(pre.error || "Ошибка получения ссылки"); setUploading(false); return; }

      await fetch(pre.presigned_url, { method: "PUT", body: file });

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

  // suppress unused warning
  void uploading;

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
