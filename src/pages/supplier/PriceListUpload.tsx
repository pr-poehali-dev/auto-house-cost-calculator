import { useRef } from "react";
import Icon from "@/components/ui/icon";

interface PriceListUploadProps {
  uploading: boolean;
  uploadMsg: string;
  onFile: (file: File) => void;
}

export default function PriceListUpload({ uploading, uploadMsg, onFile }: PriceListUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl p-5 mb-5" style={{ background: "var(--card-bg)", border: "1px solid rgba(0,212,255,0.2)" }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Загрузить из файла</div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
          onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-60"
          style={{ background: "rgba(0,212,255,0.15)", color: "var(--neon-cyan)", border: "1px solid rgba(0,212,255,0.3)" }}>
          <Icon name={uploading ? "Loader" : "Upload"} size={15} />
          {uploading ? "Обработка файла..." : "Загрузить Excel / PDF"}
        </button>
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          Формат: колонки «Наименование», «Ед.», «Кол-во», «Цена»
        </div>
      </div>
      {uploadMsg && (
        <div className="mt-3 text-sm px-3 py-2 rounded-lg"
          style={{ background: uploadMsg.startsWith("✓") ? "rgba(0,255,136,0.08)" : "rgba(251,191,36,0.08)", color: uploadMsg.startsWith("✓") ? "var(--neon-green)" : "#FBBF24" }}>
          {uploadMsg}
        </div>
      )}
    </div>
  );
}
