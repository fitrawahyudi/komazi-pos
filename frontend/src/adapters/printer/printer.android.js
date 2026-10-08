import { registerPlugin, Capacitor } from '@capacitor/core';
import { WebPrinter } from './printer.web';

export const KomaziPrinter = registerPlugin('KomaziPrinter');

function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}

/**
 * Android Native Printer Adapter
 * Berjalan di lingkungan Capacitor Android APK
 * Berkomunikasi dengan Bluetooth printer melalui KomaziPrinterPlugin (Serial ESC-POS SPP)
 * Mendukung Android System PrintManager & graceful fallback ke WebPrinter
 */
export const AndroidPrinter = {
  activeDevice: null,

  async getDevices() {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await KomaziPrinter.getPairedPrinters();
        return res?.devices || [];
      } catch (err) {
        console.warn('[AndroidPrinter] getPairedPrinters error:', err);
        return [];
      }
    }
    return await WebPrinter.getDevices();
  },

  async autoConnect() {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await KomaziPrinter.autoConnect();
        if (res && res.success) {
          this.activeDevice = {
            name: res.name || 'Printer Bluetooth',
            address: res.address,
          };
          return { success: true, name: this.activeDevice.name, address: this.activeDevice.address };
        }
      } catch (err) {
        return { success: false, message: err?.message };
      }
    }
    return { success: false };
  },

  async getLastDevice() {
    if (Capacitor.isNativePlatform()) {
      try {
        return await KomaziPrinter.getLastConnectedDevice();
      } catch {
        return { hasDevice: false };
      }
    }
    return { hasDevice: false };
  },

  async connect(device) {
    if (Capacitor.isNativePlatform()) {
      const address = typeof device === 'string' ? device : (device?.address || device?.id);
      if (!address) {
        return { success: false, message: 'Alamat printer tidak valid' };
      }
      try {
        const res = await KomaziPrinter.connect({ address });
        if (res && res.success) {
          this.activeDevice = {
            name: res.name || device?.name || 'Printer Bluetooth',
            address: res.address || address,
          };
          return {
            success: true,
            name: this.activeDevice.name,
            address: this.activeDevice.address,
          };
        }
        return { success: false, message: 'Koneksi gagal' };
      } catch (err) {
        return { success: false, message: err?.message || 'Gagal terhubung ke printer' };
      }
    }

    // Fallback ke WebPrinter jika bukan native platform
    return await WebPrinter.connect(device);
  },

  async disconnect() {
    if (Capacitor.isNativePlatform()) {
      try {
        await KomaziPrinter.disconnect();
      } catch (e) {
        console.warn('[AndroidPrinter] disconnect error:', e);
      }
      this.activeDevice = null;
      return { success: true };
    }
    return await WebPrinter.disconnect();
  },

  async isConnected() {
    if (Capacitor.isNativePlatform()) {
      try {
        const res = await KomaziPrinter.isConnected();
        return !!res?.connected;
      } catch {
        return false;
      }
    }
    return WebPrinter.isConnected();
  },

  async printRaw(uint8Data) {
    if (Capacitor.isNativePlatform()) {
      const base64 = uint8ToBase64(uint8Data);
      return await KomaziPrinter.printRaw({ data: base64 });
    }
    return false;
  },

  async printSystemHtml(html, jobName = 'Struk_Komazi_POS') {
    if (Capacitor.isNativePlatform()) {
      try {
        return await KomaziPrinter.printSystem({ html, jobName });
      } catch (err) {
        return { success: false, message: err?.message };
      }
    }
    return false;
  },

  async print(receipt) {
    // Jika printer Bluetooth terhubung secara native, kirim ESC/POS
    const isConn = await this.isConnected();
    if (isConn) {
      try {
        const EscPosEncoder = (await import('esc-pos-encoder')).default;
        const encoder = new EscPosEncoder();
        let enc = encoder
          .initialize()
          .align('center')
          .bold(true)
          .line(receipt.storeName || 'KOMAZI COFFEE')
          .bold(false)
          .line('--------------------------------')
          .align('left')
          .line(`No: ${receipt.orderNumber || receipt.invoiceNo || '-'}`)
          .line(`Tipe: ${receipt.type || 'DINE IN'}`)
          .line('--------------------------------');

        for (const item of receipt.items || []) {
          enc = enc.line(`${item.qty}x ${item.name || item.productName}`);
        }

        enc = enc
          .line('--------------------------------')
          .align('right')
          .bold(true)
          .line(`TOTAL: ${receipt.total || 0}`)
          .bold(false)
          .newline()
          .newline()
          .cut();

        const data = enc.encode();
        await this.printRaw(data);
        return { success: true, method: 'ANDROID_NATIVE_BLUETOOTH' };
      } catch (err) {
        console.warn('[AndroidPrinter] ESC/POS print failed:', err);
      }
    }

    // Fallback ke WebPrinter
    return await WebPrinter.print(receipt);
  },

  async testPrint() {
    return await WebPrinter.testPrint();
  },
};
