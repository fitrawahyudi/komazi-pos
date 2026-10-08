import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useCartStore } from '../../store/cartStore';
import { formatRupiah, formatDuration, formatDateTime } from '../../utils/format';
import { X, LogOut, ShoppingBag, CreditCard, Clock, AlertTriangle } from 'lucide-react';

export default function CheckOutModal({ session, onClose, onDirectPay }) {
  const navigate = useNavigate();
  const { calculateCheckout, checkOut } = useWorkspaceStore();
  const { attachWorkspaceSession, setCustomerName } = useCartStore();

  const billing = calculateCheckout(session);

  const handleMergeToPos = async () => {
    // Complete workspace session
    const completed = await checkOut(session.id);
    if (completed) {
      // Attach to cart
      attachWorkspaceSession(completed);
      setCustomerName(completed.customerName);
      onClose();
      navigate('/pos');
    }
  };

  const handleDirectPay = async () => {
    const completed = await checkOut(session.id);
    if (completed) {
      onClose();
      onDirectPay(completed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 text-komazi-teal-light" />
            <h2 className="font-bold text-base text-komazi-text">
              Check-Out: {session.areaName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Customer & Session details */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-komazi-muted">Nama Pelanggan:</span>
              <span className="font-bold text-komazi-text">{session.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-komazi-muted">Paket Dipilih:</span>
              <span className="font-semibold text-komazi-teal-light">{session.packageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-komazi-muted">Waktu Check-In:</span>
              <span className="font-mono text-komazi-text">{formatDateTime(session.checkInAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-komazi-muted">Total Durasi Pemakaian:</span>
              <span className="font-bold text-komazi-text">
                {formatDuration(billing.elapsedMinutes)}
              </span>
            </div>
          </div>

          {/* Billing breakdown */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Tarif Paket Dasar ({formatDuration(billing.baseDuration)}):</span>
              <span className="font-mono font-bold">{formatRupiah(billing.baseCharge)}</span>
            </div>

            {billing.overtimeMinutes > 0 && (
              <div className="flex justify-between text-danger font-semibold">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Kelebihan Waktu / Overtime ({billing.overtimeHours} jam):</span>
                </span>
                <span className="font-mono">+{formatRupiah(billing.overtimeCharge)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-komazi-border flex justify-between items-baseline font-bold text-sm">
              <span className="text-komazi-text">TOTAL TAGIHAN WORKSPACE:</span>
              <span className="font-display font-black text-lg text-komazi-coral tabular-nums font-mono">
                {formatRupiah(billing.totalCharge)}
              </span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleMergeToPos}
              className="w-full py-3 px-4 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
            >
              <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
              <span>Gabung ke Kasir POS (Tambah Kopi / Makanan)</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPay}
              className="w-full py-2.5 px-4 rounded-xl bg-komazi-teal hover:bg-komazi-teal-light text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Bayar Langsung Workspace Saja</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
