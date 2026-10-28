import React, { useState } from 'react';
import {
  X,
  Receipt,
  Printer,
  FileText,
  User,
  Calendar,
  Clock,
  Utensils,
  Coffee,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Check,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  ShieldCheck,
  AlertTriangle,
  Layers,
  MapPin,
  Flame,
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { toast } from '../../store/toastStore';

export default function OrderDetailModal({
  order,
  isOpen,
  onClose,
  onPrintCustomerReceipt,
  onPrintMerchantReceipt,
}) {
  if (!isOpen || !order) return null;

  const [copiedInvoice, setCopiedInvoice] = useState(false);

  const handleCopyInvoice = () => {
    if (!order.invoiceNo) return;
    navigator.clipboard?.writeText(order.invoiceNo);
    setCopiedInvoice(true);
    toast.success('Nomor invoice disalin!');
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  const cashierName =
    order.cashierName ||
    order.cashier?.name ||
    order.shift?.cashier?.name ||
    'Kasir';

  const payment = order.payments?.[0];
  const paymentMethod = (
    payment?.method ||
    order.paymentMethod ||
    'CASH'
  ).toUpperCase();

  const isDineIn =
    order.type === 'DINE_IN' || order.orderType === 'DINE_IN';

  // Hitung status badge style
  const getStatusBadge = () => {
    switch (order.status) {
      case 'PAID':
        return {
          label: 'LUNAS / SELESAI',
          icon: CheckCircle2,
          bg: 'bg-success/15 text-success border-success/30',
        };
      case 'VOIDED':
        return {
          label: 'DIBATALKAN (VOID)',
          icon: XCircle,
          bg: 'bg-danger/15 text-danger border-danger/30',
        };
      case 'REFUNDED':
        return {
          label: 'DI-REFUND',
          icon: RotateCcw,
          bg: 'bg-warning/15 text-warning border-warning/30',
        };
      default:
        return {
          label: 'BELUM DIBAYAR (OPEN)',
          icon: Clock,
          bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  // Render payment icon
  const getPaymentIcon = () => {
    if (paymentMethod.includes('QRIS') || paymentMethod.includes('QR')) {
      return QrCode;
    }
    if (paymentMethod.includes('TRANSFER') || paymentMethod.includes('CARD')) {
      return CreditCard;
    }
    return Banknote;
  };
  const PaymentIcon = getPaymentIcon();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden text-komazi-text">

        {/* 1. MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-komazi-border bg-komazi-surface-2/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base sm:text-lg text-komazi-coral">
                  {order.invoiceNo}
                </h3>
              </div>
              <p className="text-[11px] text-komazi-muted">
                Rincian lengkap transaksi & status pembayaran
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.bg}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{statusBadge.label}</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Banner: Void Notice if VOIDED */}
          {order.status === 'VOIDED' && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-3 text-xs text-danger">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-danger">Transaksi Ini Telah Dibatalkan (VOID)</p>
                <p className="mt-0.5 text-[11px] text-danger/90">
                  <strong>Alasan:</strong> "{order.voidReason || 'Tidak ada alasan dicatat'}"
                </p>
              </div>
            </div>
          )}

          {/* Banner: Refund Notice if REFUNDED */}
          {order.status === 'REFUNDED' && (
            <div className="p-3.5 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-3 text-xs text-warning">
              <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-warning">Transaksi Ini Telah Di-refund</p>
                <p className="mt-0.5 text-[11px] text-warning/90">
                  <strong>Keterangan:</strong> "{order.voidReason || order.refundReason || 'Pengembalian dana pelanggan'}"
                </p>
              </div>
            </div>
          )}

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. Waktu Transaksi */}
            <div className="p-3 rounded-xl bg-komazi-surface-2/70 border border-komazi-border/80 space-y-1">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[10px] uppercase font-bold tracking-wider">
                <Calendar className="w-3 h-3 text-komazi-coral" />
                <span>Waktu Dibuat</span>
              </div>
              <p className="text-xs font-semibold text-komazi-text">
                {formatDateTime(order.createdAt)}
              </p>
            </div>

            {/* 2. Kasir Penanggung Jawab */}
            <div className="p-3 rounded-xl bg-komazi-surface-2/70 border border-komazi-border/80 space-y-1">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[10px] uppercase font-bold tracking-wider">
                <User className="w-3 h-3 text-komazi-coral" />
                <span>Kasir</span>
              </div>
              <p className="text-xs font-bold text-komazi-text truncate">
                {cashierName}
              </p>
            </div>

            {/* 3. Pelanggan & Meja */}
            <div className="p-3 rounded-xl bg-komazi-surface-2/70 border border-komazi-border/80 space-y-1">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[10px] uppercase font-bold tracking-wider">
                <Utensils className="w-3 h-3 text-komazi-coral" />
                <span>Layanan</span>
              </div>
              <p className="text-xs font-bold text-komazi-text">
                {isDineIn ? `Dine In • Meja ${order.tableNo || '-'}` : 'Take Away'}
              </p>
              <p className="text-[10px] text-komazi-muted truncate">
                {order.customerName || 'Tamu Reguler'}
                {order.customer?.tier && (
                  <span className="ml-1 text-[9px] text-komazi-coral font-bold">
                    ({order.customer.tier})
                  </span>
                )}
              </p>
            </div>

            {/* 4. Metode Bayar */}
            <div className="p-3 rounded-xl bg-komazi-surface-2/70 border border-komazi-border/80 space-y-1">
              <div className="flex items-center gap-1.5 text-komazi-muted text-[10px] uppercase font-bold tracking-wider">
                <PaymentIcon className="w-3 h-3 text-komazi-coral" />
                <span>Metode Bayar</span>
              </div>
              <p className="text-xs font-bold text-komazi-text">
                {paymentMethod === 'CASH' ? 'TUNAI' : paymentMethod}
              </p>
              {payment?.reference && (
                <p className="text-[9px] font-mono text-komazi-muted truncate">
                  Ref: {payment.reference}
                </p>
              )}
            </div>
          </div>

          {/* Workspace Session if Attached */}
          {order.workspaceSession && (
            <div className="p-3.5 rounded-xl bg-komazi-teal/10 border border-komazi-teal/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-komazi-teal/20 text-komazi-teal-light">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-komazi-teal-light">
                    Sesi Coworking Space: {order.workspaceSession.areaName || 'Workspace'}
                  </h4>
                  <p className="text-[10px] text-komazi-muted">
                    Paket {order.workspaceSession.packageName || 'Standar'} • Durasi: {order.workspaceSession.durationHours || 1} Jam
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-xs text-komazi-teal-light">
                  {formatRupiah(order.workspaceSession.charge || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Order Items Table */}
          <div className="rounded-xl border border-komazi-border bg-komazi-surface-2/40 overflow-hidden">
            <div className="px-4 py-2.5 bg-komazi-surface-2 border-b border-komazi-border flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-komazi-muted flex items-center gap-2">
                <span>Rincian Item Pesanan</span>
                <span className="px-1.5 py-0.5 rounded-full bg-komazi-border text-[10px] text-komazi-text font-bold font-mono">
                  {order.items?.length || 0}
                </span>
              </h4>
              <span className="text-[10px] text-komazi-muted">
                Harga Bersih Termasuk Pilihan
              </span>
            </div>

            <div className="divide-y divide-komazi-border/60">
              {(order.items || []).map((item, idx) => {
                const isBar =
                  item.station?.type === 'BAR' ||
                  item.stationId === 1 ||
                  (item.productName || item.name || '').toLowerCase().includes('kopi') ||
                  (item.productName || item.name || '').toLowerCase().includes('tea') ||
                  (item.productName || item.name || '').toLowerCase().includes('drink');

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 flex items-start justify-between gap-3 hover:bg-komazi-surface-2/60 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isBar
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                          }`}
                        title={isBar ? 'Station Barista' : 'Station Kitchen'}
                      >
                        {isBar ? (
                          <Coffee className="w-3.5 h-3.5" />
                        ) : (
                          <Utensils className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-xs text-komazi-text">
                            {item.productName || item.name || 'Menu'}
                          </p>
                          {item.variantName && (
                            <span className="px-1.5 py-0.2 rounded bg-komazi-surface-2 text-[10px] text-komazi-muted border border-komazi-border font-medium">
                              {item.variantName}
                            </span>
                          )}
                        </div>

                        {item.note && (
                          <p className="text-[10px] text-komazi-muted italic">
                            * {item.note}
                          </p>
                        )}

                        <div className="text-[11px] text-komazi-muted flex items-center gap-2">
                          <span>
                            {item.qty} × {formatRupiah(item.unitPrice)}
                          </span>
                          {Number(item.discount) > 0 && (
                            <span className="text-danger text-[10px]">
                              (Diskon -{formatRupiah(item.discount)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-xs text-komazi-text">
                        {formatRupiah(item.lineTotal || item.qty * item.unitPrice)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="p-4 rounded-xl bg-komazi-surface-2/80 border border-komazi-border space-y-2 text-xs">
            <div className="flex justify-between text-komazi-muted">
              <span>Subtotal Item:</span>
              <span className="font-mono font-medium text-komazi-text">
                {formatRupiah(order.subtotal || order.total || 0)}
              </span>
            </div>

            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-komazi-coral">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>Potongan Diskon:</span>
                </span>
                <span className="font-mono font-bold">
                  -{formatRupiah(order.discount)}
                </span>
              </div>
            )}

            {Number(order.tax) > 0 && (
              <div className="flex justify-between text-komazi-muted">
                <span>Pajak Restoran (PB1 10%):</span>
                <span className="font-mono font-medium text-komazi-text">
                  +{formatRupiah(order.tax)}
                </span>
              </div>
            )}

            {Number(order.serviceFee) > 0 && (
              <div className="flex justify-between text-komazi-muted">
                <span>Biaya Layanan (Service 5%):</span>
                <span className="font-mono font-medium text-komazi-text">
                  +{formatRupiah(order.serviceFee)}
                </span>
              </div>
            )}

            <div className="border-t border-komazi-border/80 pt-2 flex justify-between items-baseline">
              <span className="font-bold text-sm text-komazi-text">
                Total Tagihan:
              </span>
              <span className="font-mono font-extrabold text-lg text-komazi-coral">
                {formatRupiah(order.total)}
              </span>
            </div>

            {/* Rincian Pembayaran Tunai jika ada */}
            {payment && paymentMethod === 'CASH' && payment.amount && (
              <div className="border-t border-komazi-border/60 pt-2 grid grid-cols-2 gap-2 text-[11px] text-komazi-muted">
                <div>
                  <span>Uang Diterima: </span>
                  <strong className="font-mono text-komazi-text">
                    {formatRupiah(payment.amount)}
                  </strong>
                </div>
                <div className="text-right">
                  <span>Kembalian: </span>
                  <strong className="font-mono text-success">
                    {formatRupiah(Math.max(0, payment.amount - order.total))}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
