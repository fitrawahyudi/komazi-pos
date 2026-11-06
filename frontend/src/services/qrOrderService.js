import { request } from './api.js';

/**
 * Service API untuk Fitur QR Order Meja (Customer Self-Order & Cashier Verification)
 */
export const qrOrderService = {
  /**
   * Ambil konfigurasi publik (status saklar, rekening bank, qris)
   */
  async getConfig() {
    return request('/public/qr-order/config');
  },

  /**
   * Ambil katalog menu publik untuk pemesanan mandiri meja
   */
  async getMenu() {
    return request('/public/qr-order/menu');
  },

  /**
   * Validasi stok item keranjang secara real-time sebelum pembayaran
   */
  async validateCart(items) {
    return request('/public/qr-order/validate-cart', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  /**
   * Kirim pesanan meja pelanggan beserta foto bukti transfer
   */
  async checkout(payload) {
    let body;
    if (payload instanceof FormData) {
      body = payload;
    } else {
      body = JSON.stringify(payload);
    }

    return request('/public/qr-order/checkout', {
      method: 'POST',
      body,
    });
  },

  /**
   * [Kasir] Ambil daftar pesanan meja yang menunggu verifikasi
   */
  async getPendingOrders() {
    return request('/orders/qr-pending');
  },

  /**
   * [Kasir] Konfirmasi pembayaran pesanan meja (Ubah ke PAID & potong stok)
   */
  async confirmPayment(orderId) {
    return request(`/orders/${orderId}/confirm-qr-payment`, {
      method: 'POST',
    });
  },

  /**
   * [Kasir] Tolak pesanan meja (Ubah ke VOIDED)
   */
  async rejectPayment(orderId, reason) {
    return request(`/orders/${orderId}/reject-qr-payment`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * [Pelanggan] Cek status terkini pesanan meja (Live Order Tracker)
   */
  async getOrderStatus(identifier) {
    return request(`/public/qr-order/status/${encodeURIComponent(identifier)}`);
  },

  /**
   * [Owner/Manager] Simpan pengaturan saklar & rekening pembayaran QR Order
   */
  async updateSettings(settings) {
    return request('/settings/qr-order', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

