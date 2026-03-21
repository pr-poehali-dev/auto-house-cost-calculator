import { useState, useRef } from "react";
import Icon from "@/components/ui/icon";

const TZ_URL = "https://functions.poehali.dev/d895218e-7cd0-43c5-bf78-b0357df6edbe";

interface TzAnalyzerProps {
  onClose: () => void;
}

export default function TzAnalyzer({ onClose }: TzAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [chars, setChars] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".docx")) {
      setError("Поддерживается только формат .docx (Word 2007+)");
      return;
    }
    setFile(f);
    setError("");
    setAnalysis("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setAnalysis("");

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let b64 = "";
      for (let i = 0; i < bytes.length; i += 1024) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + 1024));
      }
      b64 = btoa(b64);

      const res = await fetch(TZ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_b64: b64, file_name: file.name }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Ошибка анализа");
      } else {
        setAnalysis(data.analysis);
        setChars(data.chars_extracted || 0);
      }
    } catch (e) {
      setError("Не удалось отправить файл. Проверьте соединение.");
    } finally {
      setLoading(false);
    }
  };

  const renderAnalysis = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return <h3 key={i} className="font-bold text-white mt-4 mb-1">{line.replace(/\*\*/g, "")}</h3>;
      }
      if (line.match(/^\*\*.*\*\*/)) {
        return <p key={i} className="text-slate-200 mb-1" dangerouslySetInnerHTML={{
          __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        }} />;
      }
      if (line.startsWith("# ")) {
        return <h2 key={i} className="text-lg font-bold text-[#00D4FF] mt-5 mb-2">{line.slice(2)}</h2>;
      }
      if (line.startsWith("## ")) {
        return <h3 key={i} className="text-base font-bold text-white mt-4 mb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        const content = line.slice(2);
        const colored = content
          .replace(/✅/g, '<span class="text-green-400">✅</span>')
          .replace(/❌/g, '<span class="text-red-400">❌</span>')
          .replace(/⚠️/g, '<span class="text-yellow-400">⚠️</span>');
        return <li key={i} className="text-slate-300 ml-4 mb-0.5 list-none" dangerouslySetInnerHTML={{ __html: "• " + colored }} />;
      }
      if (line.includes("✅") || line.includes("❌") || line.includes("⚠️")) {
        const colored = line
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/✅/g, '<span class="text-green-400">✅</span>')
          .replace(/❌/g, '<span class="text-red-400">❌</span>')
          .replace(/⚠️/g, '<span class="text-yellow-400">⚠️</span>');
        return <p key={i} className="text-slate-300 mb-1" dangerouslySetInnerHTML={{ __html: colored }} />;
      }
      if (line.trim() === "") return <div key={i} className="h-1" />;
      return <p key={i} className="text-slate-300 mb-0.5">{line}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1E2535] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00D4FF]/20 flex items-center justify-center">
              <Icon name="FileSearch" size={18} className="text-[#00D4FF]" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Анализ ТЗ</h2>
              <p className="text-slate-400 text-xs">Загрузи Word-файл — AI сравнит с реализованным</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upload zone */}
          {!analysis && (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-white/20 hover:border-[#00D4FF]/50 rounded-xl p-8 text-center cursor-pointer transition-colors group"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="w-14 h-14 rounded-2xl bg-white/5 group-hover:bg-[#00D4FF]/10 flex items-center justify-center mx-auto mb-3 transition-colors">
                <Icon name="FileUp" size={26} className="text-slate-400 group-hover:text-[#00D4FF] transition-colors" />
              </div>
              {file ? (
                <div>
                  <p className="text-[#00D4FF] font-medium">{file.name}</p>
                  <p className="text-slate-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} КБ · нажми ещё раз чтобы сменить</p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-300 font-medium">Перетащи .docx файл или нажми</p>
                  <p className="text-slate-500 text-sm mt-1">Поддерживается только Word .docx</p>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
              <Icon name="AlertCircle" size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Analysis result */}
          {analysis && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="CheckCircle" size={16} className="text-green-400" />
                  <span className="text-green-400 text-sm font-medium">Анализ готов</span>
                  <span className="text-slate-500 text-xs">· извлечено {chars.toLocaleString("ru-RU")} символов</span>
                </div>
                <button
                  onClick={() => { setAnalysis(""); setFile(null); setChars(0); }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Icon name="RotateCcw" size={13} />
                  Загрузить другой
                </button>
              </div>
              <div className="bg-[#151c2c] rounded-xl p-5 border border-white/10 text-sm leading-relaxed">
                {renderAnalysis(analysis)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-slate-500 text-xs flex items-center gap-1">
            <Icon name="Sparkles" size={12} />
            Анализ через GigaChat · займёт ~30 сек
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Закрыть
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className="px-5 py-2 bg-[#00D4FF] hover:bg-[#00bfe8] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={15} className="animate-spin" />
                  Анализирую...
                </>
              ) : (
                <>
                  <Icon name="Wand2" size={15} />
                  Проанализировать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
