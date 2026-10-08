import { isAndroid } from './platform';
import { AndroidPrinter } from '../adapters/printer/printer.android';
import { WebPrinter } from '../adapters/printer/printer.web';

/**
 * Unified Printer Service (Section 10 & 11 Implementation Guide)
 * Berjalan seragam di Web Browser maupun Android Capacitor APK
 * Mengarahkan panggilan ke adapter platform yang sesuai secara transparan
 */
export const PrinterService = {
  getAdapter() {
    return isAndroid ? AndroidPrinter : WebPrinter;
  },

  async connect(device) {
    return await this.getAdapter().connect(device);
  },

  async disconnect() {
    return await this.getAdapter().disconnect();
  },

  isConnected() {
    return this.getAdapter().isConnected();
  },

  async getDevices() {
    return await this.getAdapter().getDevices();
  },

  async print(receipt) {
    return await this.getAdapter().print(receipt);
  },

  async testPrint() {
    return await this.getAdapter().testPrint();
  },
};
