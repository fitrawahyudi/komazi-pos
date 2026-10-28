import React from 'react';
import {
  Clock,
  Check,
  AlertCircle,
  Bell,
  Play,
  RotateCcw,
  Pause,
  ArrowRight,
  Eye,
  Printer,
} from 'lucide-react';
import { formatOrderType, isDrinkItem, formatTime } from '../../utils/format';

/**
 * Reusable KDS / BDS Order Ticket Component
 * Digunakan baik di KdsPage (dashboard mode) maupun KdsStandaloneScreen (layar penuh TV).
 */
export default function OrderTicket({
  order,
  station = 'ALL',
  currentTime = Date.now(),
  onBumpItem,
  onBumpTicket,
  onRequeueStatus,
  onPrintTicket,
  tvMode = false,
  canBump = true,
}) {
  const isBar = station === 'BAR';
  const status = isBar
    ? (order.barStatus || order.kitchenStatus || 'PENDING')
    : (order.kitchenStatus || 'PENDING');
  const isHold = ['HOLD', 'OPEN'].includes((order.status || '').toUpperCase());

  // Waktu pesanan masuk (HH:mm) statis tanpa detik berputar
  const orderTimeFormatted = formatTime(order.createdAt);

  // Perhitungan durasi & keterlambatan berbasis timestamp server (tahan refresh)
  const createdTimestamp = new Date(order.createdAt).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((currentTime - createdTimestamp) / 60000));

  // Target waktu delay: 5 menit untuk Bar, 10 menit untuk Dapur (Section 22)
  const targetMinutes = isBar ? 5 : 10;
  const isDelayed = elapsedMinutes >= targetMinutes && status !== 'SERVED';
  const isWarning = elapsedMinutes >= Math.floor(targetMinutes / 2) && !isDelayed && status !== 'SERVED';

  // Filter items sesuai station
  const displayedItems = (order.items || []).filter((item) => {
    if (station === 'ALL') return true;
    const isDrink = item.station?.type === 'BAR' || isDrinkItem(item);
    if (station === 'BAR') return isDrink;
    if (station === 'KITCHEN') return !isDrink;
    return true;
  });

  if (displayedItems.length === 0) return null;

  // Penentuan warna border card
  const borderColor =
    status === 'SERVED'
      ? 'border-neutral-800 opacity-60'
      : isDelayed
        ? 'border-red-500 shadow-red-500/20'
        : status === 'READY'
          ? 'border-emerald-500/80 shadow-emerald-500/20'
          : status === 'IN_PROGRESS'
            ? 'border-amber-500/80 shadow-amber-500/20'
            : isHold
              ? 'border-blue-500/60'
              : tvMode
                ? 'border-white/10'
                : 'border-komazi-border';

  // Penentuan background header
  const headerBg =
    status === 'SERVED'
      ? 'bg-neutral-900/60 border-neutral-800'
      : isDelayed
        ? 'bg-red-500/15 border-red-500/30'
        : status === 'READY'
          ? 'bg-emerald-500/15 border-emerald-500/30'
          : status === 'IN_PROGRESS'
            ? 'bg-amber-500/15 border-amber-500/30'
            : isHold
              ? 'bg-blue-500/15 border-blue-500/30'
              : tvMode
                ? 'bg-[#181818] border-white/10'
                : 'bg-komazi-surface-2 border-komazi-border';

  const cardBg = tvMode
    ? isDelayed
      ? 'bg-[#1D1111]'
      : status === 'READY'
        ? 'bg-[#111C15]'
        : status === 'IN_PROGRESS'
          ? 'bg-[#1C1612]'
          : isHold
            ? 'bg-[#121622]'
            : 'bg-[#141414]'
    : 'bg-komazi-surface';

  const tableOrTypeLabel = order.tableNo
    ? `MEJA ${order.tableNo}`
    : (order.type || order.orderType) === 'TAKE_AWAY'
      ? 'TAKE AWAY'
      : 'DINE IN';

  const isCompactTicket = displayedItems.length < 5;
  const cardHeightClass = isCompactTicket
    ? 'min-h-[220px] h-auto'
    : 'h-[440px] max-h-[440px]';

  return (
    <div
      className={`${cardHeightClass} rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all ${cardBg} ${borderColor}`}
    >
      {/* Header (Sticky / Shrink-0) */}
      <div className={`p-3.5 border-b flex items-start justify-between gap-2 shrink-0 ${headerBg}`}>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {tvMode ? (
              <span className="font-display font-black text-base sm:text-lg text-white tracking-wide">
                {tableOrTypeLabel}
              </span>
            ) : (
              <span className="font-mono font-black text-sm text-komazi-text">
                {order.invoiceNo}
              </span>
            )}

            {tvMode && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-komazi-muted">
                {order.invoiceNo}
              </span>
            )}

            {isHold && (
              <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center gap-1">
                <Pause className="w-2.5 h-2.5" />
                HOLD
              </span>
            )}

            {status === 'SERVED' && (
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                SELESAI
              </span>
            )}

            {!tvMode && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-muted">
                {formatOrderType(order.type || order.orderType)}
              </span>
            )}
          </div>

          <p className="text-xs font-bold text-komazi-text mt-1 truncate max-w-[190px]">
            {order.customerName || (order.label ? order.label : 'Pelanggan')}
            {!tvMode && order.tableNo ? ` • Meja ${order.tableNo}` : ''}
          </p>
        </div>

        {/* Print Button & Timer */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onPrintTicket && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrintTicket(order);
              }}
              className="p-1.5 rounded-xl bg-black/40 hover:bg-komazi-coral text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm active:scale-90"
              title="Cetak Tiket Pesanan / Struk"
            >
              <Printer className="w-3.5 h-3.5 text-komazi-coral hover:text-white" />
            </button>
          )}

          {/* Timer & Delay Warning Badge */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-bold shadow-sm ${status === 'SERVED'
                  ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  : isDelayed
                    ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/25'
                    : isWarning
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : tvMode
                        ? 'bg-[#222] text-neutral-300 border border-white/10'
                        : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
                }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{orderTimeFormatted}</span>
            </div>

            {isDelayed && (
              <span className="text-[8px] font-black uppercase tracking-wider text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 animate-pulse">
                ⚠ DELAYED ({targetMinutes}m)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Items List Body: Auto-fit for < 5 items, scrollable for >= 5 items without scroll-trap */}
      <div className={`p-3 space-y-2 ${isCompactTicket ? 'flex-1' : 'flex-1 overflow-y-auto'}`}>
        {displayedItems.map((item, idx) => {
          const itemStatus = (item.status || 'PENDING').toUpperCase();
          const isItemDone = itemStatus === 'SERVED';
          const isItemReady = itemStatus === 'READY';
          const isItemPrep = itemStatus === 'PREPARING';
          const isClickable = canBump && !isItemDone;

          return (
            <div
              key={item.id || idx}
              onClick={() => {
                if (isClickable && item.id && onBumpItem) {
                  onBumpItem(item.id, station);
                }
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ') && item.id && onBumpItem) {
                  e.preventDefault();
                  onBumpItem(item.id, station);
                }
              }}
              title={isClickable ? `Klik untuk BUMP status ${item.productName || item.name}` : undefined}
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 select-none ${isClickable
                  ? 'cursor-pointer hover:border-komazi-coral/60 hover:bg-komazi-surface-3 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none'
                  : ''
                } ${isItemDone
                  ? 'bg-neutral-900/40 border-neutral-800 opacity-40 line-through'
                  : isItemReady
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : isItemPrep
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : tvMode
                        ? 'bg-[#1C1C1C] border-white/10'
                        : 'bg-komazi-surface-2 border-komazi-border'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="w-5.5 h-5.5 rounded-lg bg-komazi-surface border border-komazi-border flex items-center justify-center font-mono font-black text-xs text-komazi-coral shrink-0">
                    {item.qty}x
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-xs leading-tight truncate ${isItemDone ? 'text-neutral-400' : 'text-white'}`}>
                      {item.productName || item.name}
                    </p>
                    {item.variantName && (
                      <p className="text-[10px] text-komazi-coral font-semibold mt-0.5 truncate">
                        Varian: {item.variantName}
                      </p>
                    )}
                    {item.modifiers && (
                      <p className="text-[10px] text-komazi-teal-light font-medium mt-0.5 truncate">
                        + {item.modifiers}
                      </p>
                    )}
                  </div>
                </div>

                {/* Item-level BUMP Status Pill */}
                {!isItemDone ? (
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all ${isItemReady
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isItemPrep
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : tvMode
                            ? 'bg-[#262626] text-neutral-400 border border-white/10'
                            : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
                      }`}
                  >
                    <span>{itemStatus}</span>
                    {isClickable && <ArrowRight className="w-3 h-3 text-komazi-coral" />}
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-neutral-500 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3 text-emerald-500" />
                    SERVED
                  </span>
                )}
              </div>

              {item.note && (
                <div className="mt-1 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">Catatan: {item.note}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer (Sticky Bottom / Shrink-0) */}
      <div className={`p-3 border-t border-komazi-border shrink-0 space-y-1.5 ${tvMode ? 'bg-[#181818]' : 'bg-komazi-surface-2/70'}`}>
        {!canBump ? (
          <div className="w-full py-2.5 px-3 rounded-xl bg-komazi-surface/80 border border-komazi-border text-center text-xs font-semibold text-komazi-muted flex items-center justify-center gap-1.5 shadow-inner">
            <Eye className="w-3.5 h-3.5 text-komazi-coral" />
            <span>Hanya Baca</span>
          </div>
        ) : status !== 'SERVED' ? (
          <button
            type="button"
            onClick={() => onBumpTicket && onBumpTicket(order.id, station)}
            className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${status === 'READY'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : status === 'IN_PROGRESS'
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-komazi-coral/20'
              }`}
          >
            {status === 'READY' ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                BUMP TIKET (Selesai Saji)
              </>
            ) : status === 'IN_PROGRESS' ? (
              <>
                <Bell className="w-3.5 h-3.5" />
                BUMP TIKET (Siap Saji)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                BUMP TIKET (Mulai Proses)
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRequeueStatus && onRequeueStatus(order.id, station)}
            className="w-full py-2 rounded-xl bg-komazi-surface hover:bg-komazi-surface-2 text-komazi-muted hover:text-komazi-text border border-komazi-border font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Kembalikan ke Antrean
          </button>
        )}

        {isHold && status !== 'SERVED' && (
          <p className="text-[10px] text-blue-400/80 text-center font-medium">
            ⏸ Hold Bill — belum bayar kasir, dapat disiapkan terlebih dahulu
          </p>
        )}
      </div>
    </div>
  );
}
