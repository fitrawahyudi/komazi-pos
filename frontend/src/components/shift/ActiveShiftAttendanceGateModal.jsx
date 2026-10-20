import React from 'react';
import {
  Lock,
  Clock,
  AlertCircle,
  ShieldAlert,
  User,
  Store,
  Calendar,
  Sparkles,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { useAuthStore } from '../../store/authStore';

export default function ActiveShiftAttendanceGateModal({
  isOpen,
  onClose,
  onTriggerVerify,
  activeShift,
}) {
  const { user } = useAuthStore();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Ribbon */}
        <div className="p-6 bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-transparent border-b border-komazi-border text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-inner">
            <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
          </div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 inline-block mb-2">
            Sesi Kasir Aktif
          </span>
          <h2 className="font-display font-black text-xl text-komazi-text tracking-tight">
            Presensi Diperlukan Sebelum Bertransaksi
          </h2>
          <p className="text-xs text-komazi-muted mt-1 leading-relaxed max-w-sm mx-auto">
            Sesi kasir saat ini telah dibuka. Namun Anda belum melakukan presensi hari ini. Untuk melayani pesanan pada sesi ini, silakan Clock-In terlebih dahulu.
          </p>
        </div>

        {/* Info Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Active Shift Card */}
          <div className="p-3.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-2.5">
            <div className="flex items-center justify-between text-komazi-muted">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                <Store className="w-3.5 h-3.5 text-komazi-coral" />
                Terminal &amp; Sesi Aktif
              </span>
              <span className="font-bold text-komazi-text font-mono">
                {activeShift?.registerName || 'Kasir Utama'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-komazi-border/60">
              <span className="text-komazi-muted text-[11px]">Dibuka oleh:</span>
              <span className="font-bold text-komazi-text">
                {activeShift?.cashierName || 'Kasir'}
                {activeShift?.openedAt && (
                  <span className="text-[10px] text-komazi-muted font-normal block text-right font-mono">
                    {formatDateTime(activeShift.openedAt)}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Current Cashier & Attendance Status */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">
                  {user?.name?.[0]?.toUpperCase() || 'K'}
                </div>
                <div>
                  <span className="font-bold text-rose-200 block text-xs">{user?.name || 'Staf'}</span>
                  <span className="text-[10px] text-rose-300/80">{user?.role || 'CASHIER'}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Belum Presensi
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-300/90 pt-1 border-t border-rose-500/20">
              Sistem mencatat kasir per transaksi secara terpisah. Anda wajib melakukan verifikasi presensi (Foto Selfie &amp; GPS) sebelum memproses pesanan.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={onTriggerVerify}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-black font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 stroke-[2.5]" />
              <span>Lakukan Presensi Sekarang (Selfie &amp; GPS)</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:bg-neutral-800 text-komazi-muted hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-komazi-muted" />
                <span>MODE BACA</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
