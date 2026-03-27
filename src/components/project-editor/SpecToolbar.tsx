import Icon from "@/components/ui/icon";
import type { Spec } from "./types";

interface Props {
  spec: Spec;
  canEdit: boolean;
  generatingPDF: boolean;
  onHistory: () => void;
  onApprove: () => void;
  onPrint: () => void;
  onPDF: () => void;
}

export default function SpecToolbar({ spec, canEdit, generatingPDF, onHistory, onApprove, onPrint, onPDF }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <span className="font-display font-semibold text-white">{spec.title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: spec.status === "approved" ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.07)",
            color: spec.status === "approved" ? "var(--neon-green)" : "rgba(255,255,255,0.5)",
          }}>
          {spec.status === "approved" ? "✓ Утверждена" : `Черновик v${spec.version}`}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/10"
          style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
          <Icon name="History" size={12} /> История
        </button>
        {canEdit && spec.status !== "approved" && (
          <button onClick={onApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(0,255,136,0.12)", color: "var(--neon-green)", border: "1px solid rgba(0,255,136,0.25)" }}>
            <Icon name="Check" size={12} /> Утвердить
          </button>
        )}
        <button onClick={onPrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <Icon name="Printer" size={12} /> Печать
        </button>
        <button onClick={onPDF} disabled={generatingPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
          style={{ background: "var(--neon-orange)", color: "#fff" }}>
          <Icon name="FileDown" size={12} /> {generatingPDF ? "Генерация..." : "PDF"}
        </button>
      </div>
    </div>
  );
}
