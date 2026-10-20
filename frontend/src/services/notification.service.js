import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { toast } from '../store/toastStore';
import { api } from './api';

const STORAGE_KEY = 'komazi_notification_settings';
const FCM_TOKEN_KEY = 'komazi_fcm_token';

/**
 * Flag kontrol aktivasi Firebase Cloud Messaging (FCM) Push Notifications.
 * Memerlukan file google-services.json diletakkan di frontend/android/app/
 * Set ke false secara default agar aplikasi tidak mengalami FATAL CRASH saat diluncurkan di Android.
 */
const IS_FCM_ENABLED = false;

// Default notification preferences
const defaultSettings = {
  enabled: true,
  orderAlerts: true,
  stockAlerts: true,
  approvalAlerts: true,
  sound: true,
  vibrate: true,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

let isInitialized = false;
let currentPushToken = localStorage.getItem(FCM_TOKEN_KEY) || null;

export const NotificationService = {
  isNative: Capacitor.isNativePlatform(),
  settings: loadSettings(),

  /**
   * Mengambil token FCM aktif saat ini
   */
  getFcmToken() {
    return currentPushToken;
  },

  /**
   * Inisialisasi service: Android Channels, Local Notifications, dan FCM Push Notifications
   */
  async init() {
    if (isInitialized) return;
    isInitialized = true;

    if (this.isNative) {
      try {
        // 1. Buat Android Notification Channels (Wajib untuk Android 8.0+)
        await this.createChannels();

        // 2. Minta izin secara otomatis jika belum ditentukan (Android 13+)
        const perm = await this.checkPermission();
        if (perm === 'prompt') {
          await this.requestPermission();
        }

        // 3. Listener notifikasi lokal saat diklik di Android tray
        await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (action) => {
            const data = action.notification?.extra;
            if (data?.url && typeof window !== 'undefined') {
              window.location.hash = data.url;
            }
          }
        );

        // 4. Inisialisasi Firebase Cloud Messaging (FCM) Push Notifications (jika aktif)
        if (IS_FCM_ENABLED) {
          await this.initPushNotifications();
        }

        console.log('🔔 [NotificationService] Native Android notification system initialized');
      } catch (err) {
        console.warn('🔔 [NotificationService] Failed to initialize native channels:', err);
      }
    }
  },

  /**
   * Konfigurasi dan registrasi FCM Push Notifications via Capacitor
   */
  async initPushNotifications() {
    if (!this.isNative || !IS_FCM_ENABLED) return;

    try {
      // Periksa izin push notifications
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('🔔 [NotificationService] Push notification permission not granted:', permStatus.receive);
        return;
      }

      // Daftarkan listener token FCM
      await PushNotifications.addListener('registration', async (token) => {
        console.log('🔔 [NotificationService] FCM Token registered:', token.value ? `${token.value.slice(0, 8)}...` : 'empty');
        currentPushToken = token.value;
        try {
          localStorage.setItem(FCM_TOKEN_KEY, token.value);
        } catch {}

        // Sinkronkan token ke backend jika sesi login aktif
        await this.syncPushTokenWithBackend();
      });

      // Listener error registrasi
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('🔔 [NotificationService] FCM Registration error:', error);
      });

      // Listener pesan push saat aplikasi berada di latar depan (Foreground)
      await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        console.log('🔔 [NotificationService] Foreground Push Received:', notification.title);
        const settings = this.getSettings();
        if (!settings.enabled) return;

        // Jadwalkan heads-up local banner agar kasir/barista melihat pop-up
        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 90000) + 10000,
                title: notification.title || 'Pemberitahuan Komazi POS',
                body: notification.body || '',
                channelId: notification.data?.category === 'ORDERS' ? 'komazi_orders' : 'komazi_alerts',
                smallIcon: 'ic_launcher',
                iconColor: '#FF5722',
                extra: notification.data || {},
                schedule: { at: new Date(Date.now() + 50) },
              },
            ],
          });
        } catch (localErr) {
          console.warn('🔔 [NotificationService] Error scheduling local banner from push:', localErr);
        }
      });

      // Listener aksi klik push notification tray
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('🔔 [NotificationService] Push Notification Action Performed:', action.actionId);
        const data = action.notification?.data;
        if (data?.url && typeof window !== 'undefined') {
          window.location.hash = data.url;
        }
      });

      // Minta sistem operasi Android untuk mendaftarkan FCM token
      await PushNotifications.register();
    } catch (err) {
      console.warn('🔔 [NotificationService] Push notification setup error:', err);
    }
  },

  /**
   * Sinkronisasi token FCM ke backend saat login atau sesi aktif
   */
  async syncPushTokenWithBackend() {
    if (!IS_FCM_ENABLED || !currentPushToken) return;
    const authToken = localStorage.getItem('komazi-auth-token');
    if (!authToken) return; // User belum login, token akan dikirim setelah login

    try {
      await api.notifications.registerDevice({
        token: currentPushToken,
        platform: 'android',
        deviceModel: navigator.userAgent?.slice(0, 100) || 'Android Device',
      });
      console.log('🔔 [NotificationService] Device token successfully synced with backend user account');
    } catch (err) {
      console.warn('🔔 [NotificationService] Failed to sync push token with backend:', err.message);
    }
  },

  /**
   * Nonaktifkan token di backend saat user logout
   */
  async unregisterPushToken() {
    if (!IS_FCM_ENABLED || !currentPushToken) return;
    try {
      await api.notifications.logoutDevice({ token: currentPushToken });
      console.log('🔔 [NotificationService] Push token successfully unlinked from user session');
    } catch (err) {
      console.warn('🔔 [NotificationService] Error unlinking push token on logout:', err.message);
    }
  },

  /**
   * Membuat channel notifikasi resmi di Android (Notification Channels)
   */
  async createChannels() {
    if (!this.isNative) return;

    try {
      // Channel 1: Pesanan Masuk & KDS (Prioritas Tinggi / Heads-up)
      await LocalNotifications.createChannel({
        id: 'komazi_orders',
        name: 'Pesanan Masuk & KDS',
        description: 'Pemberitahuan realtime pesanan baru masuk dan pesanan siap saji',
        importance: 5, // High: Muncul di atas layar (heads-up) dan berbunyi
        visibility: 1, // Public di lockscreen
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#FF5722',
      });

      // Channel 2: Peringatan Stok & Otorisasi
      await LocalNotifications.createChannel({
        id: 'komazi_alerts',
        name: 'Peringatan Sistem & Stok',
        description: 'Peringatan stok bahan menipis dan permintaan persetujuan supervisor',
        importance: 4,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: '#F59E0B',
      });

      // Channel 3: Informasi Operasional & Sif
      await LocalNotifications.createChannel({
        id: 'komazi_general',
        name: 'Informasi Sif & Operasional',
        description: 'Notifikasi pembukaan dan penutupan sif kasir',
        importance: 3,
        visibility: 0,
        sound: 'default',
        vibration: false,
      });
    } catch (err) {
      console.warn('🔔 [NotificationService] Error creating channels:', err);
    }
  },

  /**
   * Cek status izin notifikasi saat ini
   */
  async checkPermission() {
    if (this.isNative) {
      try {
        const status = await LocalNotifications.checkPermissions();
        return status.display; // 'granted' | 'denied' | 'prompt'
      } catch {
        return 'prompt';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission; // 'granted' | 'denied' | 'default'
    }

    return 'unsupported';
  },

  /**
   * Minta izin notifikasi ke sistem operasi (Android 13+ / Browser)
   */
  async requestPermission() {
    if (this.isNative) {
      try {
        const res = await LocalNotifications.requestPermissions();
        // Minta push permission hanya jika FCM aktif
        if (IS_FCM_ENABLED) {
          try {
            await PushNotifications.requestPermissions();
          } catch {}
        }
        return res.display; // 'granted' | 'denied'
      } catch (err) {
        console.warn('🔔 [NotificationService] Error requesting native permission:', err);
        return 'denied';
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        return res;
      } catch {
        return 'denied';
      }
    }

    return 'unsupported';
  },

  /**
   * Mengirim notifikasi lokal secara langsung (Instant heads-up notification)
   */
  async scheduleNotification({
    id = Date.now() % 100000,
    title,
    body,
    channelId = 'komazi_orders',
    extra = {},
  }) {
    const settings = this.getSettings();
    if (!settings.enabled) return;

    // Jalur A: Native Android via Capacitor
    if (this.isNative) {
      try {
        // Pastikan channel notifikasi Android dibuat jika belum
        await this.createChannels();

        // Cek izin (Android 13+)
        const permStatus = await this.checkPermission();
        if (permStatus === 'prompt' || permStatus === 'prompt-with-rationale') {
          await this.requestPermission();
        }

        // Tampilkan notifikasi langsung tanpa schedule: { at: ... }
        // Menghindari java.lang.SecurityException: SCHEDULE_EXACT_ALARM pada Android 12, 13, 14
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Number(id),
              title,
              body,
              channelId,
              smallIcon: 'ic_launcher',
              iconColor: '#FF5722',
              extra,
            },
          ],
        });
        return { success: true, method: 'CAPACITOR_NATIVE' };
      } catch (err) {
        console.warn('🔔 [NotificationService] Native schedule error:', err);
      }
    }

    // Jalur B: Web Notification API di Browser jika diizinkan
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, {
          body,
          icon: '/komazi-icon.png',
        });
        return { success: true, method: 'WEB_NOTIFICATION' };
      } catch (err) {
        console.warn('🔔 [NotificationService] Web notification failed:', err);
      }
    }

    // Jalur C: Fallback in-app toast
    toast.info(`${title} • ${body}`);
    return { success: true, method: 'IN_APP_TOAST' };
  },

  /**
   * Mengirim notifikasi pesanan masuk umum (POS kasir & sistem)
   */
  async notifyNewOrder(order) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.orderAlerts) return;

    const invoice = order?.invoiceNo || 'Pesanan';
    const total = order?.total ? `Rp ${(Number(order.total) || 0).toLocaleString('id-ID')}` : '';
    const items = order?.items || [];
    const count = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
    const customer = order?.customerName ? `${order.customerName} • ` : '';
    const typeLabel = order?.type === 'TAKE_AWAY' ? 'Take Away' : order?.tableNumber ? `Meja ${order.tableNumber}` : 'Dine In';

    return this.scheduleNotification({
      id: Math.abs(String(invoice).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 100000,
      title: `🔔 Pesanan Baru #${invoice}`,
      body: `${customer}${typeLabel} • ${count} Item • ${total}`,
      channelId: 'komazi_orders',
      extra: {
        url: '/pos',
        orderId: order?.id,
        invoiceNo: order?.invoiceNo,
      },
    });
  },

  /**
   * Mengirim notifikasi pesanan masuk khusus Android & KDS / BDS dapur
   */
  async notifyNewKdsOrder(order, stationLabel = 'Dapur / Bar') {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.orderAlerts) return;

    const items = order?.items || [];
    const itemCount = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const invoice = order?.invoiceNo || 'Pesanan';
    const customer = order?.customerName ? `${order.customerName} • ` : '';
    const typeLabel = order?.type === 'TAKE_AWAY' ? 'Bungkus (Take Away)' : order?.tableNumber ? `Meja ${order.tableNumber}` : 'Dine In';

    return this.scheduleNotification({
      id: Math.abs(String(invoice).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 100000,
      title: `🔔 [${stationLabel}] Pesanan #${invoice}`,
      body: `${customer}${typeLabel} • ${itemCount} Menu Masuk`,
      channelId: 'komazi_orders',
      extra: {
        url: '/kds-screen',
        orderId: order?.id,
        invoiceNo: order?.invoiceNo,
      },
    });
  },

  /**
   * Mengirim notifikasi bahwa pesanan siap saji (KDS -> Kasir/Pelayan)
   */
  async notifyOrderReady(order) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.orderAlerts) return;

    const invoice = order?.invoiceNo || 'Pesanan';
    const tableInfo = order?.tableNumber ? `Meja ${order.tableNumber}` : (order?.customerName || 'Pelanggan');

    return this.scheduleNotification({
      id: Math.abs(String(`READY-${invoice}`).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 100000,
      title: `🍽️ Pesanan Siap Saji #${invoice}`,
      body: `${tableInfo} • Siap diantarkan ke meja`,
      channelId: 'komazi_orders',
      extra: {
        url: '/pos',
        orderId: order?.id,
        invoiceNo: order?.invoiceNo,
      },
    });
  },

  /**
   * Mengirim notifikasi permintaan otorisasi supervisor (Void / Refund)
   */
  async notifyApprovalRequired(approval) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.approvalAlerts) return;

    const type = approval?.type === 'VOID' ? 'Void Pesanan' : approval?.type === 'REFUND' ? 'Refund Pesanan' : 'Otorisasi Transaksi';
    const reason = approval?.reason ? ` (${approval.reason})` : '';

    return this.scheduleNotification({
      id: Math.abs(String(`APPR-${approval?.id || Date.now()}`).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 100000,
      title: `⚠️ Permintaan Otorisasi: ${type}`,
      body: `Diperlukan persetujuan Supervisor${reason}`,
      channelId: 'komazi_alerts',
      extra: {
        url: '/orders',
        approvalId: approval?.id,
      },
    });
  },

  /**
   * Mengirim notifikasi stok bahan menipis
   */
  async notifyStockAlert(item) {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.stockAlerts) return;

    const name = item?.name || item?.ingredientName || 'Bahan Baku';
    const remaining = item?.stock !== undefined ? `${item.stock} ${item.unit || ''}` : 'Menipis';

    return this.scheduleNotification({
      id: Math.abs(String(`STK-${name}`).split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)) % 100000,
      title: `📦 Stok Menipis: ${name}`,
      body: `Sisa stok saat ini: ${remaining}. Segera lakukan restock.`,
      channelId: 'komazi_alerts',
      extra: {
        url: '/inventory',
      },
    });
  },

  /**
   * Uji coba notifikasi di perangkat Android
   */
  async testNotification() {
    return this.scheduleNotification({
      id: 99999,
      title: '✅ Notifikasi Android Komazi POS Aktif!',
      body: 'Sistem notifikasi Android via Capacitor berhasil dikonfigurasi dengan suara, getaran, dan channel resmi.',
      channelId: 'komazi_orders',
      extra: { url: '/settings' },
    });
  },

  /**
   * Ambil preferensi notifikasi saat ini
   */
  getSettings() {
    return this.settings;
  },

  /**
   * Perbarui preferensi notifikasi
   */
  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
    return this.settings;
  },
};

export default NotificationService;
