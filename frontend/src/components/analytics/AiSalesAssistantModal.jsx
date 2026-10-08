import React, { useState, useRef, useEffect } from 'react';
import { useAiAnalyticsStore } from '../../store/aiAnalyticsStore';
import { useAuthStore } from '../../store/authStore';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Coffee,
} from 'lucide-react';

export default function AiSalesAssistantModal() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'CASHIER';

  const {
    isAssistantOpen,
    closeAssistant,
    messages,
    isLoading,
    askQuestion,
    clearChat,
  } = useAiAnalyticsStore();

  const [inputQuery, setInputQuery] = useState('');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (isAssistantOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAssistantOpen, isLoading]);

  if (!isAssistantOpen) return null;

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    const q = inputQuery.trim();
    setInputQuery('');
    askQuestion(q);
  };

  const handleChipClick = (chipQuery) => {
    if (isLoading) return;
    askQuestion(chipQuery);
  };

  // Helper to render basic markdown bold & bullets
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return (
      <div className="space-y-1.5 text-sm leading-relaxed text-komazi-text-secondary">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Parse bullet points
          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const cleanLine = isBullet ? line.trim().replace(/^[-*]\s+/, '') : line;

          // Replace **bold**
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          const parsedContent = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-komazi-text font-sans">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          if (isBullet) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-komazi-primary mt-1.5 h-1.5 w-1.5 rounded-full bg-komazi-primary shrink-0" />
                <span>{parsedContent}</span>
              </div>
            );
          }

          return <p key={idx}>{parsedContent}</p>;
        })}
      </div>
    );
  };

  const hasUserInteracted = messages.some((m) => m.role === 'user');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-komazi-surface border border-komazi-border/80 rounded-2xl shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden">
        
        {/* ─── Modal Header ────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-komazi-border bg-komazi-surface-2/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-komazi-primary/20 to-emerald-500/20 border border-komazi-primary/30 flex items-center justify-center text-komazi-primary shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-komazi-text">
                  Komazi AI
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  {role === 'OWNER'
                    ? 'Mode: Owner (Akses Penuh)'
                    : role === 'MANAGER'
                    ? 'Mode: Manager (Operasional)'
                    : role === 'BARISTA'
                    ? 'Mode: Barista (Bar Minuman)'
                    : role === 'KITCHEN'
                    ? 'Mode: Dapur (Menu Makanan)'
                    : 'Mode: Kasir (POS & Meja)'}
                </span>
              </div>
              <p className="text-xs text-komazi-muted">
                {role === 'OWNER'
                  ? 'Analisis komprehensif omset, HPP bahan baku, dan performa kedai'
                  : role === 'MANAGER'
                  ? 'Operasional harian, peringatan bahan baku, dan supervisi shift'
                  : role === 'BARISTA'
                  ? 'Stok bahan baku bar minuman, takaran resep, dan persiapan batch'
                  : role === 'KITCHEN'
                  ? 'Stok bahan makanan, porsi pastry, dan persiapan menu dapur'
                  : 'Rekomendasi menu terlaris, bahan habis, dan rekap shift kasir'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              title="Reset Percakapan"
              className="p-2 text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={closeAssistant}
              className="p-2 text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Messages Scroll Area ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-komazi-primary/20 border border-komazi-primary/30 flex items-center justify-center text-komazi-primary shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[80%] space-y-2.5`}>
                  <div
                    className={`p-4 rounded-2xl ${
                      isUser
                        ? 'bg-komazi-primary text-white ml-auto rounded-tr-none shadow-md'
                        : 'bg-komazi-surface-2 border border-komazi-border/80 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm font-medium">{msg.text}</p>
                    ) : (
                      renderFormattedText(msg.text)
                    )}

                    {/* Metadata Footer: Komazi AI & Timestamp */}
                    {!isUser && (
                      <div className="mt-2.5 pt-2 border-t border-komazi-border/40 flex items-center justify-between text-[10px] text-komazi-muted">
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          Komazi AI
                        </span>
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Suggestion Chips: Hanya muncul sekali saja di pesan pembuka awal sebelum ada interaksi pertanyaan pengguna */}
                  {idx === 0 && !isUser && msg.followUps && msg.followUps.length > 0 && !hasUserInteracted && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.followUps.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleChipClick(chip)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-full text-xs bg-komazi-surface border border-komazi-border text-komazi-text-secondary hover:text-komazi-primary hover:border-komazi-primary/50 transition-colors shadow-2xs"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-text shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Animation Bubble */}
          {isLoading && (
            <div className="flex gap-3 items-start animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-komazi-primary/20 border border-komazi-primary/30 flex items-center justify-center text-komazi-primary shrink-0">
                <Sparkles className="w-4 h-4 animate-spin text-komazi-primary" />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none bg-komazi-surface-2 border border-komazi-border/80 flex items-center gap-2 text-sm text-komazi-muted">
                <span className="w-2 h-2 rounded-full bg-komazi-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-komazi-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-komazi-primary animate-bounce" />
                <span className="ml-1 text-xs">Menganalisis data penjualan dengan Komazi AI...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* ─── Bottom Input Bar ─────────────────────────────────────────── */}
        <div className="p-3.5 border-t border-komazi-border bg-komazi-surface-2/70">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ketik pertanyaan (cth: Menu apa yang paling laku hari ini?)..."
              disabled={isLoading}
              className="flex-1 bg-komazi-surface border border-komazi-border rounded-xl px-4 py-2.5 text-sm text-komazi-text placeholder-komazi-muted focus:outline-none focus:border-komazi-primary focus:ring-1 focus:ring-komazi-primary transition-all"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="px-4 py-2.5 bg-komazi-primary hover:bg-komazi-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center gap-1.5 font-medium text-sm transition-all shadow-md shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
