import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const CHAT_URL = "https://functions.poehali.dev/5ff3656c-36ff-46d2-9635-eda6c94ca859";

export type ChatRole = "visitor" | "architect" | "constructor" | "supply" | "engineer" | "lawyer" | "supplier";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface ChatWidgetProps {
  role?: ChatRole;
  userName?: string;
}

const ROLE_CONFIG: Record<ChatRole, { label: string; color: string; greeting: string; suggestions: string[] }> = {
  visitor: {
    label: "Ассистент",
    color: "var(--neon-orange)",
    greeting: "Привет! Я помогу вам разобраться в строительстве дома 🏠\nСпросите о ценах, типах домов или как пользоваться калькулятором.",
    suggestions: ["Сколько стоит построить дом 150 м²?", "Какой фундамент лучше?", "Чем каркасный дом отличается от кирпичного?", "Что входит в смету?"],
  },
  architect: {
    label: "AI-помощник архитектора",
    color: "var(--neon-cyan)",
    greeting: "Здравствуйте! Помогу с архитектурными решениями, описаниями проектов и планировками.",
    suggestions: ["Как описать проект в 3 предложениях?", "Оптимальная планировка для 120 м²?", "Какие теги добавить к проекту?"],
  },
  constructor: {
    label: "AI-помощник конструктора",
    color: "var(--neon-orange)",
    greeting: "Здравствуйте! Помогу с нормами расхода материалов, формулами расчёта и техническими характеристиками.",
    suggestions: ["Норма расхода бетона на фундамент?", "Формула расчёта арматуры для плиты?", "Сколько кирпича на м² стены?"],
  },
  supply: {
    label: "AI-помощник снабженца",
    color: "#FBBF24",
    greeting: "Здравствуйте! Помогу составить запрос КП, выбрать поставщика и сравнить предложения.",
    suggestions: ["Как составить грамотный запрос КП?", "Критерии выбора поставщика?", "Что проверить в КП поставщика?"],
  },
  engineer: {
    label: "AI-помощник инженера",
    color: "var(--neon-green)",
    greeting: "Здравствуйте! Помогу с инженерными системами, нормами и техническими решениями.",
    suggestions: ["Требования к электропроводке в доме?", "Как рассчитать систему отопления?", "Нормы вентиляции для жилых помещений?"],
  },
  lawyer: {
    label: "AI-помощник юриста",
    color: "#A855F7",
    greeting: "Здравствуйте! Помогу с вопросами договоров подряда, разрешительной документации и строительного законодательства.",
    suggestions: ["Что обязательно в договоре подряда?", "Нужно ли разрешение на строительство?", "Ответственность подрядчика за дефекты?"],
  },
  supplier: {
    label: "AI-помощник поставщика",
    color: "var(--neon-cyan)",
    greeting: "Здравствуйте! Помогу правильно заполнить КП, представить товар и разобраться в требованиях.",
    suggestions: ["Как заполнить коммерческое предложение?", "Что указать в условиях поставки?", "Как выделиться среди конкурентов?"],
  },
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.4)", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

export default function ChatWidget({ role = "visitor", userName }: ChatWidgetProps) {
  const config = ROLE_CONFIG[role];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: config.greeting, ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setShowSuggestions(false);

    const userMsg: Message = { role: "user", content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg]
      .filter(m => m.role !== "assistant" || m.content !== config.greeting)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${CHAT_URL}?action=chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, role }),
      }).then(r => r.json());

      const reply = res.reply || "Произошла ошибка. Попробуйте ещё раз.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Нет соединения. Проверьте интернет.", ts: Date.now() }]);
    }
    setLoading(false);
  }, [messages, loading, role, config.greeting, open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const clearChat = () => {
    setMessages([{ role: "assistant", content: config.greeting, ts: Date.now() }]);
    setShowSuggestions(true);
    setUnread(0);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110"
        style={{
          background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)`,
          boxShadow: `0 0 30px ${config.color}66, 0 4px 20px rgba(0,0,0,0.4)`,
        }}>
        {open
          ? <Icon name="X" size={22} style={{ color: "#fff" }} />
          : <Icon name="MessageCircle" size={22} style={{ color: "#fff" }} />}
        {!open && unread > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "#ef4444", color: "#fff" }}>
            {unread}
          </div>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] rounded-2xl overflow-hidden flex flex-col animate-scale-in"
          style={{
            background: "var(--card-bg)",
            border: `1px solid ${config.color}44`,
            boxShadow: `0 0 40px ${config.color}22, 0 20px 60px rgba(0,0,0,0.6)`,
            height: "520px",
          }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${config.color}22, transparent)`, borderBottom: `1px solid ${config.color}33` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${config.color}22`, border: `1px solid ${config.color}44` }}>
              <span style={{ fontSize: 18 }}>🤖</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-sm text-white truncate">{config.label}</div>
              {userName && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>для {userName}</div>}
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--neon-green)", animation: "pulse 2s infinite" }} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>онлайн</span>
              </div>
            </div>
            <button onClick={clearChat} className="p-1.5 rounded-lg transition-all hover:bg-white/10" title="Очистить чат"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              <Icon name="RotateCcw" size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "thin" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                    style={{ background: `${config.color}22`, fontSize: 12 }}>🤖</div>
                )}
                <div className="max-w-[78%]">
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap`}
                    style={msg.role === "user"
                      ? { background: `${config.color}33`, color: "#fff", borderBottomRightRadius: 4 }
                      : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.9)", borderBottomLeftRadius: 4 }}>
                    {msg.content}
                  </div>
                  <div className="text-xs mt-1 px-1" style={{ color: "rgba(255,255,255,0.25)", textAlign: msg.role === "user" ? "right" : "left" }}>
                    {formatTime(msg.ts)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center mr-2 flex-shrink-0 mt-1"
                  style={{ background: `${config.color}22`, fontSize: 12 }}>🤖</div>
                <div className="rounded-2xl" style={{ background: "rgba(255,255,255,0.07)", borderBottomLeftRadius: 4 }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && !loading && (
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {config.suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-105"
                    style={{ background: `${config.color}18`, color: config.color, border: `1px solid ${config.color}33` }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex items-end gap-2 rounded-xl p-2"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${config.color}33` }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Напишите сообщение..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white outline-none resize-none leading-relaxed"
                style={{ color: "rgba(255,255,255,0.9)", minHeight: 24, maxHeight: 96, overflowY: "auto" }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 96) + "px";
                }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 hover:scale-110"
                style={{ background: config.color }}>
                <Icon name="Send" size={14} style={{ color: input.trim() ? "#000" : "#fff" }} />
              </button>
            </div>
            <div className="text-center mt-1.5">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Powered by GPT-4o · Enter для отправки</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
