import { isNative } from './platform';
import { toast } from '../store/toastStore';

/**
 * Unified Notification Service (Section 17 Implementation Guide)
 * Menggunakan Web Notification API di Browser / Native Push jika didukung
 * Dengan fallback in-app toast jika permission ditolak atau tidak didukung
 */
export const NotificationService = {
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    try {
      const res = await Notification.requestPermission();
      return res;
    } catch {
      return 'denied';
    }
  },

  async notify({ title, body, icon = '/icons/icon-192x192.png' }) {
    // Jalur A: Web Notification jika didukung & granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon });
        return { success: true, method: 'SYSTEM_NOTIFICATION' };
      } catch (err) {
        console.warn('[NotificationService] System notification failed:', err);
      }
    }

    // Jalur B: Fallback in-app toast
    toast.info(`${title}: ${body}`);
    return { success: true, method: 'IN_APP_TOAST' };
  },
};
