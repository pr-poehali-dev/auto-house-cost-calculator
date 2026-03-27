import Icon from "@/components/ui/icon";
import type { AiItem } from "@/pages/staff/materials-types";

interface Props {
  pendingImport: AiItem[];
  onImport: (items: AiItem[]) => void;
  onCancel: () => void;
}

export default function SpecImportBanner({ pendingImport, onImport, onCancel }: Props) {
  return (
    <div className="mb-4 p-4 rounded-xl flex items-start gap-3"
      style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(0,212,255,0.15)" }}>
        <Icon name="Sparkles" size={18} style={{ color: "var(--neon-cyan)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm mb-0.5">
          Готово к импорту: {pendingImport.length} позиций из документа
        </div>
        <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          AI извлёк позиции постранично. Нажмите «Добавить в ведомость» чтобы импортировать.
        </div>
        <div className="flex gap-2">
          <button onClick={() => onImport(pendingImport)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--neon-cyan)", color: "#000" }}>
            <Icon name="Download" size={13} />
            Добавить в ведомость
          </button>
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
