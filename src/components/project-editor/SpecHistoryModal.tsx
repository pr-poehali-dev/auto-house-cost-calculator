import Icon from "@/components/ui/icon";
import type { HistoryEntry } from "./types";

interface Props {
  history: HistoryEntry[];
  onClose: () => void;
}

export default function SpecHistoryModal({ history, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
        style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-white">История изменений</h3>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.4)" }}>
            <Icon name="X" size={18} />
          </button>
        </div>
        {history.length === 0
          ? <div className="text-center py-6" style={{ color: "rgba(255,255,255,0.3)" }}>История пуста</div>
          : <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  <span>{h.by}</span><span>·</span><span>{new Date(h.at).toLocaleString("ru-RU")}</span>
                </div>
                <div className="text-sm text-white">{h.item}</div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span style={{ color: "#ef4444" }}>{h.old}</span>
                  <Icon name="ArrowRight" size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span style={{ color: "var(--neon-green)" }}>{h.new}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>({h.field})</span>
                </div>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
