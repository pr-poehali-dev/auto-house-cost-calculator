import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { ROLE_LABELS, ROLE_COLORS, ROLE_ICONS } from "@/pages/staff/staff-types";

const LM_URL = "https://functions.poehali.dev/74ffb742-4148-4545-b5bc-953fbc29c1ea";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  roleCode: string;
  token?: string;
  context?: string;
}

function lmFetch(action: string, body?: object) {
  return fetch(`${LM_URL}?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json());
}

export default function AiAssistant({ roleCode, token, context }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const roleLabel = ROLE_LABELS[roleCode] || roleCode;
  const roleColor = ROLE_COLORS[roleCode] || "#00D4FF";
  const roleIcon = ROLE_ICONS[roleCode] || "Bot";

  const loadPrompt = useCallback(async () => {
    const r = await lmFetch(`get_prompt&role_code=${roleCode}`);
    if (r.system_prompt) setSystemPrompt(r.system_prompt);
  }, [roleCode]);

  const checkConnection = useCallback(async () => {
    const r = await lmFetch("models");
    setConnected(!r.error && Array.isArray(r.models));
  }, []);

  useEffect(() => {
    if (open && systemPrompt === "") loadPrompt();
    if (open && connected === null) checkConnection();
  }, [open, systemPrompt, connected, loadPrompt, checkConnection]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");

    const contextMsg = context ? `\n\nКонтекст текущей страницы:\n${context}` : "";
    const fullPrompt = systemPrompt + contextMsg;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    const r = await lmFetch("chat", {
      messages: newMessages,
      system_prompt: fullPrompt,
    });

    setLoading(false);
    if (r.ok && r.reply) {
      setMessages(prev => [...prev, { role: "assistant", content: r.reply }]);
    } else {
      setError(r.error || "Ошибка ответа");
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => { setMessages([]); setError(""); };

  const inp = `w-full bg-transparent resize-none outline-none text-sm leading-relaxed`;

  return (
    <>
      {/* Кнопка открытия */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
        style={{
          background: `${roleColor}18`,
          border: `1px solid ${roleColor}40`,
          color: roleColor,
        }}
        title={`ИИ-ассистент: ${roleLabel}`}
      >
        <Icon name="Bot" size={15} />
        <span className="hidden sm:inline">ИИ-ассистент</span>
        {connected === false && (
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="LM Studio недоступен" />
        )}
        {connected === true && (
          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" title="LM Studio подключён" />
        )}
      </button>

      {/* Панель чата */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end pointer-events-none">
          <div
            className="pointer-events-auto flex flex-col w-full sm:w-[420px] h-[100dvh] sm:h-[600px] sm:m-4 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Хедер */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${roleColor}20 0%, rgba(0,0,0,0) 100%)`, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${roleColor}25`, border: `1px solid ${roleColor}50` }}>
                <Icon name={roleIcon as "Bot"} size={17} style={{ color: roleColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">ИИ-ассистент</div>
                <div className="text-xs truncate" style={{ color: roleColor }}>{roleLabel}</div>
              </div>
              <div className="flex items-center gap-1">
                {connected === true && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,255,136,0.12)", color: "#00FF88" }}>онлайн</span>
                )}
                {connected === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>офлайн</span>
                )}
                {messages.length > 0 && (
                  <button onClick={clear} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }} title="Очистить чат">
                    <Icon name="Trash2" size={13} />
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: `${roleColor}18`, border: `1px solid ${roleColor}30` }}>
                    <Icon name="MessageSquare" size={28} style={{ color: roleColor }} />
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Чем могу помочь?</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Задай любой вопрос по своей работе
                    </div>
                  </div>
                  {connected === false && (
                    <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                      LM Studio недоступен. Проверь подключение к сети или запусти LM Studio.
                    </div>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${roleColor}20`, border: `1px solid ${roleColor}40` }}>
                      <Icon name="Bot" size={12} style={{ color: roleColor }} />
                    </div>
                  )}
                  <div
                    className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={m.role === "user"
                      ? { background: `${roleColor}25`, color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)", borderBottomLeftRadius: 4 }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${roleColor}20`, border: `1px solid ${roleColor}40` }}>
                    <Icon name="Bot" size={12} style={{ color: roleColor }} />
                  </div>
                  <div className="px-3 py-2 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)", borderBottomLeftRadius: 4 }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0,1,2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background: roleColor, animationDelay: `${j * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Ввод */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex gap-2 items-end rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Написать сообщение... (Enter — отправить)"
                  rows={1}
                  className={inp}
                  style={{ color: "rgba(255,255,255,0.9)", maxHeight: 120 }}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={input.trim() && !loading
                    ? { background: roleColor, color: "#000" }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
                  }
                >
                  <Icon name="Send" size={14} />
                </button>
              </div>
              <div className="text-center mt-1.5 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                Powered by LM Studio · {roleLabel}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
