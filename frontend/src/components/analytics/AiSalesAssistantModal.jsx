import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAiAnalyticsStore } from '../../store/aiAnalyticsStore';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Coffee,
  ArrowRight,
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
    syncRoleMessages,
  } = useAiAnalyticsStore();

  const [inputQuery, setInputQuery] = useState('');
  const chatBottomRef = useRef(null);
  const navigate = useNavigate();

  // Pastikan percakapan AI tersinkronisasi murni dengan role pengguna saat ini
  useEffect(() => {
    if (isAssistantOpen) {
      syncRoleMessages?.(role, user?.name);
    }
  }, [role, isAssistantOpen, user?.name]);

  const handleActionHint = (hint) => {
    if (!hint) return;
    closeAssistant();

    if (hint.targetModal === 'PRINTER_MODAL') {
      try {
        useUiStore.getState().openBluetoothModal();
      } catch {
        navigate('/printer');
      }
      return;
    }

    if (hint.route) {
      navigate(hint.route);
    }
  };

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

  // Helper to parse inline markdown (bold, italic, code)
  const renderInlineMarkdown = (text) => {
    if (!text && text !== 0) return null;
    const str = String(text);
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const parts = str.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-komazi-text font-sans">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return (
          <em key={idx} className="italic text-neutral-300">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-coral text-xs font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  // Helper to render special table cell types (status badges, currency, row labels)
  const renderTableCell = (cellText, colHeader = '', alignment = 'left') => {
    if (!cellText && cellText !== 0) return <span className="text-komazi-muted">-</span>;

    const trimmed = String(cellText).trim();
    const cleanLower = trimmed.replace(/\*\*/g, '').trim().toLowerCase();

    // Operational / Active / Success badge
    if (
      cleanLower === 'operasional' ||
      cleanLower === 'buka' ||
      cleanLower === 'aktif' ||
      cleanLower === 'sukses' ||
      cleanLower === 'lunas'
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {trimmed.replace(/\*\*/g, '')}
        </span>
      );
    }

    // Holiday / Closed / No Sales badge
    if (
      cleanLower.includes('libur') ||
      cleanLower === 'tutup' ||
      cleanLower.includes('tidak ada penjualan') ||
      cleanLower === 'batal'
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {trimmed.replace(/\*\*/g, '')}
        </span>
      );
    }

    // Currency values (e.g. "Rp 592.000", "Rp 0", "+Rp 592.000")
    if (/^[+-]?\s*Rp\s*[\d.,]+/i.test(trimmed.replace(/\*\*/g, ''))) {
      const cleanVal = trimmed.replace(/\*\*/g, '');
      const isZero = cleanVal.includes('Rp 0') || cleanVal === 'Rp0';
      return (
        <span
          className={`font-semibold tabular-nums font-sans ${
            isZero ? 'text-komazi-muted' : 'text-emerald-400'
          }`}
        >
          {renderInlineMarkdown(trimmed)}
        </span>
      );
    }

    // "Hari Ini" row label highlight
    if (cleanLower === 'hari ini') {
      return (
        <span className="font-bold text-komazi-text flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral" />
          {renderInlineMarkdown(trimmed)}
        </span>
      );
    }

    // "Kemarin" row label highlight
    if (cleanLower === 'kemarin') {
      return (
        <span className="font-medium text-komazi-muted flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          {renderInlineMarkdown(trimmed)}
        </span>
      );
    }

    // Default cell rendering with inline markdown
    return <span>{renderInlineMarkdown(trimmed)}</span>;
  };

  // Helper to parse markdown string into structured blocks (tables, headings, bullets, paragraphs)
  const parseMarkdownToBlocks = (text) => {
    if (!text) return [];
    const rawLines = text.split(/\r?\n/);
    const blocks = [];
    let i = 0;

    const isSeparatorLine = (str) => {
      if (!str || !str.includes('-')) return false;
      return /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(str.trim());
    };

    const parseRow = (rowStr) => {
      let parts = rowStr.split('|');
      if (rowStr.trim().startsWith('|')) parts = parts.slice(1);
      if (rowStr.trim().endsWith('|')) parts = parts.slice(0, -1);
      return parts.map((c) => c.trim());
    };

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        blocks.push({ type: 'empty' });
        i++;
        continue;
      }

      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1].trim() : '';

      // 1. Check for Markdown Table (Header + Separator row)
      if (line.includes('|') && isSeparatorLine(nextLine)) {
        const headers = parseRow(line);
        const sepParts = parseRow(nextLine);
        const alignments = headers.map((_, colIdx) => {
          const sep = sepParts[colIdx] || '';
          const startsColon = sep.startsWith(':');
          const endsColon = sep.endsWith(':');
          if (startsColon && endsColon) return 'center';
          if (endsColon) return 'right';
          return 'left';
        });

        i += 2;
        const rows = [];
        while (i < rawLines.length) {
          const rowLine = rawLines[i];
          const trimmedRow = rowLine.trim();
          if (!trimmedRow || !trimmedRow.includes('|')) {
            break;
          }
          const cells = parseRow(rowLine);
          while (cells.length < headers.length) {
            cells.push('');
          }
          rows.push(cells);
          i++;
        }

        blocks.push({
          type: 'table',
          headers,
          alignments,
          rows,
        });
        continue;
      }

      // 2. Check for Headings (#, ##, ###, ####)
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
        });
        i++;
        continue;
      }

      // 3. Check for Bullet Points (- item, * item, • item)
      const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        blocks.push({
          type: 'bullet',
          text: bulletMatch[1].trim(),
        });
        i++;
        continue;
      }

      // 4. Check for Numbered List (1. item, 2. item)
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        blocks.push({
          type: 'numbered',
          number: numberedMatch[1],
          text: numberedMatch[2].trim(),
        });
        i++;
        continue;
      }

      // 5. Standalone section title (e.g. "Interpretasi singkat")
      if (
        trimmed.length > 0 &&
        trimmed.length < 35 &&
        !trimmed.endsWith('.') &&
        !trimmed.includes(':') &&
        (i + 1 < rawLines.length && !rawLines[i + 1].trim())
      ) {
        blocks.push({
          type: 'subheading',
          text: trimmed,
        });
        i++;
        continue;
      }

      // 6. Paragraph with key-value label (e.g. "Peningkatan omset: Dari Rp 0...")
      const kvMatch = line.match(/^([A-Za-z0-9\s()&/-]+):\s+(.+)$/);
      if (kvMatch && !kvMatch[1].startsWith('http') && kvMatch[1].length < 35) {
        blocks.push({
          type: 'keyvalue',
          key: kvMatch[1].trim(),
          value: kvMatch[2].trim(),
        });
        i++;
        continue;
      }

      // 7. Regular Paragraph
      blocks.push({
        type: 'paragraph',
        text: line,
      });
      i++;
    }

    return blocks;
  };

  // Helper to render rich formatted text with tables, headings, and lists
  const renderFormattedText = (text) => {
    if (!text) return null;
    const blocks = parseMarkdownToBlocks(text);

    return (
      <div className="space-y-2 text-sm leading-relaxed text-komazi-text-secondary">
        {blocks.map((block, idx) => {
          if (block.type === 'empty') {
            return <div key={idx} className="h-1" />;
          }

          if (block.type === 'table') {
            return (
              <div
                key={idx}
                className="my-3 overflow-hidden rounded-xl border border-komazi-border/80 bg-komazi-surface/90 shadow-md"
              >
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-komazi-surface-2 border-b border-komazi-border text-[11px] font-bold text-komazi-muted uppercase tracking-wider">
                        {block.headers.map((h, colIdx) => {
                          const align = block.alignments[colIdx] || 'left';
                          const alignClass =
                            align === 'center'
                              ? 'text-center'
                              : align === 'right'
                              ? 'text-right'
                              : 'text-left';
                          return (
                            <th
                              key={colIdx}
                              className={`py-2.5 px-3.5 whitespace-nowrap font-bold ${alignClass}`}
                            >
                              {renderInlineMarkdown(h)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-komazi-border/50 text-komazi-text-secondary">
                      {block.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`transition-colors ${
                            rIdx % 2 === 1
                              ? 'bg-komazi-surface-2/30 hover:bg-komazi-surface-2/60'
                              : 'bg-transparent hover:bg-komazi-surface-2/40'
                          }`}
                        >
                          {row.map((cell, cIdx) => {
                            const align = block.alignments[cIdx] || 'left';
                            const alignClass =
                              align === 'center'
                                ? 'text-center'
                                : align === 'right'
                                ? 'text-right'
                                : 'text-left';
                            return (
                              <td
                                key={cIdx}
                                className={`py-2.5 px-3.5 whitespace-nowrap ${alignClass}`}
                              >
                                {renderTableCell(cell, block.headers[cIdx], align)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          if (block.type === 'heading') {
            return (
              <div key={idx} className="mt-3.5 mb-1.5">
                <h4 className="text-sm font-bold text-komazi-text flex items-center gap-1.5 text-komazi-coral">
                  <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral" />
                  {renderInlineMarkdown(block.text)}
                </h4>
              </div>
            );
          }

          if (block.type === 'subheading') {
            return (
              <div key={idx} className="mt-3.5 mb-1 pt-1.5 border-t border-komazi-border/50">
                <h5 className="text-xs font-bold uppercase tracking-wider text-komazi-coral flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral" />
                  {renderInlineMarkdown(block.text)}
                </h5>
              </div>
            );
          }

          if (block.type === 'bullet') {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1.5 my-1">
                <span className="text-komazi-coral mt-1.5 h-1.5 w-1.5 rounded-full bg-komazi-coral shrink-0" />
                <span className="text-komazi-text-secondary text-sm">
                  {renderInlineMarkdown(block.text)}
                </span>
              </div>
            );
          }

          if (block.type === 'numbered') {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 my-1">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-komazi-surface-2 border border-komazi-border text-[10px] font-bold text-komazi-coral shrink-0 mt-0.5">
                  {block.number}
                </span>
                <span className="text-komazi-text-secondary text-sm">
                  {renderInlineMarkdown(block.text)}
                </span>
              </div>
            );
          }

          if (block.type === 'keyvalue') {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1 my-1">
                <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral/80 mt-2 shrink-0" />
                <p className="text-sm leading-relaxed text-komazi-text-secondary">
                  <strong className="font-semibold text-komazi-text">
                    {block.key}:{' '}
                  </strong>
                  {renderInlineMarkdown(block.value)}
                </p>
              </div>
            );
          }

          return (
            <p key={idx} className="text-sm leading-relaxed text-komazi-text-secondary">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        })}
      </div>
    );
  };

  const hasUserInteracted = messages.some((m) => m.role === 'user');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl md:max-w-3xl bg-komazi-surface border border-komazi-border/80 rounded-2xl shadow-2xl flex flex-col h-[85vh] max-h-[740px] overflow-hidden">
        
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
              </div>
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

                <div
                  className={`${
                    isUser
                      ? 'max-w-[85%] sm:max-w-[75%]'
                      : 'w-full max-w-[95%] sm:max-w-[92%]'
                  } space-y-2.5`}
                >
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
                      <>
                        {/* Domain Intent Badge */}
                        {msg.intentMeta?.badge && (
                          <div className="mb-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-komazi-primary/15 text-komazi-primary border border-komazi-primary/30">
                              {msg.intentMeta.badge}
                            </span>
                          </div>
                        )}

                        {renderFormattedText(msg.text)}

                        {/* Interactive Action Hint Button */}
                        {msg.actionHint && (
                          <div className="mt-3 pt-2.5 border-t border-komazi-border/50">
                            <button
                              type="button"
                              onClick={() => handleActionHint(msg.actionHint)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-komazi-primary/20 hover:bg-komazi-primary/30 text-komazi-primary border border-komazi-primary/40 transition-all shadow-xs cursor-pointer group"
                            >
                              <span>{msg.actionHint.label || 'Buka Menu Terkait'}</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        )}
                      </>
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
                <span className="ml-1 text-xs">Komazi AI sedang menulis...</span>
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
              placeholder="Tanya Komazi AI"
              disabled={isLoading}
              className="flex-1 bg-komazi-surface border border-komazi-border rounded-xl px-4 py-2.5 text-sm text-komazi-text placeholder-komazi-muted focus:outline-none focus:border-komazi-primary focus:ring-1 focus:ring-komazi-primary transition-all"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="px-4 py-2.5 bg-komazi-primary hover:bg-komazi-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center gap-1.5 font-medium text-sm transition-all shadow-md shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
