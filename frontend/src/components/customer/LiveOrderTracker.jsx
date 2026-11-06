import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Coffee,
  XCircle,
  RefreshCw,
  ShoppingBag,
  Utensils,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { qrOrderService } from '../../services/qrOrderService';
import { getSocket } from '../../services/socket';
import { formatRupiah } from '../../utils/format';

export default function LiveOrderTracker({
  orderInvoice,
  initialData,
  onOrderMore,
  tableNo,
}) {
  const [order, setOrder] = useState(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showItemList, setShowItemList] = useState(false);

  const fetchStatus = async (showLoading = false) => {
    if (!orderInvoice) return;
    if (showLoading) setIsRefreshing(true);

    try {
      const res = await qrOrderService.getOrderStatus(orderInvoice);
      if (res?.data) {
        setOrder(res.data);
      }
    } catch (err) {
      console.warn('Gagal memuat status pesanan:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Polling tiap 4 detik untuk update status otomatis
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [orderInvoice]);

  // WebSocket listener seketika saat kasir konfirmasi atau tolak
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = (data) => {
      if (
        !data ||
        data.invoiceNo === orderInvoice ||
        String(data.orderId) === String(order?.id)
      ) {
        fetchStatus(false);
      }
    };

    socket.on('qr-order:confirmed', handleUpdate);
    socket.on('qr-order:rejected', handleUpdate);
    socket.on('order:updated', handleUpdate);

    return () => {
      socket.off('qr-order:confirmed', handleUpdate);
      socket.off('qr-order:rejected', handleUpdate);
      socket.off('order:updated', handleUpdate);
    };
  }, [orderInvoice, order?.id]);

  if (isLoading && !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-9 h-9 text-amber-500 animate-spin mb-3" />
        <p className="text-zinc-300 font-semibold text-sm">Menghubungkan ke kasir...</p>
      </div>
    );
  }

  const isPaid = order?.status === 'PAID' || order?.status === 'COMPLETED';
  const isRejected = order?.status === 'VOIDED' || order?.status === 'CANCELLED';
  const isPending = !isPaid && !isRejected;

  const cleanTable = String(order?.tableNo || tableNo || '').replace(/^(meja\s*)+/i, '').trim();
  const formattedTable = cleanTable ? `MEJA ${cleanTable}`.toUpperCase() : 'MEJA -';

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4 animate-in fade-in duration-200">
      {/* Kartu Status Pembayaran & Notifikasi Dapur */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden backdrop-blur-md">
        {/* Glow ambient background */}
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isPaid ? 'bg-emerald-500' : isRejected ? 'bg-rose-500' : 'bg-amber-500'
          }`}
        />

        {/* Nomor Meja & Nama Tamu Badge */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {formattedTable}
          </div>
          {order?.customerName && (
            <p className="text-xs text-zinc-400">
              Pesanan atas nama <strong className="text-zinc-200">{order.customerName}</strong>
            </p>
          )}
        </div>

        {/* 1. Status: Pembayaran Berhasil & Pesanan Sedang Disiapkan */}
        {isPaid && (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 size={44} strokeWidth={2.5} />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Pembayaran Berhasil
              </div>
              <h2 className="text-xl font-black text-white">
                Pesanan Sedang Disiapkan
              </h2>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 text-left space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Coffee size={16} />
                <span>Barista & Dapur Sedang Membuat Pesanan</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Pembayaran Anda telah diverifikasi oleh kasir. Pesanan Anda saat ini sedang diracik dan akan segera diantarkan ke meja Anda.
              </p>
            </div>
          </div>
        )}

        {/* 2. Status: Menunggu Verifikasi Pembayaran */}
        {isPending && (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xl">
              <Clock size={40} className="animate-pulse" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">
                Bukti Transfer Terkirim
              </h2>
            </div>

            <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Foto bukti transfer Anda telah diterima sistem. Kasir sedang memeriksa transaksi Anda.
            </p>

            {/* Kartu Petunjuk Ramah jika Kasir Sedang Sibuk Meracik */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left space-y-1.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <Coffee size={15} className="shrink-0" />
                <span>Barista Sedang Meracik Pesanan</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Barista kami mungkin sedang fokus meracik pesanan tamu. Jika dalam beberapa saat status belum terkonfirmasi, Kakak boleh langsung mengingatkan atau menunjukkan layar ini di kasir ya! 😊
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 pt-1">
              <RefreshCw size={12} className="animate-spin text-amber-500" />
              <span>Memeriksa status secara otomatis...</span>
            </div>
          </div>
        )}

        {/* 3. Status: Pembayaran Ditolak */}
        {isRejected && (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
              <XCircle size={44} />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold mb-2">
                Pembayaran Ditolak
              </div>
              <h2 className="text-lg font-bold text-white">
                Bukti Tidak Terverifikasi
              </h2>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 text-left space-y-1">
              <p className="font-bold">Alasan Kasir:</p>
              <p className="text-[11px] text-zinc-300">
                {order?.voidReason || 'Bukti transfer tidak dapat diverifikasi atau nominal tidak sesuai.'}
              </p>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Silakan hubungi kasir atau lakukan pemesanan ulang.
            </p>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            <span>Nomor Invoice:</span>
            <span className="font-mono text-zinc-200 font-bold ml-1.5">{order?.invoiceNo || orderInvoice}</span>
          </div>
          {order?.paidAt && (
            <span className="text-[11px] text-zinc-500 font-mono">
              {new Date(order.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </span>
          )}
        </div>
      </div>

      {/* Rincian Menu Pesanan (Accordion) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowItemList(!showItemList)}
          className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={15} className="text-amber-400" />
            <span>Rincian Menu ({order?.items?.length || 0} item)</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-mono text-emerald-400 font-bold">
              {formatRupiah(order?.total || 0)}
            </span>
            {showItemList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showItemList && (
          <div className="px-4 pb-4 pt-1 space-y-2 border-t border-zinc-800/80 animate-in fade-in duration-150">
            {order?.items?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-2 border-b border-zinc-800/50 last:border-none"
              >
                <div>
                  <p className="font-semibold text-zinc-200">
                    {item.quantity}x {item.name}
                  </p>
                  {item.variantName && (
                    <p className="text-[10px] text-zinc-400">Varian: {item.variantName}</p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-amber-400/90 italic">Catatan: {item.notes}</p>
                  )}
                </div>
                <span className="font-mono text-zinc-300">
                  {formatRupiah(item.lineTotal || item.price * item.quantity)}
                </span>
              </div>
            ))}

            <div className="pt-2 flex items-center justify-between text-xs font-bold text-white">
              <span>Total Pembayaran:</span>
              <span className="text-emerald-400 font-mono text-sm">{formatRupiah(order?.total || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
              <span>Metode Pembayaran:</span>
              <span className="text-zinc-200 font-semibold">{order?.paymentMethod || 'TRANSFER'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tombol Pesan Menu Tambahan */}
      <div className="pt-1">
        <button
          type="button"
          onClick={onOrderMore}
          className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 border border-zinc-700/80 text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Utensils size={15} className="text-amber-400" />
          <span>Pesan Menu Tambahan ke Meja Ini</span>
        </button>
      </div>
    </div>
  );
}
