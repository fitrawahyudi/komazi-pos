import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useOrdersStore } from '../../store/ordersStore';
import { useShiftStore } from '../../store/shiftStore';
import { useStockStore } from '../../store/stockStore';
import { useCustomerStore } from '../../store/customerStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRupiah } from '../../utils/format';
import { convertStaticToDynamicQris, generateQrDataUrl } from '../../utils/qris';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import { toast } from '../../store/toastStore';
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Users,
  ShieldCheck,
  Loader2,
  Radio,
  Zap,
} from 'lucide-react';

function playPaymentSuccessChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // fallback
  }
}

export default function PaymentModal({ onClose, onSuccessOrder }) {
  const { items, orderType, tableNo, customerName, selectedCustomerId, attachedWorkspaceSession, getCartSummary, clearCart, currentHoldBillId } =
    useCartStore();
  const { createOrder, upgradeHoldToPaid } = useOrdersStore();
  const { recordSaleToShift, activeShift } = useShiftStore();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();

  const summary = getCartSummary();
  const [method, setMethod] = useState('CASH'); // 'CASH' | 'QRIS' | 'TRANSFER'
  const [cashTendered, setCashTendered] = useState(summary.grandTotal);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrisQrDataUrl, setQrisQrDataUrl] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [autoPaidSuccess, setAutoPaidSuccess] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Unique invoice identifier for this payment session
  const [sessionInvoiceNo] = useState(() =>
    currentHoldBillId ? `BILL-${currentHoldBillId}` : `KMZ-${Date.now().toString().slice(-6)}`
  );

  // Generate Dynamic QRIS on demand
  React.useEffect(() => {
    if (method === 'QRIS') {
      setIsGeneratingQr(true);
      const dynamicPayload = convertStaticToDynamicQris(
        settings.qrisStaticString,
        summary.grandTotal,
        {
          mode: settings.qrisMode || 'compatible',
          includeInvoice: settings.qrisIncludeInvoice === true || settings.qrisIncludeInvoice === 'true',
          invoiceNo: sessionInvoiceNo,
        }
      );
      generateQrDataUrl(dynamicPayload, { width: 320 })
        .then((url) => {
          setQrisQrDataUrl(url);
        })
        .catch((err) => {
          console.error('[PaymentModal] Error generating QR code:', err);
        })
        .finally(() => {
          setIsGeneratingQr(false);
        });
    }
  }, [method, summary.grandTotal, settings.qrisStaticString, settings.qrisMode, settings.qrisIncludeInvoice, sessionInvoiceNo]);

  // Quick cash suggestion buttons
  const quickCashOptions = [
    summary.grandTotal, // Uang pas
    Math.ceil(summary.grandTotal / 50000) * 50000,
    100000,
    200000,
    500000,
  ]
    .filter((val, idx, self) => val >= summary.grandTotal && self.indexOf(val) === idx)
    .sort((a, b) => a - b)
    .slice(0, 4);

  const change = Math.max(0, cashTendered - summary.grandTotal);
  const isCashSufficient = cashTendered >= summary.grandTotal;

  const handleCopyAccount = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleConfirmPayment = (customReference = null) => {
    setIsProcessing(true);

    // Pastikan customReference adalah string murni (bukan SyntheticEvent dari onClick)
    const safeReference =
      typeof customReference === 'string' && customReference.trim()
        ? customReference.trim()
        : null;

    setTimeout(async () => {
      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FF5A4D', '#1F6F6B', '#3DBE7A', '#F5B544'],
        });
      } catch (e) {
        // fallback
      }

      // Record to orders store
      const orderPayload = {
        cashierId: user?.id || 1,
        cashierName: typeof user?.name === 'string' ? user.name : 'Kasir',
        shiftId: activeShift?.id || null,
        type: orderType || 'DINE_IN',
        tableNo: orderType === 'DINE_IN' ? (typeof tableNo === 'string' ? tableNo : String(tableNo || '')) : null,
        customerName: typeof customerName === 'string' && customerName.trim() ? customerName.trim() : null,
        customerId: selectedCustomerId || null,
        items: items.map((i) => ({
          productId: i.productId,
          productName: String(i.name || ''),
          name: String(i.name || ''),
          categoryName: i.categoryName ? String(i.categoryName) : null,
          variantName: i.variant?.name ? String(i.variant.name) : null,
          modifiers: i.modifiers?.map((m) => m.name).join(', ') || null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          lineTotal: Number(i.lineTotal) || 0,
          note: i.note ? String(i.note) : null,
        })),
        workspaceSessionId: attachedWorkspaceSession?.id || null,
        workspaceSession: attachedWorkspaceSession || null,
        subtotal: Number(summary.subtotal) || 0,
        discount: Number(summary.discountAmount) || 0,
        serviceFee: Number(summary.serviceFee) || 0,
        tax: Number(summary.tax) || 0,
        total: Number(summary.grandTotal) || 0,
        shiftId: activeShift?.id || null,
        paymentMethod: method,
        cashReceived: method === 'CASH' ? Number(cashTendered) : null,
        cashChange: method === 'CASH' ? Number(change) : 0,
        payments: [
          {
            method,
            amount: Number(summary.grandTotal) || 0,
            tendered: method === 'CASH' ? Number(cashTendered) : Number(summary.grandTotal) || 0,
            change: method === 'CASH' ? Number(change) : 0,
            reference:
              safeReference ||
              (method === 'TRANSFER'
                ? (typeof transferRef === 'string' && transferRef.trim()) || 'TRF-AUTO'
                : method === 'QRIS'
                  ? `QRIS-${sessionInvoiceNo}`
                  : null),
          },
        ],
      };

      // Jika pembayaran ini berasal dari hold bill yang direstore, upgrade hold order ke PAID agar tidak ada duplikasi di KDS
      let newOrder;
      if (currentHoldBillId) {
        const currentBackendOrderId = useCartStore.getState().currentBackendOrderId;
        newOrder = await upgradeHoldToPaid(currentHoldBillId, orderPayload, currentBackendOrderId);
      } else {
        newOrder = await createOrder(orderPayload);
      }

      // 1. Record into active shift
      recordSaleToShift(method, summary.grandTotal);

      // 2. Professional Auto-Deduction of Recipe Ingredients (BOM)
      try {
        const stockStore = useStockStore.getState();
        if (typeof stockStore.deductStockForOrder === 'function') {
          stockStore.deductStockForOrder(items, newOrder?.invoiceNo || sessionInvoiceNo);
        } else if (typeof stockStore.deductIngredientsForOrder === 'function') {
          stockStore.deductIngredientsForOrder(items, newOrder?.invoiceNo || sessionInvoiceNo);
        }
      } catch (err) {
        console.warn('Auto stock deduction notice:', err);
      }

      // 3. Customer Loyalty points accumulation
      if (selectedCustomerId) {
        const foundCustomer = useCustomerStore.getState().customers.find(
          (c) => c.id === selectedCustomerId
        );
        if (foundCustomer) {
          useCustomerStore.getState().recordTransaction(foundCustomer.id, summary.grandTotal);
          toast.success(`+${Math.floor(summary.grandTotal / 10000)} Poin Loyalty ditambahkan untuk ${foundCustomer.name}!`);
        }
      } else if (customerName) {
        const foundCustomer = useCustomerStore.getState().customers.find(
          (c) => c.name.toLowerCase() === customerName.toLowerCase() || c.phone === customerName
        );
        if (foundCustomer) {
          useCustomerStore.getState().recordTransaction(foundCustomer.id, summary.grandTotal);
          toast.success(`+${Math.floor(summary.grandTotal / 10000)} Poin Loyalty ditambahkan untuk ${foundCustomer.name}!`);
        }
      }

      // 4. Clear the current cart
      clearCart();
      setIsProcessing(false);

      // 5. Open receipt modal callback
      onSuccessOrder(newOrder);
    }, 400);
  };

  // Auto-poll payment status when QRIS method is active
  React.useEffect(() => {
    if (method !== 'QRIS' || autoPaidSuccess || isProcessing) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await api.payments.checkStatus(sessionInvoiceNo, summary.grandTotal);
        if (isMounted && res && res.success && res.data && res.data.isPaid) {
          clearInterval(interval);
          playPaymentSuccessChime();
          setAutoPaidSuccess(true);
          toast.success('Uang berhasil masuk! Menyelesaikan transaksi otomatis...');
          setTimeout(() => {
            handleConfirmPayment(res.data.order?.payments?.[0]?.reference || 'WEBHOOK-AUTO');
          }, 1400);
        }
      } catch (err) {
        // quiet polling error
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [method, autoPaidSuccess, isProcessing, sessionInvoiceNo, summary.grandTotal]);

  // Simulate payment webhook directly from UI
  const handleSimulatePayment = async () => {
    if (isSimulating || isProcessing) return;
    setIsSimulating(true);
    try {
      toast.info('Mensimulasikan webhook dana masuk...');
      const res = await api.payments.simulate({
        invoiceNo: sessionInvoiceNo,
        amount: summary.grandTotal,
      });
      playPaymentSuccessChime();
      setAutoPaidSuccess(true);
      toast.success('Simulasi Sukses: Pembayaran terdeteksi masuk!');
      setTimeout(() => {
        handleConfirmPayment('SIMULASI-TEST-OK');
      }, 1400);
    } catch (err) {
      toast.error('Gagal simulasi: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-komazi-coral" />
            <h2 className="font-bold text-base text-komazi-text">Pembayaran</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Total Tagihan Box */}
          <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex flex-col items-center justify-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-komazi-muted">
              Total Tagihan
            </span>
            <span className="font-display font-black text-3xl text-komazi-coral tabular-nums mt-1 font-mono">
              {formatRupiah(summary.grandTotal)}
            </span>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-komazi-muted">
              <span>{orderType === 'DINE_IN' ? `Dine-in (Meja ${tableNo || '-'})` : 'Take-away'}</span>
              <span>•</span>
              <span>{summary.totalQty} Produk</span>
              {attachedWorkspaceSession && (
                <>
                  <span>•</span>
                  <span className="text-komazi-teal-light font-medium">+ Workspace</span>
                </>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-2">
              Pilih Metode Pembayaran:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${method === 'CASH'
                    ? 'border-komazi-coral bg-komazi-coral/15 text-komazi-coral shadow-sm'
                    : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:text-white'
                  }`}
              >
                <Banknote className="w-5 h-5 mb-1 text-success" />
                <span>Tunai (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('QRIS')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${method === 'QRIS'
                    ? 'border-komazi-coral bg-komazi-coral/15 text-komazi-coral shadow-sm'
                    : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:text-white'
                  }`}
              >
                <QrCode className="w-5 h-5 mb-1 text-komazi-coral" />
                <span>QRIS Dinamis</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('TRANSFER')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${method === 'TRANSFER'
                    ? 'border-komazi-coral bg-komazi-coral/15 text-komazi-coral shadow-sm'
                    : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:text-white'
                  }`}
              >
                <CreditCard className="w-5 h-5 mb-1 text-komazi-teal-light" />
                <span>Transfer Bank</span>
              </button>
            </div>
          </div>

          {/* Method Content 1: CASH */}
          {method === 'CASH' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Quick Cash Buttons */}
              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1.5">
                  Uang Diterima Cepat:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickCashOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCashTendered(opt)}
                      className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${cashTendered === opt
                          ? 'border-komazi-coral bg-komazi-coral text-white'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-text hover:border-komazi-muted'
                        }`}
                    >
                      {opt === summary.grandTotal ? 'Uang Pas' : formatRupiah(opt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Cash Input */}
              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                  Nominal Uang Fisik Kas:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-komazi-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={summary.grandTotal}
                    step="1000"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-bold font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
              </div>

              {/* Kembalian Box */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${isCashSufficient
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-danger/10 border-danger/30 text-danger'
                  }`}
              >
                <span className="text-xs font-bold">
                  {isCashSufficient ? 'Uang Kembalian:' : 'Uang Kurang:'}
                </span>
                <span className="font-mono font-black text-lg tabular-nums">
                  {isCashSufficient
                    ? formatRupiah(change)
                    : formatRupiah(summary.grandTotal - cashTendered)}
                </span>
              </div>
            </div>
          )}

          {/* Method Content 2: QRIS */}
          {method === 'QRIS' && (
            <div className="space-y-4 animate-in fade-in flex flex-col items-center text-center">
              {autoPaidSuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 w-full flex flex-col items-center justify-center gap-3 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-display font-black text-lg text-emerald-400 block tracking-wide">
                      PEMBAYARAN QRIS DITERIMA!
                    </span>
                    <span className="text-xs text-neutral-300">
                      Uang {formatRupiah(summary.grandTotal)} telah terdeteksi masuk ke rekening
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-400/90 font-medium pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan pesanan & mencetak struk...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative p-3 bg-white rounded-2xl shadow-xl border-4 border-komazi-coral inline-flex items-center justify-center min-w-[190px] min-h-[190px]">
                    {isGeneratingQr ? (
                      <div className="flex flex-col items-center justify-center gap-2 p-8 text-neutral-600">
                        <Loader2 className="w-8 h-8 animate-spin text-komazi-coral" />
                        <span className="text-xs font-semibold">Menghasilkan QRIS Dinamis...</span>
                      </div>
                    ) : qrisQrDataUrl ? (
                      <img
                        src={qrisQrDataUrl}
                        alt="QRIS Dinamis"
                        className="w-48 h-48 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="p-8 text-neutral-500 text-xs font-medium">
                        Gagal memuat QR Code
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 max-w-sm w-full">
                    {/* Live Auto-detect Indicator */}
                    <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-full bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-muted">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Mendeteksi transfer masuk otomatis (Webhook aktif)...</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center space-y-0.5">
                      <span className="text-[11px] text-komazi-muted">Nominal Pembayaran:</span>
                      <p className="font-mono font-black text-lg text-komazi-coral">
                        {formatRupiah(summary.grandTotal)}
                      </p>
                      <p className="text-[10px] text-komazi-muted">
                        {settings.qrisMerchantName || settings.storeName || 'KOMAZI COFFEE & WORKSPACE'}
                      </p>
                    </div>

                    <p className="text-xs text-komazi-muted leading-relaxed">
                      Arahkan pelanggan scan via ShopeePay, BCA, Livin', GoPay, atau DANA.{' '}
                      <span className="text-komazi-text font-semibold">Nominal terkunci otomatis.</span>
                    </p>

                    {/* Quick Simulation Test Button */}
                    <div className="pt-1 border-t border-komazi-border/50">
                      <button
                        type="button"
                        onClick={handleSimulatePayment}
                        disabled={isSimulating}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-komazi-coral/10 hover:bg-komazi-coral/20 text-komazi-coral text-[11px] font-bold border border-komazi-coral/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{isSimulating ? 'Memverifikasi...' : 'Uji Simulasi Uang Masuk (Test Webhook)'}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Method Content 3: TRANSFER */}
          {method === 'TRANSFER' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-komazi-text">BCA - Rekening Operasional</span>
                  <button
                    type="button"
                    onClick={() => handleCopyAccount('8291002931')}
                    className="flex items-center gap-1 text-[11px] text-komazi-teal-light font-semibold hover:underline"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAccount ? 'Tersalin' : 'Salin Rekening'}</span>
                  </button>
                </div>
                <p className="font-mono font-bold text-sm text-komazi-coral">829-100-2931</p>
                <p className="text-[11px] text-komazi-muted">a.n. PT KOMAZI KREATIF BERSAMA</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                  Nomor Referensi Transfer / 4 Digit Terakhir:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: REF-882910"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-komazi-border bg-komazi-surface flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={method === 'CASH' && !isCashSufficient}
            onClick={() => handleConfirmPayment()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs sm:text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <CheckCircle className="w-4 h-4 stroke-[2.5]" />
            <span>{isProcessing ? 'Memproses...' : 'Konfirmasi'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
