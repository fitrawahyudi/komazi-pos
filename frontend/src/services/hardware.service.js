import { isNative, isAndroid, isWeb, platform } from './platform';
import { BluetoothService } from './bluetooth.service';
import { PrinterService } from './printer.service';

/**
 * Hardware Capability Layer (Section 39 & 40 Implementation Guide)
 * Mendeteksi kemampuan hardware perangkat saat aplikasi berjalan
 */
export const HardwareService = {
  async getCapabilities() {
    const bluetooth = BluetoothService.isSupported();
    const printerConnected = PrinterService.isConnected();
    const camera = typeof navigator !== 'undefined' && (!!navigator.mediaDevices?.getUserMedia || isNative);
    const notifications = typeof window !== 'undefined' && 'Notification' in window;
    const barcodeScanner = camera || true; // Software camera scanner or hardware USB scanner

    return {
      platform,
      isNative,
      isAndroid,
      isWeb,
      capabilities: {
        bluetooth,
        printer: printerConnected,
        camera,
        notifications,
        barcodeScanner,
      },
    };
  },
};
