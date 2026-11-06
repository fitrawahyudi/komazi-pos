import { create } from 'zustand';
import { qrOrderService } from '../services/qrOrderService';
import { getSocket } from '../services/socket';
import { toast } from './toastStore';
import { NotificationService } from '../services/notification.service';
import { playQrOrderChime } from '../utils/audio';

let reminderInterval = null;

const startPendingReminder = (get) => {
  if (reminderInterval) return;
  // Periksa dan bunyikan pengingat berulang setiap 40 detik jika kasir belum memverifikasi
  reminderInterval = setInterval(() => {
    const { pendingOrders, isPendingModalOpen } = get();
    if (pendingOrders.length > 0 && !isPendingModalOpen) {
      playQrOrderChime();
      toast.info(
        `Terdapat ${pendingOrders.length} pesanan meja yang belum diverifikasi bukti bayarnya.`,
        '🔔 Pengingat Pesanan Meja'
      );
    } else if (pendingOrders.length === 0) {
      stopPendingReminder();
    }
  }, 40000);
};

const stopPendingReminder = () => {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
};

export const useQrOrderStore = create((set, get) => ({
  pendingOrders: [],
  isLoading: false,
  isPendingModalOpen: false,

  setIsPendingModalOpen: (isOpen) => {
    set({ isPendingModalOpen: isOpen });
    // Jika kasir membuka modal, kita jeda sementara chime berulang
    if (isOpen) {
      // Kasir sedang melihat bukti bayar
    } else {
      // Jika ditutup dan masih ada yang pending, pastikan reminder aktif
      if (get().pendingOrders.length > 0) {
        startPendingReminder(get);
      }
    }
  },

  fetchPendingOrders: async () => {
    try {
      set({ isLoading: true });
      const res = await qrOrderService.getPendingOrders();
      if (res && res.success && Array.isArray(res.data)) {
        set({ pendingOrders: res.data });
        if (res.data.length > 0) {
          startPendingReminder(get);
        } else {
          stopPendingReminder();
        }
      }
    } catch (err) {
      console.warn('Failed to fetch pending QR orders:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  initSocketSync: () => {
    if (typeof window === 'undefined') return;
    const socket = getSocket();
    if (!socket) return;

    // Muat pesanan tertunda pertama kali
    get().fetchPendingOrders();

    // Listen to new QR order received
    socket.off('qr-order:received');
    socket.on('qr-order:received', (data) => {
      // 1. Langsung bunyikan lonceng kafe nyaring & getar
      playQrOrderChime();

      // 2. Refresh daftar pesanan tertunda & aktifkan looping pengingat
      get().fetchPendingOrders();

      // 3. Notifikasi visual & push sistem
      toast.info(
        `Pesanan Meja ${data?.order?.tableNo || data?.tableNo || ''} (${data?.order?.customerName || data?.customerName || 'Pelanggan'}) telah masuk. Mohon tinjau bukti bayar.`,
        '🔔 Pesanan Meja Baru!'
      );
      NotificationService.notifyNewOrder?.({
        invoiceNo: data?.order?.invoiceNo || data?.invoiceNo,
        tableNumber: data?.order?.tableNo || data?.tableNo,
        customerName: data?.order?.customerName || data?.customerName,
        total: data?.order?.total || data?.total,
      })?.catch?.(() => {});
    });

    // Listen to confirmed/rejected events to refresh list
    socket.off('qr-order:confirmed');
    socket.on('qr-order:confirmed', () => {
      get().fetchPendingOrders();
    });

    socket.off('qr-order:rejected');
    socket.on('qr-order:rejected', () => {
      get().fetchPendingOrders();
    });
  },
}));


