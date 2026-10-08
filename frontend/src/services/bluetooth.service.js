import { isAndroid } from './platform';
import { PrinterService } from './printer.service';

/**
 * Unified Bluetooth Service (Section 11 Implementation Guide)
 * Mengelola scanning, discovery, dan pairing perangkat Bluetooth thermal
 */
export const BluetoothService = {
  isSupported() {
    if (typeof window === 'undefined') return false;
    if (isAndroid) return true;
    return !!navigator?.bluetooth;
  },

  async scanDevices() {
    if (!this.isSupported()) {
      return { success: false, message: 'Bluetooth tidak didukung pada browser/platform ini' };
    }
    try {
      const devices = await PrinterService.getDevices();
      return { success: true, devices };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  async requestDevice() {
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
      try {
        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
          ],
        });
        return { success: true, device };
      } catch (err) {
        if (err.name === 'NotFoundError') {
          return { success: false, cancelled: true };
        }
        return { success: false, message: err.message };
      }
    }
    return { success: false, message: 'Web Bluetooth requestDevice tidak tersedia' };
  },
};
