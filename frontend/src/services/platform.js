import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export const isAndroid = platform === 'android';
export const isIos = platform === 'ios';
export const isWeb = platform === 'web';

/**
 * Mendeteksi apakah sistem dijalankan sebagai aplikasi terinstal (Native Android/iOS Capacitor atau Standalone PWA)
 * Digunakan untuk mengunci perangkat agar HANYA menjalankan POS kasir tanpa modul publik/CMS.
 */
export const isInstalledApp = (() => {
  if (isNative) return true;
  if (typeof window !== 'undefined') {
    const isStandaloneDisplay = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const isIosStandalone = window.navigator?.standalone === true;
    const isAndroidAppReferrer = typeof document !== 'undefined' && document.referrer?.includes?.('android-app://');
    const isForcedAppParam = new URLSearchParams(window.location.search).has('app_mode');

    return Boolean(isStandaloneDisplay || isIosStandalone || isAndroidAppReferrer || isForcedAppParam);
  }
  return false;
})();

export function getPlatformInfo() {
  return {
    isNative,
    isInstalledApp,
    platform,
    isAndroid,
    isIos,
    isWeb,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}

