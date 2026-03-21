import { useRef } from "react";
import Icon from "@/components/ui/icon";
import { DOC_CATEGORIES } from "./DocUploadManager";

interface UploadedDoc {
  id: number;
  file_name: string;
  file_url: string;
  status: string;
  doc_category: string;
  doc_category_label: string;
  page_count: number | null;
  created_at: string;
  s3_key?: string;
}

interface DocListPanelProps {
  uploads: UploadedDoc[];
  uploading: boolean;
  uploadProgress: string;
  filterCategory: string;
  onFilterChange: (cat: string) => void;
  onOpenDoc: (doc: UploadedDoc) => void;
  onDeleteDoc: (id: number, e: React.MouseEvent) => void;
  onUploadFile: (file: File) => void;
}

export default function DocListPanel({
  uploads,
  uploading,
  uploadProgress,
  filterCategory,
  onFilterChange,
  onOpenDoc,
  onDeleteDoc,
  onUploadFile,
}: DocListPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const cats = ["all", ...Array.from(new Set(uploads.map(u => u.doc_category || "other")))];
  const byCategory = (cat: string) => uploads.filter(u => cat === "all" || (u.doc_category || "other") === cat);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--neon-orange)" }}>ПП РФ №87</div>
          <h3 className="font-semibold text-white">Проектная документация</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            AI определит раздел и разберёт по позициям постранично
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,107,26,0.15)", color: "var(--neon-orange)", border: "1px solid rgba(255,107,26,0.3)" }}>
          <Icon name="Upload" size={16} />
          Загрузить
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
          onChange={e => e.target.files?.[0] && onUploadFile(e.target.files[0])} />
      </div>

      {(uploading || uploadProgress) && (
        <div className="mb-4 p-4 rounded-xl flex items-center gap-3"
          style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.2)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,107,26,0.15)" }}>
            <Icon name="Loader" size={16} style={{ color: "var(--neon-orange)", animation: "spin 1s linear infinite" }} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{uploadProgress || "Обработка..."}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Не закрывайте страницу</div>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cats.map(cat => {
            const info = cat === "all"
              ? { label: "Все", icon: "📂", color: "rgba(255,255,255,0.5)" }
              : DOC_CATEGORIES[cat];
            const count = cat === "all" ? uploads.length : uploads.filter(u => (u.doc_category || "other") === cat).length;
            return (
              <button key={cat} onClick={() => onFilterChange(cat)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterCategory === cat ? `${info?.color}20` : "rgba(255,255,255,0.04)",
                  color: filterCategory === cat ? (info?.color || "white") : "rgba(255,255,255,0.5)",
                  border: `1px solid ${filterCategory === cat ? `${info?.color}40` : "rgba(255,255,255,0.07)"}`,
                }}>
                <span>{info?.icon}</span> {info?.label?.split(" ")[0]} · {count}
              </button>
            );
          })}
        </div>
      )}

      {byCategory(filterCategory).length > 0 ? (
        <div className="space-y-2">
          {byCategory(filterCategory).map(doc => {
            const cat = DOC_CATEGORIES[doc.doc_category || "other"] || DOC_CATEGORIES.other;
            return (
              <div key={doc.id} onClick={() => onOpenDoc(doc)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{doc.file_name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: `${cat.color}15`, color: cat.color }}>
                      {cat.label.split(" ")[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {doc.page_count && <span>{doc.page_count} стр.</span>}
                    <span style={{ color: doc.status === "done" ? "var(--neon-green)" : doc.status === "uploaded" ? "var(--neon-cyan)" : "rgba(255,255,255,0.3)" }}>
                      {doc.status === "done" ? "✓ Обработан" : doc.status === "uploaded" ? "Загружен" : doc.status}
                    </span>
                    <span>{new Date(doc.created_at).toLocaleDateString("ru-RU")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={(e) => onDeleteDoc(doc.id, e)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
                    style={{ color: "#ef4444" }}>
                    <Icon name="Trash2" size={13} />
                  </button>
                  <Icon name="ChevronRight" size={16} style={{ color: "rgba(255,255,255,0.2)" }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center rounded-2xl" style={{ border: "2px dashed rgba(255,255,255,0.08)" }}>
          <div className="text-3xl mb-3">📂</div>
          <div className="text-sm font-medium text-white mb-1">Документы не загружены</div>
          <div className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Загрузите PDF, Excel, CSV — AI определит раздел по ПП РФ №87<br/>и разберёт по позициям постранично
          </div>
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto text-left">
            {["specification", "work_statement", "estimate", "architecture", "construction", "engineering"].map(k => {
              const c = DOC_CATEGORIES[k];
              return (
                <div key={k} className="flex items-center gap-1.5 text-xs p-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}>
                  <span>{c.icon}</span><span className="truncate">{c.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
