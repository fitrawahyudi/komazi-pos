import React, { useState } from 'react';
import {
  Printer,
  X,
  Coffee,
  Utensils,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Bluetooth,
  Loader2,
  FileText,
} from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { toast } from '../../store/toastStore';
import { formatOrderType, isDrinkItem, isBaristaItem, isKitchenItem } from '../../utils/format';

/**
 * Modal Pilihan Aksi Cetak KDS/BDS
 * Memungkinkan staf memilih antara cetak Tiket Dapur/Bar atau Struk Pembayaran
 */
export default function KdsPrintActionModal({
  isOpen,
  onClose,
  order,
  station = 'ALL',
  onOpenPrinterSettings,
}) {
  const {
    isConnected,
    connectedDeviceName,
    printKitchenTicketForOrder,
    printReceiptForOrder,
    paperWidth,
  } = usePrinterStore();

  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !order) return null;

  const items = order.items || [];
  // Filter item yang relevan dengan station
  const stationItems = items.filter((i) => {
    if (station === 'BAR') return isBaristaItem(i);
    if (station === 'KITCHEN') return isKitchenItem(i);
    return true;
  });

  const displayItems = stationItems.length > 0 ? stationItems : items;
  const stationTitle = station === 'BAR' ? 'BARISTA (BAR)' : station === 'KITCHEN' ? 'DAPUR (KITCHEN)' : 'DAPUR & BAR';

  const handlePrintKitchenTicket = async () => {
    if (!isConnected) {
      toast.warning('Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.');
      if (onOpenPrinterSettings) {
        onClose();
        onOpenPrinterSettings();
      }
      return;
    }

    setIsPrinting(true);
    try {
      const res = await printKitchenTicketForOrder(order, {
        stationName: stationTitle,
        items: displayItems,
        paperWidth,
        requestedBy: `KDS Stasiun ${station}`,
      });

      if (res?.success) {
        toast.success(`Tiket pesanan ${order.invoiceNo || ''} berhasil dicetak!`);
        onClose();
      } else {
        toast.error(res?.message || 'Gagal mencetak tiket ke printer.');
      }
    } catch (err) {
      toast.error(`Kendala cetak: ${err.message || 'Gagal transmisi'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!isConnected) {
      toast.warning('Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.');
      if (onOpenPrinterSettings) {
        onClose();
        onOpenPrinterSettings();
      }
      return;
    }

    setIsPrinting(true);
    try {
      const res = await printReceiptForOrder(order, {
        paperWidth,
        requestedBy: `KDS Stasiun ${station}`,
      });

      if (res?.success) {
        toast.success(`Struk pembayaran ${order.invoiceNo || ''} berhasil dicetak!`);
        onClose();
      } else {
        toast.error(res?.message || 'Gagal mencetak struk ke printer.');
      }
    } catch (err) {
      toast.error(`Kendala cetak: ${err.message || 'Gagal transmisi'}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-komazi-surface rounded-2xl border border-komazi-border shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-komazi-surface-2/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Printer className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-komazi-text">Cetak Tiket / Struk</h3>
              <p className="text-[11px] text-komazi-muted font-mono">{order.invoiceNo || `#${order.id}`}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-komazi-border text-komazi-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Printer */}
        <div className="p-3 bg-komazi-surface-2/40 border-b border-komazi-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                }`}
            />
            <span className="text-komazi-muted">Status Printer:</span>
            <span className={`font-bold ${isConnected ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {isConnected ? connectedDeviceName || 'Printer Bluetooth' : 'Belum Terhubung'}
            </span>
          </div>

          {!isConnected && onOpenPrinterSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPrinterSettings();
              }}
              className="text-[11px] font-bold text-komazi-coral hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Bluetooth className="w-3 h-3" />
              <span>Hubungkan</span>
            </button>
          )}
        </div>

        {/* Pilihan Jenis Cetakan */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-komazi-muted">
            Pilih jenis dokumen yang ingin dikirimkan ke printer thermal ({paperWidth}):
          </p>

          {/* Opsi 1: Tiket Pesanan Dapur / Bar */}
          <button
            type="button"
            onClick={handlePrintKitchenTicket}
            disabled={isPrinting}
            className="w-full p-3.5 rounded-xl border border-komazi-border hover:border-komazi-coral bg-komazi-surface-2 hover:bg-komazi-coral/10 text-left transition-all flex items-start justify-between gap-3 group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-komazi-coral/20 text-komazi-coral flex items-center justify-center shrink-0 mt-0.5">
                {station === 'BAR' ? <Coffee className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
              </div>
              <div>
                <span className="font-bold text-xs text-white group-hover:text-komazi-coral block">
                  Tiket Kerja Pesanan ({stationTitle})
                </span>
                <span className="text-[10px] text-komazi-muted block mt-0.5">
                  Format kitchen ticket: nomor meja, waktu, kuantitas item tebal, dan catatan modifikasi menu tanpa harga.
                </span>
              </div>
            </div>
            {isPrinting && <Loader2 className="w-4 h-4 animate-spin text-komazi-coral shrink-0 mt-1" />}
          </button>

          {/* Opsi 2: Struk Pembayaran Konsumen */}
          <button
            type="button"
            onClick={handlePrintReceipt}
            disabled={isPrinting}
            className="w-full p-3.5 rounded-xl border border-komazi-border hover:border-blue-500/50 bg-komazi-surface-2 hover:bg-blue-500/10 text-left transition-all flex items-start justify-between gap-3 group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white group-hover:text-blue-400 block">
                  Struk Pembayaran Konsumen (Bill)
                </span>
                <span className="text-[10px] text-komazi-muted block mt-0.5">
                  Format struk kasir: rincian harga seluruh item, diskon, pajak, total, dan metode pembayaran.
                </span>
              </div>
            </div>
            {isPrinting && <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0 mt-1" />}
          </button>
        </div>

        {/* Footer Modal */}
        <div className="p-3 border-t border-komazi-border bg-komazi-surface-2/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-text text-xs font-bold border border-komazi-border transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
