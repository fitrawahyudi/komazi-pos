import React, { useState } from 'react';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';
import { useCartStore } from '../../store/cartStore';
import { useOrdersStore } from '../../store/ordersStore';
import { useShiftStore } from '../../store/shiftStore';
import { useStockStore } from '../../store/stockStore';
import { useCustomerStore } from '../../store/customerStore';
import { useAuthStore } from '../../store/authStore';
import { useHrisStore } from '../../store/hrisStore';
import { useSettingsStore } from '../../store/settingsStore';
import { usePrinterStore } from '../../store/printerStore';
import { formatRupiah, formatAccountNumber } from '../../utils/format';
import { getBankBadgeStyle } from '../settings/BankTransferSettingsCard';
import { convertStaticToDynamicQris, generateQrDataUrl } from '../../utils/qris';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import { toast } from '../../store/toastStore';
import LoadingButton from '../ui/loading/LoadingButton';
import ThermalReceiptModal from './ThermalReceiptModal';
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
  Printer,
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
  const isBankTransferEnabled = settings?.bankTransferEnabled !== false;
  const bankAccounts = Array.isArray(settings?.bankAccounts) && settings.bankAccounts.length > 0
    ? settings.bankAccounts
    : [
        {
          id: 'bank-default',
          bankName: settings?.bankName || 'BCA',
          accountNumber: settings?.bankAccountNumber || '8291002931',
          accountName: settings?.bankAccountName || 'PT KOMAZI KREATIF BERSAMA',
          isDefault: true,
        },
      ];

  const defaultBank = bankAccounts.find((b) => b.isDefault) || bankAccounts[0];
  const [selectedBankId, setSelectedBankId] = useState(() => defaultBank?.id || 'bank-default');
  const activeBank = bankAccounts.find((b) => b.id === selectedBankId) || defaultBank || bankAccounts[0];

  const [method, setMethod] = useState('CASH'); // 'CASH' | 'QRIS' | 'TRANSFER'
  const [cashTendered, setCashTendered] = useState(summary.grandTotal);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [transferRef, setTransferRef] = useState('');
  const [qrisRef, setQrisRef] = useState('');
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

  const [isPrintingBill, setIsPrintingBill] = useState(false);
  const [billReceiptToPreview, setBillReceiptToPreview] = useState(null);

  const handlePrintBill = async () => {
    try {
      setIsPrintingBill(true);
      const billOrder = {
        id: currentHoldBillId || `BILL-${Date.now().toString().slice(-6)}`,
        invoiceNo: sessionInvoiceNo,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
        isBillCheck: true,
        cashierName: typeof user?.name === 'string' ? user.name : 'Kasir',
        type: orderType || 'DINE_IN',
        orderType: orderType || 'DINE_IN',
        tableNo: orderType === 'DINE_IN' ? tableNo : null,
        customerName: customerName || null,
        items: items.map((i) => ({
          productId: i.productId || i.id,
          stationId: i.stationId || i.station?.id || null,
          station: i.station || null,
          name: i.name || i.productName || 'Item',
          productName: i.name || i.productName || 'Item',
          variantName: i.variant?.name || i.variantName || null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          price: Number(i.unitPrice) || 0,
          lineTotal: Number(i.lineTotal) || ((Number(i.qty) || 1) * (Number(i.unitPrice) || 0)),
          note: i.note || null,
        })),
        subtotal: Number(summary.subtotal) || 0,
        discount: Number(summary.discountAmount) || 0,
        promoCode: summary.appliedPromo?.code || null,
        promoName: summary.appliedPromo?.name || null,
        serviceFee: Number(summary.serviceFee) || 0,
        tax: Number(summary.tax) || 0,
        total: Number(summary.grandTotal) || 0,
        grandTotal: Number(summary.grandTotal) || 0,
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
              method === 'TRANSFER'
                ? (typeof transferRef === 'string' && transferRef.trim()
                  ? `${activeBank?.bankName || 'TRF'}: ${transferRef.trim()}`
                  : `TRF-${activeBank?.bankName || 'BANK'}`)
                : method === 'QRIS'
                  ? (typeof qrisRef === 'string' && qrisRef.trim()) || `QRIS-${sessionInvoiceNo}`
                  : null,
          },
        ],
        showQris: method === 'QRIS',
      };

      const printerState = usePrinterStore.getState();
      if (printerState.isConnected) {
        toast.info('Mencetak struk tagihan ke printer...');
        const res = await printerState.printReceiptForOrder(billOrder, {
          requestedBy: typeof user?.name === 'string' ? user.name : 'Kasir',
          showQris: method === 'QRIS',
          storeSettings: settings,
          isBillCheck: true,
        });
        if (res.success) {
          toast.success('Struk tagihan berhasil dicetak!');
        } else {
          toast.warning('Printer offline, membuka pratinjau struk...');
          setBillReceiptToPreview(billOrder);
        }
      } else {
        setBillReceiptToPreview(billOrder);
      }
    } catch (err) {
      console.error('[PaymentModal] Gagal cetak struk:', err);
      toast.error('Gagal mencetak struk: ' + err.message);
    } finally {
      setIsPrintingBill(false);
    }
  };

  const handleConfirmPayment = (customReference = null) => {
    if (!activeShift || activeShift.isClosed) {
      toast.error('Tidak dapat memproses transaksi: Sesi kasir belum dibuka. Silakan buka sesi terlebih dahulu.');
      return;
    }

    const myTodaySchedule = useHrisStore.getState().myTodaySchedule;
    const myTodayAttendance = useHrisStore.getState().myTodayAttendance;
    const isOwner = user?.role === 'OWNER';
    const hasClockedIn = isOwner || Boolean(myTodaySchedule?.hasClockedIn || myTodayAttendance?.clockIn);
    if (!isOwner && !hasClockedIn) {
      toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum dapat menyelesaikan transaksi.');
      return;
    }

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
          productId: i.productId || i.id,
          productName: String(i.name || ''),
          name: String(i.name || ''),
          categoryName: i.categoryName ? String(i.categoryName) : null,
          variantName: i.variant?.name ? String(i.variant.name) : null,
          modifiers: i.modifiers?.map((m) => m.name).join(', ') || null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          lineTotal: Number(i.lineTotal) || 0,
          note: i.note ? String(i.note) : null,
          stationId: i.stationId || i.station?.id || null,
          station: i.station || null,
        })),
        workspaceSessionId: attachedWorkspaceSession?.id || null,
        workspaceSession: attachedWorkspaceSession || null,
        subtotal: Number(summary.subtotal) || 0,
        discount: Number(summary.discountAmount) || 0,
        promoCode: summary.appliedPromo?.code || null,
        promoName: summary.appliedPromo?.name || null,
        serviceFee: Number(summary.serviceFee) || 0,
        tax: Number(summary.tax) || 0,
        total: Number(summary.grandTotal) || 0,
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
                ? (typeof transferRef === 'string' && transferRef.trim())
                  ? `${activeBank?.bankName || 'TRF'}: ${transferRef.trim()}`
                  : `TRF-${activeBank?.bankName || 'BANK'}`
                : method === 'QRIS'
                  ? (typeof qrisRef === 'string' && qrisRef.trim()) || `QRIS-${sessionInvoiceNo}`
                  : null),
          },
        ],
      };

      let newOrder;
      try {
        const currentBackendOrderId = useCartStore.getState().currentBackendOrderId;
        if (currentHoldBillId || currentBackendOrderId) {
          newOrder = await upgradeHoldToPaid(currentHoldBillId, orderPayload, currentBackendOrderId);
          useCartStore.setState({ currentHoldBillId: null, currentBackendOrderId: null });
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

        // 3. Customer Loyalty points accumulation & redemption
        const activeRedeemedPoints = useCartStore.getState().redeemedPoints || 0;
        if (selectedCustomerId) {
          const foundCustomer = useCustomerStore.getState().customers.find(
            (c) => c.id === selectedCustomerId
          );
          if (foundCustomer) {
            if (activeRedeemedPoints > 0) {
              useCustomerStore.getState().redeemPoints(
                selectedCustomerId,
                activeRedeemedPoints,
                `Diskon poin belanja invoice #${newOrder?.invoiceNo || sessionInvoiceNo}`
              ).catch((err) => console.warn('Redeem points error:', err));
            }
            useCustomerStore.getState().recordTransaction(foundCustomer.id, summary.grandTotal);
            toast.success(`+${Math.floor(summary.grandTotal / 10000)} Poin Loyalty ditambahkan untuk ${foundCustomer.name}!`);
          }
        } else if (customerName) {
          const foundCustomer = useCustomerStore.getState().customers.find(
            (c) => c.name.toLowerCase() === customerName.toLowerCase() || c.phone === customerName
          );
          if (foundCustomer) {
            if (activeRedeemedPoints > 0) {
              useCustomerStore.getState().redeemPoints(
                foundCustomer.id,
                activeRedeemedPoints,
                `Diskon poin belanja invoice #${newOrder?.invoiceNo || sessionInvoiceNo}`
              ).catch((err) => console.warn('Redeem points error:', err));
            }
            useCustomerStore.getState().recordTransaction(foundCustomer.id, summary.grandTotal);
            toast.success(`+${Math.floor(summary.grandTotal / 10000)} Poin Loyalty ditambahkan untuk ${foundCustomer.name}!`);
          }
        }

        // 3.5 Auto-print kitchen and/or barista tickets if enabled
        try {
          const printerState = usePrinterStore.getState();
          const cashierName = typeof user?.name === 'string' ? user.name : 'Kasir';
          if (printerState.autoPrintKitchenOnCheckout && newOrder) {
            printerState.printKitchenTicketForOrder(newOrder, {
              requestedBy: cashierName,
            });
          }
          if (printerState.autoPrintBaristaOnCheckout && newOrder) {
            printerState.printBaristaTicketForOrder(newOrder, {
              requestedBy: cashierName,
            });
          }
        } catch (err) {
          console.warn('Auto ticket print notice:', err);
        }

        // 4. Clear the current cart & sync open bills
        clearCart(false);
        useCartStore.getState().syncOpenBillsWithBackendOrders?.(false);
        setIsProcessing(false);

        // 5. Open receipt modal callback
        onSuccessOrder(newOrder);
      } catch (err) {
        setIsProcessing(false);
        const errMsg = err?.message || 'Gagal memproses transaksi pembayaran';
        toast.error(errMsg);
        if (errMsg.toLowerCase().includes('sesi kasir') || errMsg.toLowerCase().includes('shift')) {
          useShiftStore.getState().fetchActiveShift?.();
        }
      }
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
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200"
      >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
                <CreditCard className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-base text-komazi-text">Pembayaran</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 sm:space-y-5 flex-1">
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
            <div className={`grid gap-2 ${isBankTransferEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${method === 'CASH'
                    ? 'border-komazi-coral bg-komazi-coral/15 text-komazi-coral shadow-sm'
                    : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:text-white'
                  }`}
              >
                <Banknote className="w-5 h-5 mb-1 text-success" />
                <span>Tunai</span>
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

              {isBankTransferEnabled && (
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
              )}
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
                    onFocus={scrollInputIntoViewOnFocus}
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

                  <div className="space-y-3 max-w-sm w-full">
                    {/* Ringkasan Nominal & Merchant */}
                    <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center space-y-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-komazi-muted">
                        Nominal Pembayaran:
                      </span>
                      <p className="font-mono font-black text-2xl text-komazi-coral">
                        {formatRupiah(summary.grandTotal)}
                      </p>
                    </div>

                    {/* SOP Verifikasi Kasir Tanpa Gateway */}
                    {/* <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border/80 text-left space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-komazi-text">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>SOP Verifikasi Kasir:</span>
                      </div>
                      <p className="text-[11px] text-komazi-muted leading-relaxed">
                        1. Arahkan pelanggan scan QRIS via BCA, Livin', GoPay, ShopeePay, atau DANA.<br />
                        2. Cek bukti transfer centang hijau / dengar speaker QRIS Soundbox.<br />
                        3. Klik tombol <b className="text-komazi-coral">Konfirmasi QRIS</b> di bawah.
                      </p>
                    </div> */}

                    {/* Input Opsional Nomor Referensi / RRN */}
                    {/* <div className="text-left space-y-1">
                      <label className="block text-[11px] font-semibold text-komazi-muted">
                        No. Referensi / 4 Digit RRN Bukti Bayar (Opsional):
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 8821 atau RRN bukti transfer"
                        value={qrisRef}
                        onChange={(e) => setQrisRef(e.target.value)}
                        onFocus={scrollInputIntoViewOnFocus}
                        className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                      />
                    </div> */}

                    {/* Standby Status & Quick Test */}
                    {/* <div className="pt-1 flex items-center justify-between text-[11px] text-komazi-muted border-t border-komazi-border/50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Auto-detect Webhook standby</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSimulatePayment}
                        disabled={isSimulating}
                        className="inline-flex items-center gap-1 text-[11px] text-komazi-coral hover:underline font-semibold"
                        title="Simulasikan notifikasi uang masuk"
                      >
                        <Zap className="w-3 h-3" />
                        <span>{isSimulating ? 'Memverifikasi...' : 'Uji Simulasi'}</span>
                      </button>
                    </div> */}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Method Content 3: TRANSFER */}
          {method === 'TRANSFER' && isBankTransferEnabled && (
            <div className="space-y-3 animate-in fade-in">
              {/* Bank selector pills if multiple accounts */}
              {bankAccounts.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-komazi-muted">
                    Pilih Rekening Bank Tujuan:
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {bankAccounts.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBankId(b.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 ${
                          activeBank?.id === b.id
                            ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm'
                            : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-komazi-text'
                        }`}
                      >
                        <span>{b.bankName}</span>
                        {b.isDefault && (
                          <span
                            className={`text-[9px] px-1 rounded ${
                              activeBank?.id === b.id
                                ? 'bg-white/20 text-white'
                                : 'bg-komazi-surface text-komazi-muted'
                            }`}
                          >
                            Utama
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Bank Details Card */}
              {activeBank && (
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getBankBadgeStyle(
                          activeBank.bankName
                        )}`}
                      >
                        {activeBank.bankName}
                      </span>
                      <span className="text-xs font-bold text-komazi-text">Rekening Toko</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyAccount(activeBank.accountNumber)}
                      className="flex items-center gap-1 text-[11px] text-komazi-teal-light font-semibold hover:underline"
                    >
                      {copiedAccount ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Rekening</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="font-mono font-black text-lg text-komazi-coral tracking-wider">
                    {formatAccountNumber(activeBank.accountNumber)}
                  </p>

                  <p className="text-[11px] text-komazi-muted">
                    a.n. <span className="text-komazi-text font-bold">{activeBank.accountName}</span>
                  </p>
                </div>
              )}

              {/* SOP Petunjuk Kasir */}
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border/80 text-left space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-komazi-text">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SOP Kasir:</span>
                </div>
                <p className="text-[11px] text-komazi-muted leading-relaxed">
                  1. Informasikan nomor rekening bank di atas kepada pelanggan.<br />
                  2. Cek mutasi masuk di aplikasi m-banking atau periksa bukti transfer.<br />
                  3. Klik <b className="text-komazi-coral">Konfirmasi Pembayaran</b> untuk menyelesaikan pesanan.
                </p>
              </div>

              {/* Input Nomor Referensi Transfer */}
              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                  Nomor Referensi Transfer / 4 Digit Terakhir (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: REF-882910 atau nama pengirim"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  onFocus={scrollInputIntoViewOnFocus}
                  className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-komazi-border bg-komazi-surface-2/40 flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 border border-komazi-border text-komazi-muted hover:text-white font-semibold text-xs transition-colors shrink-0 flex items-center justify-center cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isPrintingBill || isProcessing}
            onClick={handlePrintBill}
            className="h-11 px-3.5 sm:px-4 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 border border-komazi-border hover:border-neutral-600 text-komazi-text font-semibold text-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            title="Cetak struk tagihan (Bill) dahulu sebelum konfirmasi pembayaran"
          >
            <Printer className="w-4 h-4 text-komazi-coral" />
            <span className="hidden sm:inline">{isPrintingBill ? 'Mencetak...' : 'Cetak Bill'}</span>
          </button>

          <LoadingButton
            type="button"
            disabled={method === 'CASH' && !isCashSufficient}
            isLoading={isProcessing}
            loadingText="Memproses..."
            variant="primary"
            icon={CheckCircle}
            onClick={() => handleConfirmPayment()}
            className="flex-1 h-11 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center justify-center"
          >
            {method === 'QRIS' ? 'Konfirmasi QRIS' : 'Konfirmasi Pembayaran'}
          </LoadingButton>
        </div>
      </div>
    </div>
  </div>

    {/* Pratinjau / Cetak Struk Tagihan Sementara jika printer belum terhubung */}
    {billReceiptToPreview && (
      <ThermalReceiptModal
        order={billReceiptToPreview}
        onClose={() => setBillReceiptToPreview(null)}
      />
    )}
  </>
  );
}
