import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export const isAndroid = platform === 'android';
export const isIos = platform === 'ios';
export const isWeb = platform === 'web';

export function getPlatformInfo() {
  return {
    isNative,
    platform,
    isAndroid,
    isIos,
    isWeb,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
}
