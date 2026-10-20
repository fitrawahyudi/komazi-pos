import React, { useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Coins,
  Receipt,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { usePrinterStore } from '../../store/printerStore';
import { useShiftStore } from '../../store/shiftStore';
import { useHrisStore } from '../../store/hrisStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { exportZReportToExcel } from '../../utils/excel';

export default function CloseSessionReportModal({ session, onClose, onProceedToClockOut }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const myTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const { isConnected: isPrinterConnected } = usePrinterStore();
  const printRef = useRef(null);

  if (!session) return null;

  const openingCash = Number(session.openingCash || 0);
  const closingCash = Number(session.closingCash || 0);
  const expectedCash = Number(session.expectedCash || 0);
  const difference = Number(session.difference || closingCash - expectedCash);

  const totalCashSales = Number(session.totalCashSales || 0);
  const totalNonCashSales = Number(session.totalNonCashSales || 0);
  const totalSales = Number(session.totalSales || totalCashSales + totalNonCashSales);

  const totalCashIn = Number(session.totalCashIn || 0);
  const totalCashOut = Number(session.totalCashOut || 0);
  const totalCashDrop = Number(session.totalCashDrop || 0);
  const totalCashRefund = Number(session.totalCashRefund || 0);

  const paymentMethods = session.paymentMethodsSummary || {
    CASH: totalCashSales,
    CARD: 0,
    QRIS: totalNonCashSales,
    TRANSFER: 0,
    OTHER: 0,
  };

  const cashiers = session.cashiers || [
    {
      id: session.cashierId,
      name: session.cashierName || 'Kasir',
      ordersCount: session.ordersCount || 0,
      totalSales,
    },
  ];

  const durationMs = session.closedAt
    ? Math.max(0, new Date(session.closedAt).getTime() - new Date(session.openedAt).getTime())
    : 0;
  const durationMin = Math.floor(durationMs / 60000);
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const durationFormatted = `${hours} jam ${mins} menit`;

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    try {
      let exportSessionData = session;
      if (session?.id && (!session.orders || !session.cashMovements)) {
        try {
          const detail = await useShiftStore.getState().fetchShiftDetail(session.id);
          if (detail) {
            exportSessionData = { ...session, ...detail };
          }
        } catch (_) {}
      }
      const result = exportZReportToExcel({ session: exportSessionData });
      toast.success(`Laporan Z-Report berhasil diekspor (${result.fileName})!`);
    } catch (err) {
      toast.error('Gagal mengekspor laporan: ' + err.message);
    }
  };

  const isCurrentUserClockedIn = Boolean(
    myTodayAttendance && myTodayAttendance.clockIn && !myTodayAttendance.clockOut
  );

  const handleProceedToClockOut = () => {
    if (onProceedToClockOut) {
      onProceedToClockOut();
    } else {
      onClose();
      navigate('/hris/attendance?action=clockout');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] my-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border shrink-0 bg-komazi-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/20 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral font-bold shadow-inner">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-lg text-komazi-text">
                  Laporan Penutupan Sesi 
                </h3>
              </div>
              <p className="text-xs text-komazi-muted">
                {session.registerName || 'Kasir Utama'} • {formatDateTime(session.closedAt)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div ref={printRef} className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-6 flex-1 text-xs">
          {/* 1. Sesi & Pelaksana Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border">
            <div>
              <span className="text-[10px] uppercase font-bold text-komazi-muted block">Register</span>
              <span className="font-bold text-komazi-text text-sm">
                {session.registerName || 'Kasir Utama'}
              </span>
              <span className="text-[10px] text-komazi-muted block">{session.registerCode || 'REG-01'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-komazi-muted block">Dibuka Oleh</span>
              <span className="font-bold text-komazi-text text-sm">{session.cashierName || 'Kasir'}</span>
              <span className="text-[10px] text-komazi-muted block">{formatDateTime(session.openedAt)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-komazi-muted block">Ditutup Oleh</span>
              <span className="font-bold text-komazi-text text-sm">
                {session.closedByName || session.cashierName || 'Kasir'}
              </span>
              <span className="text-[10px] text-komazi-muted block">{formatDateTime(session.closedAt)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-komazi-muted block">Durasi Sesi</span>
              <span className="font-bold text-komazi-text text-sm">{durationFormatted}</span>
              <span className="text-[10px] text-komazi-muted block">{session.ordersCount || 0} Pesanan</span>
            </div>
          </div>

          {/* 2. Rekonsiliasi Kas Laci (Physical Cash Reconciliation) */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-komazi-surface to-komazi-surface-2 border border-komazi-border shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border/80 pb-3">
              <h4 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <Banknote className="w-4 h-4 text-komazi-coral" />
                <span>Rekonsiliasi Kas Fisik Laci</span>
              </h4>
              <div className="flex items-center gap-1.5">
                {difference === 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Kas Seimbang (Rp 0)
                  </span>
                ) : difference > 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" />
                    Surplus +{formatRupiah(difference)}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-danger/15 text-danger border border-danger/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Defisit -{formatRupiah(Math.abs(difference))}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">Modal Awal Kasir</span>
                <span className="font-mono font-bold text-base text-komazi-text">
                  {formatRupiah(openingCash)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">+ Penjualan Tunai</span>
                <span className="font-mono font-bold text-base text-emerald-400">
                  +{formatRupiah(totalCashSales)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">+ Kas Masuk (In)</span>
                <span className="font-mono font-bold text-base text-blue-400">
                  +{formatRupiah(totalCashIn)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">- Kas Keluar (Out)</span>
                <span className="font-mono font-bold text-base text-amber-400">
                  -{formatRupiah(totalCashOut)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">- Setor Brankas (Drop)</span>
                <span className="font-mono font-bold text-base text-purple-400">
                  -{formatRupiah(totalCashDrop)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-[10px] text-komazi-muted block font-semibold">- Refund Tunai</span>
                <span className="font-mono font-bold text-base text-rose-400">
                  -{formatRupiah(totalCashRefund)}
                </span>
              </div>
            </div>

            {/* Final Balance Comparison */}
            <div className="pt-3 border-t border-komazi-border/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700">
                <span className="text-[10px] text-komazi-muted uppercase font-bold tracking-wider block">
                  Kas yang Diharapkan
                </span>
                <span className="font-mono font-black text-lg text-komazi-text">
                  {formatRupiah(expectedCash)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-700">
                <span className="text-[10px] text-komazi-muted uppercase font-bold tracking-wider block">
                  Kas Fisik Dihitung
                </span>
                <span className="font-mono font-black text-lg text-komazi-coral">
                  {formatRupiah(closingCash)}
                </span>
              </div>
              <div className={`p-3 rounded-xl border ${
                difference === 0
                  ? 'bg-success/10 border-success/30'
                  : difference > 0
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-danger/10 border-danger/30'
              }`}>
                <span className="text-[10px] text-komazi-muted uppercase font-bold tracking-wider block">
                  Selisih Kas
                </span>
                <span className={`font-mono font-black text-lg ${
                  difference === 0 ? 'text-success' : difference > 0 ? 'text-blue-400' : 'text-danger'
                }`}>
                  {difference > 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
                </span>
              </div>
            </div>

            {session.notes && (
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border text-[11px] text-komazi-muted italic">
                Catatan Penutupan: "{session.notes}"
              </div>
            )}
          </div>

          {/* 3. Penjualan Menurut Metode Pembayaran */}
          <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
            <h4 className="font-bold text-sm text-komazi-text flex items-center justify-between">
              <span>Rincian Pembayaran Penjualan</span>
              <span className="font-mono font-black text-komazi-text">{formatRupiah(totalSales)}</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-komazi-muted">Tunai</span>
                <span className="font-mono font-bold text-komazi-text">
                  {formatRupiah(paymentMethods.CASH || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-komazi-muted">Kartu</span>
                <span className="font-mono font-bold text-komazi-text">
                  {formatRupiah(paymentMethods.CARD || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-komazi-muted">QRIS</span>
                <span className="font-mono font-bold text-komazi-text">
                  {formatRupiah(paymentMethods.QRIS || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-komazi-muted">Transfer Bank</span>
                <span className="font-mono font-bold text-komazi-text">
                  {formatRupiah(paymentMethods.TRANSFER || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border">
                <span className="text-komazi-muted">Lainnya</span>
                <span className="font-mono font-bold text-komazi-text">
                  {formatRupiah(paymentMethods.OTHER || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Kontribusi Kasir pada Sesi Ini */}
          {cashiers.length > 0 && (
            <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <h4 className="font-bold text-sm text-komazi-text">Kontribusi Kasir Bertugas</h4>
              <div className="divide-y divide-komazi-border/60">
                {cashiers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-komazi-coral/20 text-komazi-coral flex items-center justify-center font-bold text-[10px]">
                        {c.name?.[0] || 'K'}
                      </div>
                      <span className="font-bold text-komazi-text">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-komazi-muted font-mono">{c.ordersCount} pesanan</span>
                      <span className="font-bold font-mono text-komazi-text">{formatRupiah(c.totalSales || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Alur Lanjutan: Presensi Pulang jika sedang bekerja */}
          {isCurrentUserClockedIn && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-emerald-200">
                    Sesi Kasir Selesai Ditutup
                  </div>
                  <p className="text-emerald-300/80 text-[11px] leading-relaxed">
                    Giliran kerja Anda masih tercatat masuk (Clock-In). Jika Anda ingin mengakhiri giliran kerja hari ini, silakan lanjutkan ke presensi pulang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleProceedToClockOut}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Lanjutkan Presensi Pulang</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 border-t border-komazi-border shrink-0 bg-komazi-surface flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-text font-bold text-xs border border-komazi-border transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Ekspor Excel</span>
            </button>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-muted hover:text-white font-medium text-xs border border-komazi-border transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentUserClockedIn && (
              <button
                type="button"
                onClick={handleProceedToClockOut}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span>Presensi Pulang</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-text font-bold text-xs border border-komazi-border transition-all"
            >
              Tutup Laporan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
